import React, { useEffect, useState } from 'react';
import { Container, Grid, Typography, Box, CircularProgress, Alert, Paper, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api } from '../api/client';
import { DeviceStatus } from '../types';
import type { Device } from '../types';
import { DeviceCard } from '../components/DeviceCard';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../context/AuthContext';

// Группировка устройств
interface GroupedDevices {
    [houseId: number]: {
        address: string;
        rooms: {
            [roomId: number]: {
                name: string;
                devices: Device[];
            }
        }
    }
}

export const Dashboard = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchDevices();
  }, []);

  // Подписка на события через SSE
  const { isConnected } = useSSE({
    onMessage: async (event) => {
      console.log('[Dashboard] SSE event received:', event);
      
      switch (event.type) {
        case 'device.status.updated':
          console.log('[Dashboard] Device status updated:', event.data);
          // Обновляем только статус из события
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, status: event.data.status } 
              : d
          ));
          break;
        
        case 'device.settings.updated':
          console.log('[Dashboard] Device settings updated:', event.data);
          // Обновляем только settings из события
          setDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, settings: { ...d.settings, ...event.data.settings } } 
              : d
          ));
          break;
        
        case 'device.created':
        case 'device.updated':
          // Перезагружаем список устройств при создании/обновлении
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
          // Перезагружаем список устройств при изменении структуры домов/комнат
          fetchDevices();
          break;
        
        default:
          // Игнорируем неизвестные события
          break;
      }
    },
    onError: (error) => {
      console.error('SSE error:', error);
    },
    onOpen: () => {
      console.log('SSE connection opened');
    },
    onClose: () => {
      console.log('SSE connection closed');
    },
  });

  // Показываем статус подключения SSE (для отладки)
  useEffect(() => {
    console.log('[Dashboard] SSE connection status:', isConnected ? 'CONNECTED' : 'DISCONNECTED');
  }, [isConnected]);

  const handleToggleDevice = async (id: number, newStatus: DeviceStatus) => {
    try {
      await api.put(`/devices/${id}/status`, { status: newStatus });
      // Обновление придет через SSE событие
    } catch (err) {
      setError('Ошибка при изменении статуса');
      fetchDevices();
    }
  };

  const handleSettingsChange = async (id: number, newSettings: Record<string, any>) => {
      try {
          await api.put(`/devices/${id}/settings`, { settings: newSettings });
          // Обновление придет через SSE событие
      } catch (err) {
          console.error(err);
          fetchDevices();
      }
  };

  // Группировка устройств
  const groupedDevices: GroupedDevices = devices.reduce((acc, device) => {
      const hId = device.houseId || 0;
      const hAddr = device.houseAddress || 'Неизвестный дом';
      const rId = device.roomId;
      const rName = device.roomName;

      if (!acc[hId]) {
          acc[hId] = { address: hAddr, rooms: {} };
      }
      if (!acc[hId].rooms[rId]) {
          acc[hId].rooms[rId] = { name: rName, devices: [] };
      }
      acc[hId].rooms[rId].devices.push(device);
      return acc;
  }, {} as GroupedDevices);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Дашборд управления
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {Object.keys(groupedDevices).length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                Устройств пока нет. Добавьте их в разделе "Управление домами".
              </Typography>
          ) : (
              Object.entries(groupedDevices).map(([hId, house]) => (
                  <Paper key={hId} elevation={3} sx={{ mb: 4, overflow: 'hidden' }}>
                      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
                          <Typography variant="h5">{house.address}</Typography>
                      </Box>
                      
                      <Box sx={{ p: 2 }}>
                          {Object.entries(house.rooms).map(([rId, room]) => (
                              <Box key={rId} sx={{ mb: 3 }}>
                                  <Typography variant="h6" color="text.secondary" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                                      {room.name}
                                  </Typography>
                                  <Grid container spacing={3}>
                                      {room.devices.map(device => (
                                          <Grid item key={device.deviceId} xs={12} sm={6} md={4} lg={3} xl={2}>
                                              <DeviceCard 
                                                device={device} 
                                                onToggle={handleToggleDevice} 
                                                onSettingsChange={handleSettingsChange}
                                              />
                                          </Grid>
                                      ))}
              </Grid>
                              </Box>
                          ))}
                      </Box>
                  </Paper>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};
