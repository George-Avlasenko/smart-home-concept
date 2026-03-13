import React, { useEffect, useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Grid,
  Button,
  Slider,
  Tooltip,
} from '@mui/material';
import { api } from '../api/client';
import { DeviceStatus } from '../types';
import type { Device, House } from '../types';
import { GlassTopBar } from '../components/GlassTopBar';
import { Toast } from '../components/Toast';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../context/AuthContext';
import { useSelectedHouse } from '../context/SelectedHouseContext';

export const Dashboard = () => {
  const { logout } = useAuth();
  const { selectedHouseId, setSelectedHouseId } = useSelectedHouse();
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [houseLightsBrightness, setHouseLightsBrightness] = useState(100);

  const fetchDevices = async () => {
    try {
      const response = await api.get<Device[]>('/devices');
      setDevices(response.data);
    } catch (err) {
      setError('Не удалось загрузить список устройств');
    } finally {
      setLoading(false);
    }
  };

  const fetchHouses = async () => {
    try {
      const response = await api.get<House[]>('/houses');
      setHouses(response.data || []);
      if ((response.data?.length ?? 0) > 0 && selectedHouseId === null) {
        setSelectedHouseId(response.data[0].houseId);
      }
    } catch (err) {
      console.error('Failed to fetch houses:', err);
      setHouses([]);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchHouses();
  }, []);

  const selectedHouseIndex = useMemo(() => {
    const idx = houses.findIndex(h => h.houseId === selectedHouseId);
    return idx >= 0 ? idx : 0;
  }, [houses, selectedHouseId]);

  const houseItems = useMemo(() => 
    houses.map(h => ({ id: h.houseId, label: h.address })),
    [houses]
  );

  // Сначала загружаем данные, потом подключаемся к SSE (активен = получает обновления по подписке)
  const { isConnected } = useSSE({
    enabled: !loading,
    onMessage: async (event) => {
      console.log('[Dashboard] SSE event received:', event);
      
      switch (event.type) {
        case 'device.status.updated':
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, status: event.data.status } 
              : d
          ));
          break;
        
        case 'device.settings.updated':
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, settings: { ...d.settings, ...event.data.settings } } 
              : d
          ));
          break;
        
        case 'device.created':
        case 'device.updated':
          fetchDevices();
          break;
        
        case 'device.deleted':
          setDevices(prev => prev.filter(d => d.deviceId !== event.data.deviceId));
          break;
        
        case 'room.created':
        case 'room.updated':
        case 'room.deleted':
        case 'house.created':
        case 'house.updated':
        case 'house.deleted':
          fetchDevices();
          fetchHouses();
          break;
        
        default:
          break;
      }
    },
    onError: (error) => {
      console.error('SSE error:', error);
    },
  });

  const handleToggleDevice = async (id: number, newStatus: DeviceStatus) => {
    try {
      await api.put(`/devices/${id}/status`, { status: newStatus });
    } catch (err) {
      setError('Ошибка при изменении статуса');
      fetchDevices();
    }
  };

  const handleSettingsChange = async (id: number, newSettings: Record<string, any>) => {
    try {
      await api.put(`/devices/${id}/settings`, { settings: newSettings });
    } catch (err) {
      console.error(err);
      fetchDevices();
    }
  };

  // Устройства выбранного дома (все комнаты дома)
  const houseDevices = useMemo(() => {
    if (selectedHouseId === null) return [];
    return devices.filter(d => d.houseId === selectedHouseId);
  }, [devices, selectedHouseId]);

  const houseThermostats = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'thermostat'), [houseDevices]);
  const houseWindows = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'window'), [houseDevices]);
  const houseLights = useMemo(() => houseDevices.filter(d => d.type.toLowerCase() === 'light'), [houseDevices]);
  const houseMainTemp = useMemo(() => {
    const t = houseThermostats[0]?.settings?.targetTemp ?? 22;
    return t;
  }, [houseThermostats]);

  const setHouseTempAll = (temp: number) => {
    houseThermostats.forEach(dev => {
      handleSettingsChange(dev.deviceId, { ...dev.settings, targetTemp: temp });
    });
  };

  const setHouseWindowsAll = (mode: string) => {
    houseWindows.forEach(dev => {
      handleSettingsChange(dev.deviceId, { ...dev.settings, mode });
      if (mode === 'closed') handleToggleDevice(dev.deviceId, DeviceStatus.Inactive);
      else handleToggleDevice(dev.deviceId, DeviceStatus.Active);
    });
  };

  const setHouseLightsAll = (on: boolean, brightness?: number) => {
    houseLights.forEach(dev => {
      handleToggleDevice(dev.deviceId, on ? DeviceStatus.Active : DeviceStatus.Inactive);
      if (on && brightness != null) handleSettingsChange(dev.deviceId, { ...dev.settings, brightness });
    });
  };

  const handlePowerOff = () => {
    if (selectedHouseId === null) return;
    const msg =
      'Отключить электричество в доме?\n\n' +
      'Будет выключено питание всего дома, включая этот модуль (как колонка Алисы). ' +
      'Запишется лог. Приложение перестанет работать — для запуска нужно будет открыть его снова.\n\nПродолжить?';
    if (!window.confirm(msg)) return;
    const logEntry = { event: 'main_power_off', houseId: selectedHouseId, at: new Date().toISOString() };
    try {
      localStorage.setItem('powerOffLog', JSON.stringify(logEntry));
    } catch (_) {}
    sessionStorage.clear();
    window.location.href = '/power-off';
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <CircularProgress sx={{ color: '#F08B5C' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Размытый фон */}
      {/* Верхняя панель — выбор дома */}
      <GlassTopBar
        items={houseItems}
        selectedIndex={selectedHouseIndex}
        onItemChange={(index) => setSelectedHouseId(houses[index]?.houseId ?? null)}
        onAddClick={() => window.location.href = '/admin/houses'}
        onLogout={logout}
      />

      {/* Основной контент - стеклянная панель */}
      <Box
        sx={{
          flexGrow: 1,
          mx: 4,
          mb: 4,
          mt: 3,
          p: 4,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 1,
          minHeight: 'calc(100vh - 200px)',
        }}
      >
        <Toast
          open={!!error}
          message={error}
          severity="error"
          onClose={() => setError('')}
        />

        {houses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
              Нет доступных домов
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Добавьте дома в разделе «Управление домами»
            </Typography>
          </Box>
        ) : selectedHouseId === null ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Выберите дом выше
            </Typography>
          </Box>
        ) : (
          <>
          {/* Блок управления домом: климат, окна, свет, быстрый вызов, отключение */}
          <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
            {houseThermostats.length > 0 && (
              <Box sx={{ p: 2, minWidth: 140, background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>Климат по дому</Typography>
                <Typography variant="h6" sx={{ color: '#fff' }}>{houseMainTemp}°C</Typography>
                <Slider size="small" value={houseMainTemp} min={16} max={30} step={0.5} sx={{ color: '#F08B5C', mt: 0.5 }}
                  onChange={(_, v) => setHouseTempAll(v as number)} valueLabelDisplay="auto" />
              </Box>
            )}
            {houseWindows.length > 0 && (
              <Box sx={{ p: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', width: '100%', mb: 0.5 }}>Окна</Typography>
                <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setHouseWindowsAll('closed')}>Закрыто</Button>
                <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setHouseWindowsAll('tilted')}>Проветривание</Button>
                <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setHouseWindowsAll('opened')}>Открыто</Button>
              </Box>
            )}
            {houseLights.length > 0 && (
              <Box sx={{ p: 2, minWidth: 180, background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>Свет</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                  <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setHouseLightsAll(true, houseLightsBrightness)}>Включить все</Button>
                  <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setHouseLightsAll(false)}>Выключить все</Button>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Яркость: {houseLightsBrightness}%</Typography>
                <Slider size="small" value={houseLightsBrightness} min={0} max={100} sx={{ color: '#F08B5C' }}
                  onChange={(_, v) => {
                    const b = v as number;
                    setHouseLightsBrightness(b);
                    houseLights.forEach(dev => handleSettingsChange(dev.deviceId, { ...dev.settings, brightness: b }));
                  }}
                  valueLabelDisplay="auto" />
              </Box>
            )}
            <Box sx={{ p: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', position: 'absolute', mt: -1.5 }}>Быстрый вызов</Typography>
              <Tooltip title="Пожар 101"><Button size="small" sx={{ minWidth: 44, bgcolor: 'rgba(200,80,80,0.4)', color: '#fff' }}>101</Button></Tooltip>
              <Tooltip title="Полиция 102"><Button size="small" sx={{ minWidth: 44, bgcolor: 'rgba(80,80,200,0.4)', color: '#fff' }}>102</Button></Tooltip>
              <Tooltip title="Скорая 103"><Button size="small" sx={{ minWidth: 44, bgcolor: 'rgba(200,120,80,0.4)', color: '#fff' }}>103</Button></Tooltip>
              <Tooltip title="Газ 104"><Button size="small" sx={{ minWidth: 44, bgcolor: 'rgba(180,160,80,0.4)', color: '#fff' }}>104</Button></Tooltip>
            </Box>
            <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,100,100,0.6)', color: '#ff8a8a', alignSelf: 'center' }} onClick={handlePowerOff}>
              Отключить электричество
            </Button>
          </Box>

          {/* Место под графики статистики */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: 140, p: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>График 1 — статистика</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: 140, p: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>График 2 — статистика</Typography>
              </Box>
            </Grid>
          </Grid>
          </>
        )}
      </Box>
    </Box>
  );
};
