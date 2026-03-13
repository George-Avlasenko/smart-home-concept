import React, { useEffect, useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Grid,
} from '@mui/material';
import { api } from '../api/client';
import { DeviceStatus } from '../types';
import type { Device, Room } from '../types';
import { GlassDeviceCard } from '../components/GlassDeviceCard';
import { Toast } from '../components/Toast';
import { CategorySidebar, DeviceCategory, filterDevicesByCategory } from '../components/CategorySidebar';
import { GlassTopBar } from '../components/GlassTopBar';
import { useSSE } from '../hooks/useSSE';
import { useSelectedHouse } from '../context/SelectedHouseContext';
import { useAuth } from '../context/AuthContext';

export const AllDevices = () => {
  const { selectedHouseId } = useSelectedHouse();
  const { logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory>('all');
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);

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

  const fetchRoomsForHouse = async (houseId: number) => {
    try {
      const response = await api.get<Room[]>(`/houses/${houseId}/rooms`);
      setRooms(response.data || []);
      setSelectedRoomIndex(0); // "Все"
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setRooms([]);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedHouseId !== null) {
      fetchRoomsForHouse(selectedHouseId);
    } else {
      setRooms([]);
    }
  }, [selectedHouseId]);

  // Сначала загружаем данные, потом подключаемся к SSE
  useSSE({
    enabled: !loading,
    onMessage: async (event) => {
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

  // Первый пункт "Все" — показать все устройства в доме без фильтра по комнате
  const roomItems = useMemo(() => {
    const list: { id: number; label: string }[] = [{ id: 0, label: 'Все' }];
    rooms.forEach(r => list.push({ id: r.roomId, label: r.roomName }));
    return list;
  }, [rooms]);

  // Фильтр: индекс 0 = "Все" (весь дом), иначе комната
  const filteredDevices = useMemo(() => {
    let list = devices;
    if (selectedHouseId !== null) {
      list = list.filter(d => d.houseId === selectedHouseId);
      if (selectedRoomIndex > 0 && selectedRoomIndex <= rooms.length) {
        const roomId = rooms[selectedRoomIndex - 1].roomId;
        list = list.filter(d => d.roomId === roomId);
      }
    }
    return filterDevicesByCategory(list, selectedCategory);
  }, [devices, selectedCategory, selectedHouseId, rooms, selectedRoomIndex]);

  const devicesByRoom = useMemo(() => {
    if (selectedHouseId === null) return devices;
    let list = devices.filter(d => d.houseId === selectedHouseId);
    if (selectedRoomIndex > 0 && selectedRoomIndex <= rooms.length) {
      const roomId = rooms[selectedRoomIndex - 1].roomId;
      list = list.filter(d => d.roomId === roomId);
    }
    return list;
  }, [devices, selectedHouseId, rooms, selectedRoomIndex]);

  const deviceCounts = useMemo(() => {
    const counts: Record<DeviceCategory, number> = {
      all: 0,
      lighting: 0,
      climate: 0,
      security: 0,
      appliances: 0,
      sensors: 0,
      cameras: 0,
      other: 0,
    };
    
    devicesByRoom.forEach(device => {
      const type = device.type.toLowerCase();
      counts.all++;
      
      if (['light'].includes(type)) counts.lighting++;
      else if (['thermostat', 'window'].includes(type)) counts.climate++;
      else if (['lock'].includes(type)) counts.security++;
      else if (['kettle', 'vacuum', 'outlet', 'switch'].includes(type)) counts.appliances++;
      else if (['sensor'].includes(type)) counts.sensors++;
      else if (['camera'].includes(type)) counts.cameras++;
      else counts.other++;
    });
    
    return counts;
  }, [devicesByRoom]);

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
      {/* Верхняя панель — выбор комнаты (в выбранном доме) */}
      <GlassTopBar
        items={roomItems}
        selectedIndex={selectedRoomIndex}
        onItemChange={setSelectedRoomIndex}
        onAddClick={selectedHouseId !== null ? () => window.location.href = '/admin/houses' : undefined}
        onLogout={logout}
      />

      {/* Основной контент */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          mx: 4,
          mb: 4,
          mt: 3,
          position: 'relative',
          zIndex: 1,
          gap: 3,
        }}
      >
        {/* Боковая панель категорий */}
        <CategorySidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          deviceCounts={deviceCounts}
        />

        {/* Основная область с устройствами */}
        <Box
          sx={{
            flexGrow: 1,
            p: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
            overflowScrolling: 'touch',
            WebkitOverflowScrolling: 'touch',
            transform: 'translateZ(0)',
            willChange: 'scroll-position',
          }}
        >
          <Toast
            open={!!error}
            message={error}
            severity="error"
            onClose={() => setError('')}
          />

          <Typography 
            variant="h4" 
            sx={{ 
              color: '#FFFFFF', 
              fontWeight: 600, 
              mb: 4 
            }}
          >
            {selectedHouseId !== null && roomItems.length > 0
              ? `Устройства — ${selectedRoomIndex === 0 ? 'все в доме' : roomItems[selectedRoomIndex]?.label ?? ''}`
              : 'Все устройства'}
          </Typography>

          {selectedHouseId === null ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                Сначала выберите дом на главной
              </Typography>
            </Box>
          ) : filteredDevices.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                Нет устройств в выбранной комнате и категории
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3} sx={{ contain: 'layout' }}>
              {filteredDevices.map(device => (
                <Grid item key={device.deviceId} xs={12} sm={6} md={4} lg={3} sx={{ display: 'flex', minHeight: 248, contentVisibility: 'auto', minWidth: 0 }}>
                  <GlassDeviceCard
                    device={device}
                    onToggle={handleToggleDevice}
                    onSettingsChange={handleSettingsChange}
                    size="medium"
                    reducedBlur
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>
    </Box>
  );
};

