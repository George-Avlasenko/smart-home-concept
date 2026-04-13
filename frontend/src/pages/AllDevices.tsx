import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Grid,
  Dialog,
  DialogContent,
  useMediaQuery,
} from '@mui/material';
import { api } from '../api/client';
import { DeviceStatus } from '../types';
import type { Device, House, Room } from '../types';
import { GlassDeviceCard } from '../components/GlassDeviceCard';
import { Toast } from '../components/Toast';
import { CategorySidebar, DeviceCategory, filterDevicesByCategory } from '../components/CategorySidebar';
import { GlassTopBar } from '../components/GlassTopBar';
import { useSSE } from '../hooks/useSSE';
import { useSelectedHouse } from '../context/SelectedHouseContext';
import { useAuth } from '../context/AuthContext';
import { scrollbarLikeDevicesSx } from '../theme/scrollbarStyles';

export const AllDevices = () => {
  const { selectedHouseId, setSelectedHouseId } = useSelectedHouse();
  const { user, logout } = useAuth();
  const isCategoriesMini = useMediaQuery('(max-width:1150px)');
  const isOnly3PerRow = useMediaQuery('(max-width:1380px)');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollCurrentRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const scrollMaxRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);

  // Чтобы не было видимого скролла на всю страницу — скроллим только внутренний список.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory>('all');
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [openedDeviceId, setOpenedDeviceId] = useState<number | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await api.get<Device[]>('/devices');
      setDevices(response.data);
    } catch (err) {
      setError('Не удалось загрузить список устройств');
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (loading) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    scrollCurrentRef.current = el.scrollTop;
    scrollMaxRef.current = Math.max(0, el.scrollHeight - el.clientHeight);

    // Оптимизированный inertial-scroll: меньше ветвлений, пиксельный snap.
    const damping = 0.7;
    const tailVelocity = 1.2;
    const tailDamping = 0.1;
    const stopVelocity = 0.75;

    const tick = () => {
      const maxScroll = scrollMaxRef.current;
      const absVelocity = Math.abs(scrollVelocityRef.current);
      const decay = absVelocity < tailVelocity ? tailDamping : damping;
      scrollVelocityRef.current *= decay;

      if (absVelocity <= stopVelocity) {
        scrollVelocityRef.current = 0;
        wheelRafRef.current = null;
        return;
      }

      let next = Math.round(scrollCurrentRef.current + scrollVelocityRef.current);
      if (next < 0) next = 0;
      if (next > maxScroll) next = maxScroll;

      scrollCurrentRef.current = next;
      el.scrollTop = next;

      if (next === 0 || next === maxScroll) {
        scrollVelocityRef.current = 0;
        wheelRafRef.current = null;
        return;
      }

      wheelRafRef.current = window.requestAnimationFrame(tick);
    };

    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) return; // зум
      if (e.deltaY === 0) return;

      // Важно: passive:false, чтобы можно было preventDefault.
      e.preventDefault();

      scrollMaxRef.current = Math.max(0, el.scrollHeight - el.clientHeight);
      scrollVelocityRef.current += e.deltaY * 0.14;
      scrollVelocityRef.current = Math.max(-40, Math.min(40, scrollVelocityRef.current));

      if (wheelRafRef.current == null) {
        wheelRafRef.current = window.requestAnimationFrame(tick);
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler as any);
      if (wheelRafRef.current != null) {
        window.cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      scrollCurrentRef.current = 0;
      scrollVelocityRef.current = 0;
      scrollMaxRef.current = 0;
    };
  }, [loading]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Для пользователя demo без домов — создаём демо-дом при первом заходе
  useEffect(() => {
    if (user?.username !== 'demo' || selectedHouseId !== null) return;
    (async () => {
      try {
        const { data } = await api.get<House[]>('/houses');
        if ((data?.length ?? 0) === 0) {
          await api.post('/emulator/ensure-demo-house');
          const retry = await api.get<House[]>('/houses');
          const list = retry.data ?? [];
          if (list.length > 0) setSelectedHouseId(list[0].houseId);
        } else if ((data ?? []).length > 0) {
          setSelectedHouseId((data ?? [])[0].houseId);
        }
      } catch (_) { /* ignore */ }
    })();
  }, [user?.username, selectedHouseId, setSelectedHouseId]);

  useEffect(() => {
    if (selectedHouseId !== null) {
      fetchRoomsForHouse(selectedHouseId);
    } else {
      setRooms([]);
    }
  }, [selectedHouseId]);

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

  const handleToggleDevice = useCallback(async (id: number, newStatus: DeviceStatus) => {
    try {
      await api.put(`/devices/${id}/status`, { status: newStatus });
      fetchDevices();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = typeof data === 'string'
        ? data
        : data?.detail || data?.message || 'Ошибка при изменении статуса';
      setError(msg);
      fetchDevices();
    }
  }, [fetchDevices]);

  const handleSettingsChange = useCallback(async (id: number, newSettings: Record<string, any>) => {
    try {
      await api.put(`/devices/${id}/settings`, { settings: newSettings });
      fetchDevices();
    } catch (err) {
      console.error(err);
      fetchDevices();
    }
  }, [fetchDevices]);

  const fetchDevicesRef = useRef(fetchDevices);
  fetchDevicesRef.current = fetchDevices;
  useEffect(() => {
    if (!selectedHouseId) return;
    const t = setInterval(() => fetchDevicesRef.current(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [selectedHouseId]);

  // Первый пункт "Все" — показать все устройства в доме без фильтра по комнате
  const roomItems = useMemo(() => {
    const list: { id: number; label: string }[] = [{ id: 0, label: 'Все' }];
    rooms.forEach(r => list.push({ id: r.roomId, label: r.roomName }));
    return list;
  }, [rooms]);

  // Фильтр: дом, комната, категория, поиск по имени
  const filteredDevices = useMemo(() => {
    let list = devices;
    if (selectedHouseId !== null) {
      list = list.filter(d => d.houseId === selectedHouseId);
      if (selectedRoomIndex > 0 && selectedRoomIndex <= rooms.length) {
        const roomId = rooms[selectedRoomIndex - 1].roomId;
        list = list.filter(d => d.roomId === roomId);
      }
    }
    list = filterDevicesByCategory(list, selectedCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(d => (d.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [devices, selectedCategory, selectedHouseId, rooms, selectedRoomIndex, searchQuery]);

  const openedDevice = useMemo(
    () => filteredDevices.find((d) => d.deviceId === openedDeviceId) ?? null,
    [filteredDevices, openedDeviceId],
  );

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
      else if (['thermostat', 'window', 'humidifier', 'ventilation', 'sensor'].includes(type)) counts.climate++;
      else if (['lock'].includes(type)) counts.security++;
      else if (['kettle', 'vacuum', 'outlet', 'switch'].includes(type)) counts.appliances++;
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
        minHeight="100dvh"
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <CircularProgress sx={{ color: '#F08B5C' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'relative',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Верхняя панель — выбор комнаты (в выбранном доме) */}
      <GlassTopBar
        items={roomItems}
        selectedIndex={selectedRoomIndex}
        onItemChange={setSelectedRoomIndex}
        onAddClick={selectedHouseId !== null ? () => window.location.href = '/admin/houses' : undefined}
        onLogout={logout}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Основной контент */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          m: 0,
          p: isCategoriesMini ? 1.5 : 4,
          position: 'relative',
          zIndex: 1,
          gap: isCategoriesMini ? 1 : 3,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Боковая панель категорий */}
        <CategorySidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          deviceCounts={deviceCounts}
          compact={isCategoriesMini}
        />

        {/* Основная область с устройствами */}
        <Box
          sx={{
            flexGrow: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: isCategoriesMini ? 1.5 : 4,
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            minHeight: 0,
            ...scrollbarLikeDevicesSx,
            }}
          ref={scrollContainerRef}
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
              ? `Устройства — ${selectedRoomIndex === 0 ? 'в доме' : roomItems[selectedRoomIndex]?.label ?? ''}`
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
            <Grid container spacing={isCategoriesMini ? 2 : 3}>
              {filteredDevices.map(device => (
                <Grid
                  item
                  key={device.deviceId}
                  xs={12}
                  sm={6}
                  md={4}
                  lg={isOnly3PerRow ? 4 : 3}
                  sx={{
                    display: 'flex',
                    minHeight: 248,
                    contentVisibility: 'auto',
                    minWidth: 0,
                    width: '100%',
                  }}
                >
                  <GlassDeviceCard
                    device={device}
                    onToggle={handleToggleDevice}
                    onSettingsChange={handleSettingsChange}
                    onFrontError={(msg) => setError(msg)}
                    size="medium"
                    compact
                    onOpenDetails={(d) => setOpenedDeviceId(d.deviceId)}
                    reducedBlur
                  />
                </Grid>
              ))}
            </Grid>
          )}
          <Dialog
            open={!!openedDevice}
            onClose={() => setOpenedDeviceId(null)}
            fullWidth
            maxWidth="md"
            sx={{ '& .MuiDialog-paper': { width: 'min(92vw, 680px)' } }}
          >
            <DialogContent sx={{ p: 2 }}>
              {openedDevice && (
                <GlassDeviceCard
                  device={openedDevice}
                  onToggle={handleToggleDevice}
                  onSettingsChange={handleSettingsChange}
                  onFrontError={(msg) => setError(msg)}
                  size="large"
                />
              )}
            </DialogContent>
          </Dialog>
        </Box>
      </Box>
    </Box>
  );
};

