import React, { useEffect, useState } from 'react';
import { Typography, Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Select, MenuItem, FormControl, InputLabel, Accordion, AccordionSummary, AccordionDetails, Chip, List, ListItem, ListItemText, Tooltip, Checkbox, FormControlLabel, Switch, FormGroup } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import RouterIcon from '@mui/icons-material/Router';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { GlassPage } from '../components/GlassPage';
import { Toast } from '../components/Toast';
import { api } from '../api/client';
import type { House, Room, HouseUser, UserDevicePermission, Device, DeviceSchedule } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../hooks/useSSE';

interface DeviceEditItemProps {
    device: Device;
    deviceTypes: { value: string; label: string }[];
    onSave: (deviceId: number, data: any) => Promise<void>;
    onDelete: (deviceId: number) => void;
    onSchedule: (device: Device) => void;
}

const DeviceEditItem = ({ device, deviceTypes, onSave, onDelete, onSchedule }: DeviceEditItemProps) => {
    const [localForm, setLocalForm] = useState({
        name: device.name,
        type: device.type,
        manufacturer: device.manufacturer || '',
        serialNumber: device.serialNumber || '',
        ip: device.ip || ''
    });
    const [ipError, setIpError] = useState('');
    const [nameError, setNameError] = useState('');
    const [manufacturerError, setManufacturerError] = useState('');
    const [serialNumberError, setSerialNumberError] = useState('');

    const validateIP = (ip: string): boolean => {
        if (!ip || ip.trim() === '') return true; // Пустой IP допустим
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    };

    return (
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={2}>
            <Box>
                <TextField
                    label="Название"
                    fullWidth
                    size="small"
                    value={localForm.name}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 15) {
                            setLocalForm({ ...localForm, name: val });
                            if (val.trim() === '') {
                                setNameError('Название устройства обязательно для заполнения');
                            } else {
                                setNameError('');
                            }
                        }
                    }}
                    onBlur={() => {
                        if (!localForm.name || localForm.name.trim() === '') {
                            setNameError('Название устройства обязательно для заполнения');
                        } else {
                            setNameError('');
                        }
                    }}
                    error={!!nameError}
                    helperText={nameError || `${localForm.name.length}/15`}
                    required
                    inputProps={{ maxLength: 15 }}
                />
            </Box>
            <Box>
                <FormControl fullWidth size="small">
                    <InputLabel>Тип</InputLabel>
                    <Select
                        value={localForm.type}
                        label="Тип"
                        onChange={(e) => setLocalForm({ ...localForm, type: e.target.value })}
                    >
                        {deviceTypes.map((type) => (
                            <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <Box>
                <TextField
                    label="IP адрес"
                    fullWidth
                    size="small"
                    value={localForm.ip}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 15) {
                            setLocalForm({ ...localForm, ip: val });
                            if (val && !validateIP(val)) {
                                setIpError('Неверный формат IP адреса (например: 192.168.1.1)');
                            } else {
                                setIpError('');
                            }
                        }
                    }}
                    error={!!ipError}
                    helperText={ipError}
                    inputProps={{ maxLength: 15 }}
                />
            </Box>
            <Box>
                <TextField
                    label="Производитель"
                    fullWidth
                    size="small"
                    required
                    value={localForm.manufacturer}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 15) {
                            setLocalForm({ ...localForm, manufacturer: val });
                            if (val.trim() === '') {
                                setManufacturerError('Производитель обязателен для заполнения');
                            } else {
                                setManufacturerError('');
                            }
                        }
                    }}
                    onBlur={() => {
                        if (!localForm.manufacturer || localForm.manufacturer.trim() === '') {
                            setManufacturerError('Производитель обязателен для заполнения');
                        } else {
                            setManufacturerError('');
                        }
                    }}
                    error={!!manufacturerError}
                    helperText={manufacturerError || `${localForm.manufacturer.length}/15`}
                    inputProps={{ maxLength: 15 }}
                />
            </Box>
            <Box gridColumn="1 / -1">
                <TextField
                    label="Серийный номер"
                    fullWidth
                    size="small"
                    required
                    value={localForm.serialNumber}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 50) {
                            setLocalForm({ ...localForm, serialNumber: val });
                            if (val.trim() === '') {
                                setSerialNumberError('Серийный номер обязателен для заполнения');
                            } else {
                                setSerialNumberError('');
                            }
                        }
                    }}
                    onBlur={() => {
                        if (!localForm.serialNumber || localForm.serialNumber.trim() === '') {
                            setSerialNumberError('Серийный номер обязателен для заполнения');
                        } else {
                            setSerialNumberError('');
                        }
                    }}
                    error={!!serialNumberError}
                    helperText={serialNumberError || `${localForm.serialNumber.length}/50`}
                    inputProps={{ maxLength: 50 }}
                />
            </Box>
            <Box gridColumn="1 / -1" display="flex" justifyContent="space-between" mt={1}>
                <Button 
                    color="error" 
                    startIcon={<DeleteIcon />}
                    onClick={() => onDelete(device.deviceId)}
                >
                    Удалить
                </Button>
                <Box display="flex" gap={1}>
                    <Button 
                        variant="outlined" 
                        startIcon={<AccessTimeIcon />}
                        onClick={() => onSchedule(device)}
                    >
                        Расписание
                    </Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={() => {
                            if (!localForm.name || localForm.name.trim() === '') {
                                setNameError('Название устройства обязательно для заполнения');
                                return;
                            }
                            
                            if (!localForm.manufacturer || localForm.manufacturer.trim() === '') {
                                setManufacturerError('Производитель обязателен для заполнения');
                                return;
                            }
                            
                            if (!localForm.serialNumber || localForm.serialNumber.trim() === '') {
                                setSerialNumberError('Серийный номер обязателен для заполнения');
                                return;
                            }
                            
                            if (localForm.ip && !validateIP(localForm.ip)) {
                                setIpError('Неверный формат IP адреса (например: 192.168.1.1)');
                                return;
                            }
                            
                            setNameError('');
                            setManufacturerError('');
                            setSerialNumberError('');
                            setIpError('');
                            onSave(device.deviceId, localForm);
                        }}
                        disabled={!!ipError || !!nameError || !!manufacturerError || !!serialNumberError || 
                                 !localForm.name || localForm.name.trim() === '' ||
                                 !localForm.manufacturer || localForm.manufacturer.trim() === '' ||
                                 !localForm.serialNumber || localForm.serialNumber.trim() === ''}
                    >
                        Сохранить
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const InlineEdit = ({ initialValue, onSave, onCancel, maxLength = 50 }: { initialValue: string, onSave: (val: string) => void, onCancel: () => void, maxLength?: number }) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState('');
    
    const handleClick = (e: React.MouseEvent) => e.stopPropagation();
    
    const handleSave = () => {
        if (!value || value.trim() === '') {
            setError('Поле не может быть пустым');
            return;
        }
        setError('');
        onSave(value.trim());
    };

    return (
        <Box display="flex" alignItems="flex-start" flexGrow={1} onClick={handleClick} flexDirection="column">
             <TextField 
                size="small" 
                value={value} 
                onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length <= maxLength) {
                        setValue(newValue);
                        setError('');
                    }
                }}
                error={!!error}
                helperText={error || `${value.length}/${maxLength}`}
                sx={{ mr: 1, maxWidth: 300 }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                inputProps={{ 
                    maxLength: maxLength 
                }}
            />
            <Box display="flex" gap={0.5} mt={0.5}>
                <Box 
                    component="span" 
                    onClick={handleSave}
                    sx={{ cursor: 'pointer', p: 1, color: '#F08B5C', display: 'inline-flex' }}
                >
                    <CheckIcon fontSize="small" />
                </Box>
                <Box 
                    component="span" 
                    onClick={() => {
                        setError('');
                        onCancel();
                    }}
                    sx={{ cursor: 'pointer', p: 1, color: 'rgba(255,255,255,0.7)', display: 'inline-flex' }}
                >
                    <CloseIcon fontSize="small" />
                </Box>
            </Box>
        </Box>
    );
};

export const HouseManagement = () => {
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [rooms, setRooms] = useState<Record<number, Room[]>>({});
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [expandedHouse, setExpandedHouse] = useState<number | false>(false);
  const [expandedRoom, setExpandedRoom] = useState<number | false>(false);
  const [expandedDevice, setExpandedDevice] = useState<number | false>(false);
  
  // Модальные окна
  const [openHouseDialog, setOpenHouseDialog] = useState(false);
  const [openRoomDialog, setOpenRoomDialog] = useState(false);
  const [openDeviceDialog, setOpenDeviceDialog] = useState(false);
  const [openResidentsDialog, setOpenResidentsDialog] = useState(false);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [transferToNewOwnerDialog, setTransferToNewOwnerDialog] = useState(false);
  
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedResident, setSelectedResident] = useState<HouseUser | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Данные для модалок
  const [residents, setResidents] = useState<HouseUser[]>([]);
  const [houseDevices, setHouseDevices] = useState<Device[]>([]);
  const [residentPermissions, setResidentPermissions] = useState<Record<number, string>>({});
  const [schedules, setSchedules] = useState<DeviceSchedule[]>([]);

  // Формы
  const [newHouseAddress, setNewHouseAddress] = useState('');
  const [newHouseAddressError, setNewHouseAddressError] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomNameError, setNewRoomNameError] = useState('');
  const [newResidentEmail, setNewResidentEmail] = useState('');
  const [newSchedule, setNewSchedule] = useState({
      time: '08:00',
      days: [] as number[],
      action: true
  });
  
  // Для инлайн редактирования
  const [editingHouseId, setEditingHouseId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  // Форма девайса
  const DEFAULT_DEVICE_FORM = {
    name: 'Тестовая лампа',
    type: 'light',
    manufacturer: 'Xiaomi',
    serialNumber: 'SN-12345678',
    ip: '192.168.1.105'
  };

  const [deviceForm, setDeviceForm] = useState({
    ...DEFAULT_DEVICE_FORM,
    serialNumber: `SN-${Math.floor(Math.random() * 100000)}`
  });
  const [deviceFormIpError, setDeviceFormIpError] = useState('');
  const [deviceFormNameError, setDeviceFormNameError] = useState('');
  const [deviceFormManufacturerError, setDeviceFormManufacturerError] = useState('');
  const [deviceFormSerialNumberError, setDeviceFormSerialNumberError] = useState('');

  const validateIP = (ip: string): boolean => {
    if (!ip || ip.trim() === '') return true; // Пустой IP допустим
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const DEVICE_TYPES = [
    { value: 'light', label: 'Освещение' },
    { value: 'thermostat', label: 'Кондиционер' },
    { value: 'switch', label: 'Выключатель' },
    { value: 'outlet', label: 'Розетка' },
    { value: 'kettle', label: 'Чайник' },
    { value: 'vacuum', label: 'Робот-пылесос' },
    { value: 'curtain', label: 'Шторы' },
    { value: 'camera', label: 'Камера' },
    { value: 'window', label: 'Окно' },
    { value: 'sensor', label: 'Датчик' },
    { value: 'lock', label: 'Замок' },
    { value: 'humidifier', label: 'Увлажнитель' },
    { value: 'ventilation', label: 'Вентиляция' }
  ];

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchHouses(), fetchDevices()]).finally(() => {
      if (!cancelled) setInitialLoadDone(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Сначала загружаем данные, потом подключаемся к SSE
  useSSE({
    enabled: initialLoadDone,
    onMessage: async (event) => {
      console.log('SSE event received in HouseManagement:', event);
      
      switch (event.type) {
        case 'house.created':
        case 'house.updated':
        case 'house.deleted':
          fetchHouses();
          break;
        
        case 'room.created':
        case 'room.updated':
        case 'room.deleted':
          if (event.data.houseId) {
            fetchRooms(event.data.houseId);
          }
          fetchDevices();
          break;
        
        case 'device.created':
        case 'device.updated':
        case 'device.deleted':
          fetchDevices();
          if (selectedHouseId) {
            fetchHouseDevices(selectedHouseId);
          }
          break;
        
        case 'device.status.updated':
          // Обновляем только статус из события
          setAllDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, status: event.data.status } 
              : d
          ));
          setHouseDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, status: event.data.status } 
              : d
          ));
          break;
        
        case 'device.settings.updated':
          // Обновляем только settings из события
          setAllDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, settings: { ...d.settings, ...event.data.settings } } 
              : d
          ));
          setHouseDevices(prev => prev.map(d => 
            d.deviceId === event.data.deviceId 
              ? { ...d, settings: { ...d.settings, ...event.data.settings } } 
              : d
          ));
          break;
        
        case 'house.user.added':
        case 'house.user.removed':
        case 'house.user.role.updated':
        case 'house.ownership.transferred':
          if (selectedHouseId) {
            fetchResidents(selectedHouseId);
          }
          break;
        
        case 'schedule.created':
        case 'schedule.updated':
        case 'schedule.deleted':
        case 'schedule.toggled':
          if (selectedDevice) {
            // Перезагружаем расписания для выбранного устройства
            // Это можно оптимизировать, но пока так
          }
          break;
        
        default:
          // Игнорируем неизвестные события
          break;
      }
    },
    onError: (error) => {
      console.error('SSE error in HouseManagement:', error);
    },
  });

  const showSuccess = (msg: string) => setSuccessMessage(msg);
  const handleCloseSnackbar = () => {
      setSuccessMessage('');
      setError('');
  };

  const fetchDevices = async () => {
      try {
          const res = await api.get<Device[]>('/devices');
          setAllDevices(res.data);
      } catch (err: any) {
          console.error("Error fetching devices:", err);
          setError("Не удалось загрузить устройства: " + (err.response?.data?.message || err.message));
      }
  };

  const fetchHouses = async () => {
    try {
      const res = await api.get<House[]>('/houses');
      const list = res.data ?? [];
      setHouses(list);
      if (user?.username === 'demo' && list.length === 0) {
        try {
          await api.post('/emulator/ensure-demo-house');
          const retry = await api.get<House[]>('/houses');
          setHouses(retry.data ?? []);
          fetchDevices();
        } catch (_) { /* ignore */ }
      }
    } catch (err: any) {
        console.error("Error fetching houses:", err);
        setError("Не удалось загрузить список домов: " + (err.response?.data?.title || err.message));
    }
  };

  const fetchRooms = async (houseId: number) => {
    try {
      const res = await api.get<Room[]>(`/houses/${houseId}/rooms`);
      setRooms(prev => ({ ...prev, [houseId]: res.data }));
    } catch (err) {
      setRooms(prev => ({ ...prev, [houseId]: [] }));
    }
  };

  const fetchResidents = async (houseId: number) => {
    try {
      const res = await api.get<HouseUser[]>(`/houses/${houseId}/users`);
      setResidents(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchHouseDevices = async (houseId: number) => {
      try {
        const res = await api.get<Device[]>('/devices');
        const houseRoomIds = rooms[houseId]?.map(r => r.roomId) || [];
        if (houseRoomIds.length === 0) {
             const roomsRes = await api.get<Room[]>(`/houses/${houseId}/rooms`);
             const ids = roomsRes.data.map(r => r.roomId);
             setHouseDevices(res.data.filter(d => ids.includes(d.roomId)));
    } else {
             setHouseDevices(res.data.filter(d => houseRoomIds.includes(d.roomId)));
        }
      } catch (err) { setHouseDevices([]); }
  };

  const fetchPermissionsForUser = async (userId: number, devices: Device[]) => {
      const perms: Record<number, string> = {};
      for (const dev of devices) {
          try {
              const res = await api.get<UserDevicePermission[]>(`/permissions/device/${dev.deviceId}`);
              const userPerm = res.data.find(p => p.userId === userId);
              if (userPerm) {
                  perms[dev.deviceId] = userPerm.permissionLevel;
    } else {
                  perms[dev.deviceId] = 'none'; 
              }
          } catch (e) { perms[dev.deviceId] = 'none'; }
      }
      setResidentPermissions(perms);
  };

  const handleEditHouse = async (houseId: number, newValue: string) => {
    if (!newValue || newValue.trim() === '') {
      setError('Адрес дома не может быть пустым');
      return;
    }
    
    try {
      await api.put(`/houses/${houseId}`, { address: newValue });
      setEditingHouseId(null);
      fetchHouses();
      showSuccess('Адрес обновлен');
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = typeof data === 'string' 
          ? data 
          : (data?.error || data?.title || data?.message || 'Ошибка обновления дома');
      setError(errorMsg);
    }
  };

  const handleEditRoom = async (roomId: number, newValue: string) => {
      if (!newValue || newValue.trim() === '') {
          setError('Название комнаты не может быть пустым');
          return;
      }
      
      try {
          let houseId = 0;
          for(const hId in rooms) {
              if(rooms[hId].find(r => r.roomId === roomId)) {
                  houseId = parseInt(hId);
                  break;
              }
          }

          await api.put(`/rooms/${roomId}`, { 
              houseId: houseId, 
              roomName: newValue,
              floor: 1
          });
          setEditingRoomId(null);
          if(houseId) fetchRooms(houseId);
          showSuccess('Комната переименована');
      } catch (err: any) {
          const data = err.response?.data;
          const errorMsg = typeof data === 'string' 
              ? data 
              : (data?.error || data?.title || data?.message || 'Ошибка обновления комнаты');
          setError(errorMsg);
      }
  };

  const handleExpandDevice = (deviceId: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedDevice(isExpanded ? deviceId : false);
  };

  const handleUpdateDevice = async (deviceId: number, updatedData: any) => {
      if (!updatedData.name || updatedData.name.trim() === '') {
          setError('Название устройства обязательно для заполнения');
          return;
      }
      
      if (!updatedData.manufacturer || updatedData.manufacturer.trim() === '') {
          setError('Производитель обязателен для заполнения');
          return;
      }
      
      if (!updatedData.serialNumber || updatedData.serialNumber.trim() === '') {
          setError('Серийный номер обязателен для заполнения');
          return;
      }
      
      try {
          await api.put(`/devices/${deviceId}`, updatedData);
          setExpandedDevice(false);
          showSuccess('Устройство обновлено');
          fetchDevices();
      } catch (err: any) {
          const data = err.response?.data;
          const errorMessage = typeof data === 'string' 
              ? data 
              : (data?.error || data?.title || data?.detail || data?.message || 'Ошибка обновления устройства');
          setError(errorMessage);
      }
  };

  const handleDeleteDevice = async (deviceId: number) => {
      if (!window.confirm('Удалить устройство?')) return;
      try {
          await api.delete(`/devices/${deviceId}`);
          fetchDevices();
          showSuccess('Устройство удалено');
      } catch (err) { setError('Ошибка удаления'); }
  };

  const handleExpandHouse = (houseId: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedHouse(isExpanded ? houseId : false);
    if (isExpanded) {
      fetchRooms(houseId);
    }
  };

  const handleExpandRoom = (roomId: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedRoom(isExpanded ? roomId : false);
  };

  const handleCreateHouse = async () => {
    if (!newHouseAddress || newHouseAddress.trim() === '') {
      setNewHouseAddressError('Адрес дома обязателен для заполнения');
      return;
    }
    
    setNewHouseAddressError('');
    try {
      await api.post('/houses', { address: newHouseAddress });
      setOpenHouseDialog(false);
      setNewHouseAddress('');
      setNewHouseAddressError('');
      fetchHouses();
      showSuccess('Дом успешно создан');
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = typeof data === 'string' 
          ? data 
          : (data?.error || data?.title || data?.message || 'Ошибка создания дома');
      setNewHouseAddressError(errorMsg);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedHouseId) return;
    
    if (!newRoomName || newRoomName.trim() === '') {
      setNewRoomNameError('Название комнаты обязательно для заполнения');
      return;
    }
    
    setNewRoomNameError('');
    try {
      await api.post('/rooms', { 
        houseId: selectedHouseId, 
        roomName: newRoomName,
        floor: 1 
      });
      setOpenRoomDialog(false);
      setNewRoomName('');
      setNewRoomNameError('');
      fetchRooms(selectedHouseId);
      showSuccess('Комната добавлена');
    } catch (err: any) {
        const data = err.response?.data;
        const errorMsg = typeof data === 'string' 
            ? data 
            : (data?.error || data?.title || data?.message || 'Ошибка создания комнаты');
        setNewRoomNameError(errorMsg);
    }
  };

  const handleCreateDevice = async () => {
      if (!selectedRoomId) return;
      
      // Валидация обязательных полей
      if (!deviceForm.name || deviceForm.name.trim() === '') {
          setDeviceFormNameError('Название устройства обязательно для заполнения');
          return;
      }
      
      if (!deviceForm.manufacturer || deviceForm.manufacturer.trim() === '') {
          setDeviceFormManufacturerError('Производитель обязателен для заполнения');
          return;
      }
      
      if (!deviceForm.serialNumber || deviceForm.serialNumber.trim() === '') {
          setDeviceFormSerialNumberError('Серийный номер обязателен для заполнения');
          return;
      }
      
      if (deviceForm.ip && !validateIP(deviceForm.ip)) {
          setDeviceFormIpError('Неверный формат IP адреса (например: 192.168.1.1)');
          return;
      }
      
      setDeviceFormNameError('');
      setDeviceFormManufacturerError('');
      setDeviceFormSerialNumberError('');
      setDeviceFormIpError('');
      try {
          await api.post('/devices', {
              roomId: selectedRoomId,
              ...deviceForm
          });
          setOpenDeviceDialog(false);
          setDeviceForm({
              ...DEFAULT_DEVICE_FORM,
              serialNumber: `SN-${Math.floor(Math.random() * 100000)}`
          });
          setDeviceFormIpError('');
          setDeviceFormNameError('');
          setDeviceFormManufacturerError('');
          setDeviceFormSerialNumberError('');
          setDeviceFormManufacturerError('');
          setDeviceFormSerialNumberError('');
          showSuccess('Устройство добавлено');
          fetchDevices(); 
      } catch (err: any) {
          const data = err.response?.data;
          const errorMsg = typeof data === 'string' 
              ? data 
              : (data?.error || data?.title || data?.message || 'Ошибка добавления устройства');
          setDeviceFormNameError(errorMsg);
      }
  };

  const handleAddResident = async () => {
      if (!selectedHouseId) return;
      try {
          await api.post(`/houses/${selectedHouseId}/users`, { email: newResidentEmail });
          setNewResidentEmail('');
          fetchResidents(selectedHouseId);
          showSuccess('Жилец добавлен');
      } catch (err: any) {
          const data = err.response?.data;
          setError(typeof data === 'string' ? data : data?.title || 'Ошибка добавления жильца');
      }
  };

  const handleRemoveResident = async (userId: number) => {
      if (!selectedHouseId) return;
      if (!window.confirm('Удалить жильца из дома?')) return;
      try {
          await api.delete(`/houses/${selectedHouseId}/users/${userId}`);
          fetchResidents(selectedHouseId);
          showSuccess('Жилец удален');
      } catch (err: any) {
          const data = err.response?.data;
          setError(typeof data === 'string' ? data : data?.title || 'Ошибка удаления');
      }
  };

  const handleUpdateUserRole = async (userId: number, newRole: string) => {
      if (!selectedHouseId) return;
      try {
          await api.put(`/houses/${selectedHouseId}/users/${userId}/role`, { role: newRole });
          fetchResidents(selectedHouseId);
          showSuccess(`Роль пользователя обновлена: ${newRole === 'admin' ? 'Совладелец' : 'Жилец'}`);
      } catch (err: any) { setError('Ошибка обновления роли'); }
  };

  const handleTransferOwnership = async (newOwnerId: number, skipConfirm?: boolean) => {
      if (!selectedHouseId) return;
      if (!skipConfirm && !window.confirm('Вы уверены? Вы потеряете полные права на дом и станете совладельцем.')) return;
      try {
          await api.post(`/houses/${selectedHouseId}/users/transfer/${newOwnerId}`);
          setOpenResidentsDialog(false);
          fetchHouses();
          if (selectedHouseId) fetchResidents(selectedHouseId);
          showSuccess('Права владения переданы');
      } catch (err: any) { setError('Ошибка передачи прав'); }
  };

  const handleOpenPermissions = async (user: HouseUser) => {
      if (!selectedHouseId) return;
      setSelectedResident(user);
      setOpenPermissionsDialog(true);
      await fetchHouseDevices(selectedHouseId);
  };

  useEffect(() => {
      if (openPermissionsDialog && selectedResident && houseDevices.length > 0) {
          fetchPermissionsForUser(selectedResident.userId, houseDevices);
      }
  }, [openPermissionsDialog, houseDevices, selectedResident]);


  const handleUpdatePermission = async (deviceId: number, level: string) => {
      if (!selectedResident) return;
      try {
          if (level === 'none') {
              await api.delete(`/permissions/user/${selectedResident.userId}/device/${deviceId}`);
          } else {
              await api.post('/permissions', {
                  userId: selectedResident.userId,
                  deviceId,
                  permissionLevel: level
              });
          }
          setResidentPermissions(prev => ({ ...prev, [deviceId]: level }));
      } catch (err) { console.error(err); }
  };

  const handleOpenSchedule = async (device: Device) => {
      setSelectedDevice(device);
      setOpenScheduleDialog(true);
      try {
          const res = await api.get<DeviceSchedule[]>(`/schedules/device/${device.deviceId}`);
          setSchedules(res.data);
      } catch (err) { console.error(err); setSchedules([]); }
  };

  const handleCreateSchedule = async () => {
      if (!selectedDevice) return;
      try {
          await api.post('/schedules', {
              deviceId: selectedDevice.deviceId,
              time: newSchedule.time,
              daysOfWeek: newSchedule.days.sort().join(','),
              action: newSchedule.action
          });
          // Refresh
          const res = await api.get<DeviceSchedule[]>(`/schedules/device/${selectedDevice.deviceId}`);
          setSchedules(res.data);
          setNewSchedule({ time: '08:00', days: [], action: true });
          showSuccess('Расписание добавлено');
      } catch (err: any) { setError(err.response?.data || 'Ошибка создания расписания'); }
  };

  const handleDeleteSchedule = async (id: number) => {
      try {
          await api.delete(`/schedules/${id}`);
          setSchedules(prev => prev.filter(s => s.id !== id));
      } catch (err) { console.error(err); }
  };

  const handleToggleSchedule = async (id: number) => {
      try {
          await api.put(`/schedules/${id}/toggle`);
          setSchedules(prev => prev.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
      } catch (err) { console.error(err); }
  };

  const handleDeleteRoom = async (roomId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить комнату? Все устройства в ней будут удалены.')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      if (typeof expandedHouse === 'number') fetchRooms(expandedHouse);
      fetchDevices();
      showSuccess('Комната удалена');
    } catch (err) { setError('Ошибка удаления комнаты'); }
  };

  const handleDeleteHouse = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить дом и все его комнаты?')) return;
    try {
      await api.delete(`/houses/${id}`);
      fetchHouses();
      showSuccess('Дом удален');
    } catch (err) { setError('Ошибка удаления'); }
  };

  const handleLeaveHouse = async (houseId: number, isOwner: boolean) => {
      if (isOwner) {
          if (!window.confirm('Вы владелец дома. Чтобы покинуть его, сначала передайте права владения другому жильцу. Открыть список жильцов?')) return;
          setSelectedHouseId(houseId);
          fetchResidents(houseId);
          setOpenResidentsDialog(true);
          return;
      }

      if (!window.confirm('Вы уверены, что хотите покинуть этот дом?')) return;
      
      try {
          await api.delete(`/houses/${houseId}/users/${user!.userId}`);
          fetchHouses();
          showSuccess('Вы покинули дом');
      } catch (err: any) {
           const data = err.response?.data;
           setError(typeof data === 'string' ? data : data?.title || 'Ошибка выхода из дома');
    }
  };

  return (
    <GlassPage>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: '#fff' }}>Управление домами</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenHouseDialog(true)}>
          Добавить дом
        </Button>
      </Box>

      <Toast
        open={!!error || !!successMessage}
        message={error || successMessage || ''}
        severity={error ? 'error' : 'success'}
        onClose={handleCloseSnackbar}
      />

      <Box>
        {houses.map(house => {
          const isOwner = house.currentUserRole === 'owner';
          const isAdmin = house.currentUserRole === 'admin';
          const isSystemAdmin = user?.role === 'admin';
          // Глобальный админ в чужом доме не управляет структурой/ролями/правами — только передача владения
          const canManageStructure = isOwner;
          const canManageDevices = isOwner || isAdmin;

          return (
          <Accordion 
              key={house.houseId} 
              expanded={expandedHouse === house.houseId} 
              onChange={handleExpandHouse(house.houseId)}
              sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 2, '&:before': { display: 'none' }, color: '#fff' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                <Box
                  display="flex"
                  alignItems="flex-start"
                  width="100%"
                  pr={2}
                  flexWrap="wrap"
                  gap={1}
                >
                    <HomeIcon sx={{ mr: { xs: 0, sm: 2 }, color: '#F08B5C', flex: '0 0 auto' }} />
                    
                    {editingHouseId === house.houseId ? (
                        <InlineEdit
                            initialValue={house.address}
                            onSave={(val) => handleEditHouse(house.houseId, val)}
                            onCancel={() => setEditingHouseId(null)}
                        />
                    ) : (
                        <Typography
                          variant="h6"
                          sx={{
                            flex: '1 1 240px',
                            minWidth: 0,
                            color: '#fff',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal',
                          }}
                        >
                          {house.address}
                        </Typography>
                    )}

                    <Box
                      display="flex"
                      onClick={(e) => e.stopPropagation()}
                      gap={1}
                      alignItems="center"
                      flexWrap="wrap"
                      sx={{
                        flex: '0 1 auto',
                        maxWidth: '100%',
                        justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                        // На маленьких экранах всё "после названия" принудительно уходит на 2-ю строку.
                        flexBasis: { xs: '100%', sm: 'auto' },
                        mt: { xs: 0.5, sm: 0 },
                      }}
                    >
                        {editingHouseId !== house.houseId && canManageStructure && (
                            <Box 
                                component="span" 
                                onClick={() => {
                                    setEditingHouseId(house.houseId);
                                }}
                                sx={{ cursor: 'pointer', p: 1, color: 'rgba(255,255,255,0.7)', display: 'inline-flex' }}
                            >
                                <EditIcon fontSize="small" />
                            </Box>
                        )}
                        <Box 
                            sx={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                cursor: 'pointer', 
                                border: '1px solid rgba(255,255,255,0.3)', 
                                    borderRadius: '4px', 
                                    padding: '4px 10px',
                                    color: '#F08B5C',
                                    '&:hover': { backgroundColor: 'rgba(240,139,92,0.15)' },
                                    mr: 1
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHouseId(house.houseId);
                                fetchResidents(house.houseId);
                                setOpenResidentsDialog(true);
                            }}
                        >
                            <PeopleIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>Жильцы</Typography>
                        </Box>

                        {/* Кнопка Покинуть дом - для всех */}
                        <Tooltip title={isOwner ? "Покинуть дом (нужна передача прав)" : "Покинуть дом"}>
                            <Box 
                                sx={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    cursor: 'pointer', 
                                    p: 1,
                                    color: 'rgba(255,255,255,0.7)',
                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%' }
                                }}
                                onClick={(e) => { e.stopPropagation(); handleLeaveHouse(house.houseId, isOwner); }}
                            >
                                <ExitToAppIcon />
                            </Box>
                        </Tooltip>

                        {canManageStructure && (
                            <Box 
                                component="span" 
                                onClick={(e) => handleDeleteHouse(house.houseId, e as any)}
                                sx={{ cursor: 'pointer', p: 1, color: 'error.main', display: 'inline-flex' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </Box>
                        )}
                    </Box>
                </Box>
            </AccordionSummary>
            
            <AccordionDetails sx={{ bgcolor: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.8)' }}>Комнаты</Typography>
                    {canManageStructure && (
                        <Button startIcon={<AddIcon />} onClick={() => { setSelectedHouseId(house.houseId); setOpenRoomDialog(true); }}>
                    Добавить комнату
                  </Button>
                    )}
                </Box>
                
                {rooms[house.houseId]?.length === 0 && <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Комнат пока нет.</Typography>}
                
                  {rooms[house.houseId]?.map(room => (
                    <Accordion 
                        key={room.roomId}
                        expanded={expandedRoom === room.roomId}
                        onChange={handleExpandRoom(room.roomId)}
                        sx={{ mb: 1, boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                             <Box
                                display="flex"
                                alignItems="flex-start"
                                width="100%"
                                pr={2}
                                flexWrap="wrap"
                                gap={1}
                             >
                                <MeetingRoomIcon sx={{ mr: { xs: 0, sm: 2 }, color: 'rgba(255,255,255,0.7)' }} />
                                
                                {editingRoomId === room.roomId ? (
                                    <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                                        <InlineEdit
                                            initialValue={room.roomName}
                                            onSave={(val) => handleEditRoom(room.roomId, val)}
                                            onCancel={() => setEditingRoomId(null)}
                                        />
                                    </Box>
                                ) : (
                                    <Box
                                        sx={{
                                            flex: '1 1 240px',
                                            minWidth: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                color: '#fff',
                                                wordBreak: 'break-word',
                                                whiteSpace: 'normal',
                                                flex: '1 1 auto',
                                            }}
                                        >
                                            {room.roomName}
                                        </Typography>
                                        <Chip 
                                            label={`${allDevices.filter(d => d.roomId === room.roomId).length} устройств`} 
                                            size="small" 
                                            sx={{ height: 20, fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} 
                                        />
                                    </Box>
                                )}

                                <Box
                                    display="flex"
                                    onClick={(e) => e.stopPropagation()}
                                    gap={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    sx={{
                                        flex: '0 0 auto',
                                        maxWidth: '100%',
                                        justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                                        flexBasis: { xs: '100%', sm: 'auto' },
                                        mt: { xs: 0.5, sm: 0 },
                                    }}
                                >
                                    {editingRoomId !== room.roomId && canManageStructure && (
                                        <Box 
                                            component="span" 
                                            onClick={() => {
                                                setEditingRoomId(room.roomId);
                                            }}
                                            sx={{ cursor: 'pointer', p: 1, color: 'rgba(255,255,255,0.7)', display: 'inline-flex' }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </Box>
                                    )}
                                     {canManageDevices && (
                                        <>
                                            <Box 
                                                sx={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    cursor: 'pointer', 
                                                    border: '1px solid rgba(255,255,255,0.3)', 
                                                    borderRadius: '4px', 
                                                    padding: '4px 10px',
                                                    color: '#F08B5C',
                                                    mr: 1,
                                                    '&:hover': { backgroundColor: 'rgba(240,139,92,0.15)' }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRoomId(room.roomId);
                                                    setOpenDeviceDialog(true);
                                                }}
                                            >
                                                <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                                                <Typography variant="body2" sx={{ fontWeight: 500, color: '#fff' }}>Девайс</Typography>
                                            </Box>
                                            {canManageStructure && (
                                                <Box 
                                                    component="span" 
                                                    onClick={(e) => handleDeleteRoom(room.roomId, e as any)}
                                                    sx={{ cursor: 'pointer', p: 1, color: 'error.main', display: 'inline-flex' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </Box>
                                            )}
                                        </>
                                     )}
                                </Box>
                             </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ bgcolor: 'rgba(0,0,0,0.2)', pl: 4, color: '#fff' }}>
                            {allDevices.filter(d => d.roomId === room.roomId).length === 0 ? (
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Устройств нет</Typography>
                            ) : (
                                <Box>
                                    {allDevices.filter(d => d.roomId === room.roomId).map(device => (
                                        <Accordion 
                                            key={device.deviceId}
                                            expanded={expandedDevice === device.deviceId}
                                            onChange={handleExpandDevice(device.deviceId)}
                                            sx={{ mb: 1, border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.03)', color: '#fff' }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                                                <Box display="flex" alignItems="center" width="100%">
                                                    <RouterIcon sx={{ mr: 2, color: '#F08B5C' }} />
                                                    <Box>
                                                        <Typography variant="body1" fontWeight="medium" sx={{ color: '#fff' }}>{device.name}</Typography>
                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                                            {device.type} | IP: {device.ip || '-'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ bgcolor: 'rgba(0,0,0,0.15)', color: '#fff' }}>
                                                {canManageDevices ? (
                                                    <DeviceEditItem 
                                                        device={device}
                                                        deviceTypes={DEVICE_TYPES}
                                                        onSave={handleUpdateDevice}
                                                        onDelete={handleDeleteDevice}
                                                        onSchedule={handleOpenSchedule}
                                                    />
                                                ) : (
                                                    <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                                        Информация об устройстве доступна только владельцу или совладельцу.
                                                    </Typography>
                                                )}
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
              </Box>
                            )}
                        </AccordionDetails>
                    </Accordion>
        ))}
            </AccordionDetails>
          </Accordion>
          );
        })}
      </Box>

      {/* Диалог создания дома */}
      <Dialog open={openHouseDialog} onClose={() => {
          setOpenHouseDialog(false);
          setNewHouseAddress('');
          setNewHouseAddressError('');
      }}>
        <DialogTitle>Новый дом</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Адрес дома"
            fullWidth
            required
            value={newHouseAddress}
            onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 50) {
                    setNewHouseAddress(val);
                    if (val.trim() === '') {
                        setNewHouseAddressError('Адрес дома обязателен для заполнения');
                    } else {
                        setNewHouseAddressError('');
                    }
                }
            }}
            onBlur={() => {
                if (!newHouseAddress || newHouseAddress.trim() === '') {
                    setNewHouseAddressError('Адрес дома обязателен для заполнения');
                } else {
                    setNewHouseAddressError('');
                }
            }}
            error={!!newHouseAddressError}
            helperText={newHouseAddressError || `${newHouseAddress.length}/50`}
            inputProps={{ maxLength: 50 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
              setOpenHouseDialog(false);
              setNewHouseAddress('');
              setNewHouseAddressError('');
          }}>Отмена</Button>
          <Button onClick={handleCreateHouse} variant="contained" disabled={!!newHouseAddressError || !newHouseAddress || newHouseAddress.trim() === ''}>Создать</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания комнаты */}
      <Dialog open={openRoomDialog} onClose={() => {
          setOpenRoomDialog(false);
          setNewRoomName('');
          setNewRoomNameError('');
      }}>
        <DialogTitle>Новая комната</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название комнаты"
            fullWidth
            required
            value={newRoomName}
            onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 50) {
                    setNewRoomName(val);
                    if (val.trim() === '') {
                        setNewRoomNameError('Название комнаты обязательно для заполнения');
                    } else {
                        setNewRoomNameError('');
                    }
                }
            }}
            onBlur={() => {
                if (!newRoomName || newRoomName.trim() === '') {
                    setNewRoomNameError('Название комнаты обязательно для заполнения');
                } else {
                    setNewRoomNameError('');
                }
            }}
            error={!!newRoomNameError}
            helperText={newRoomNameError || `${newRoomName.length}/50`}
            inputProps={{ maxLength: 50 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
              setOpenRoomDialog(false);
              setNewRoomName('');
              setNewRoomNameError('');
          }}>Отмена</Button>
          <Button onClick={handleCreateRoom} variant="contained" disabled={!!newRoomNameError || !newRoomName || newRoomName.trim() === ''}>Создать</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания устройства */}
      <Dialog open={openDeviceDialog} onClose={() => {
          setOpenDeviceDialog(false);
          setDeviceFormNameError('');
          setDeviceFormIpError('');
          setDeviceFormManufacturerError('');
          setDeviceFormSerialNumberError('');
      }}>
        <DialogTitle>Новое устройство</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField 
              label="Название" 
              fullWidth 
              required
              value={deviceForm.name}
              onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 15) {
                      setDeviceForm({ ...deviceForm, name: val });
                      if (val.trim() === '') {
                          setDeviceFormNameError('Название устройства обязательно для заполнения');
                      } else {
                          setDeviceFormNameError('');
                      }
                  }
              }}
              onBlur={() => {
                  if (!deviceForm.name || deviceForm.name.trim() === '') {
                      setDeviceFormNameError('Название устройства обязательно для заполнения');
                  } else {
                      setDeviceFormNameError('');
                  }
              }}
              error={!!deviceFormNameError}
              helperText={deviceFormNameError || `${deviceForm.name.length}/15`}
              inputProps={{ maxLength: 15 }}
            />
            <FormControl fullWidth>
              <InputLabel>Тип</InputLabel>
              <Select
                value={deviceForm.type}
                label="Тип"
                onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value })}
              >
                {DEVICE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField 
              label="Производитель" 
              fullWidth 
              required
              value={deviceForm.manufacturer}
              onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 15) {
                      setDeviceForm({ ...deviceForm, manufacturer: val });
                      if (val.trim() === '') {
                          setDeviceFormManufacturerError('Производитель обязателен для заполнения');
                      } else {
                          setDeviceFormManufacturerError('');
                      }
                  }
              }}
              onBlur={() => {
                  if (!deviceForm.manufacturer || deviceForm.manufacturer.trim() === '') {
                      setDeviceFormManufacturerError('Производитель обязателен для заполнения');
                  } else {
                      setDeviceFormManufacturerError('');
                  }
              }}
              error={!!deviceFormManufacturerError}
              helperText={deviceFormManufacturerError || `${deviceForm.manufacturer.length}/15`}
              inputProps={{ maxLength: 15 }}
            />
            <TextField 
              label="Серийный номер" 
              fullWidth 
              required
              value={deviceForm.serialNumber}
              onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 50) {
                      setDeviceForm({ ...deviceForm, serialNumber: val });
                      if (val.trim() === '') {
                          setDeviceFormSerialNumberError('Серийный номер обязателен для заполнения');
                      } else {
                          setDeviceFormSerialNumberError('');
                      }
                  }
              }}
              onBlur={() => {
                  if (!deviceForm.serialNumber || deviceForm.serialNumber.trim() === '') {
                      setDeviceFormSerialNumberError('Серийный номер обязателен для заполнения');
                  } else {
                      setDeviceFormSerialNumberError('');
                  }
              }}
              error={!!deviceFormSerialNumberError}
              helperText={deviceFormSerialNumberError || `${deviceForm.serialNumber.length}/50`}
              inputProps={{ maxLength: 50 }}
            />
            <TextField 
              label="IP адрес" 
              fullWidth 
              value={deviceForm.ip}
              onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 15) {
                      setDeviceForm({ ...deviceForm, ip: val });
                      if (val && !validateIP(val)) {
                          setDeviceFormIpError('Неверный формат IP адреса (например: 192.168.1.1)');
                      } else {
                          setDeviceFormIpError('');
                      }
                  }
              }}
              onBlur={() => {
                  if (deviceForm.ip && !validateIP(deviceForm.ip)) {
                      setDeviceFormIpError('Неверный формат IP адреса (например: 192.168.1.1)');
                  } else {
                      setDeviceFormIpError('');
                  }
              }}
              error={!!deviceFormIpError}
              helperText={deviceFormIpError}
              inputProps={{ maxLength: 15 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
              setOpenDeviceDialog(false);
              setDeviceFormNameError('');
              setDeviceFormIpError('');
              setDeviceFormManufacturerError('');
              setDeviceFormSerialNumberError('');
          }}>Отмена</Button>
          <Button 
            onClick={handleCreateDevice} 
            variant="contained"
            disabled={!!deviceFormNameError || !!deviceFormIpError || !!deviceFormManufacturerError || !!deviceFormSerialNumberError ||
                     !deviceForm.name || deviceForm.name.trim() === '' ||
                     !deviceForm.manufacturer || deviceForm.manufacturer.trim() === '' ||
                     !deviceForm.serialNumber || deviceForm.serialNumber.trim() === ''}
          >
            Добавить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления жильцами */}
      <Dialog open={openResidentsDialog} onClose={() => setOpenResidentsDialog(false)} fullWidth maxWidth="md">
          <DialogTitle>Жильцы дома</DialogTitle>
          <DialogContent>
              {/* Добавление жильца - Только для Owner/Admin */}
              {(() => {
                const currentHouse = houses.find(h => h.houseId === selectedHouseId);
                const role = currentHouse?.currentUserRole;
                const isMember = role === 'owner' || role === 'admin' || role === 'inviter';
                const globalAdminNotInHouse = user?.role === 'admin' && !role;
                return isMember && !globalAdminNotInHouse;
              })() && (
                  <Box display="flex" gap={1} mt={1} mb={2}>
                      <TextField 
                          label="Email пользователя" 
                          size="small" 
                          fullWidth 
                          value={newResidentEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.length <= 50) {
                              setNewResidentEmail(val);
                            }
                          }}
                          inputProps={{ maxLength: 50 }}
                      />
                      <Button variant="contained" onClick={handleAddResident}>Добавить</Button>
                  </Box>
              )}
              
              <List>
                  {residents.map(res => {
                      // Используем роль из объекта дома, а не ищем себя в списке жильцов
                      const currentHouse = houses.find(h => h.houseId === selectedHouseId);
                      const myRole = currentHouse?.currentUserRole;
                      
                      const amIOwner = myRole === 'owner';
                      const amIAdmin = myRole === 'admin';
                      // Глобальный админ, не добавленный в дом, не управляет жильцами (нет кнопок пригласить/удалить)
                      const canManage = (amIOwner || amIAdmin) && !(user?.role === 'admin' && !currentHouse?.currentUserRole);

                      const isTargetOwner = res.role === 'owner';
                      const isTargetAdmin = res.role === 'admin';
                      const isMe = res.userId === user?.userId;

                      return (
                      <ListItem key={res.userId} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.15)', py: 2 }}>
                          <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                              <ListItemText 
                                  primary={
                                      <Typography variant="subtitle1">
                                          {res.username} ({res.email})
                                          {isMe && <Chip label="Вы" size="small" color="primary" sx={{ ml: 1 }} />}
                                          {res.role === 'owner' && <Chip label="Владелец" size="small" color="warning" sx={{ ml: 1 }} />}
                                          {res.role === 'admin' && <Chip label="Совладелец" size="small" color="secondary" sx={{ ml: 1 }} />}
                                      </Typography>
                                  } 
                                  secondary={`Роль: ${res.role}`} 
                              />
                              
                              <Box>
                                  {canManage && !isTargetOwner && !isTargetAdmin && !isMe && (
                                      <Button size="small" startIcon={<SettingsIcon />} onClick={() => handleOpenPermissions(res)}>
                                          Права
                                      </Button>
                                  )}
                                  {/* Глобальный админ в чужом доме: только передача владения владельцем одному из совладельцев */}
                                  {user?.role === 'admin' && !amIOwner && isTargetOwner && (
                                      <Button size="small" variant="outlined" color="primary" onClick={() => setTransferToNewOwnerDialog(true)}>
                                          Передать владение
                                      </Button>
                                  )}
                              </Box>
                          </Box>

                          {(amIOwner || amIAdmin) && !isMe && !isTargetOwner && (
                              <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                                  {/* Только владелец может назначать совладельцев */}
                                  {amIOwner && res.role !== 'admin' && (
                                      <Button size="small" variant="outlined" onClick={() => handleUpdateUserRole(res.userId, 'admin')}>
                                          Сделать совладельцем
                                      </Button>
                                  )}
                                  
                                  {/* Кнопка управления приглашениями доступна и владельцу, и совладельцу, но только для НЕ совладельцев */}
                                  {res.role !== 'admin' && (
                                    <Button 
                                        size="small" 
                                        variant="outlined" 
                                        color={res.role === 'inviter' ? "warning" : "primary"}
                                        onClick={() => handleUpdateUserRole(res.userId, res.role === 'inviter' ? 'member' : 'inviter')}
                                    >
                                        {res.role === 'inviter' ? 'Запретить приглашать' : 'Разрешить приглашать'}
                                    </Button>
                                  )}

                                  {/* Только владелец может разжаловать совладельца */}
                                  {amIOwner && res.role === 'admin' && (
                                      <Button size="small" variant="outlined" color="warning" onClick={() => handleUpdateUserRole(res.userId, 'member')}>
                                          Разжаловать
                                      </Button>
                                  )}
                                  
                                  {/* Только владелец может передать владение */}
                                  {amIOwner && (
                                      <Button size="small" variant="outlined" color="error" onClick={() => handleTransferOwnership(res.userId)}>
                                          Передать владение
                                      </Button>
                                  )}

                                   {/* Удаление доступно владельцу и совладельцу (совладелец не может удалить владельца и других совладельцев - проверено на бэке, но скроем кнопку) */}
                                   {((amIOwner) || (amIAdmin && res.role !== 'admin')) && (
                                      <Button size="small" variant="outlined" color="error" onClick={() => handleRemoveResident(res.userId)}>
                                        Удалить
                                      </Button>
                                   )}
                              </Box>
                          )}
                      </ListItem>
                      );
                  })}
              </List>
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOpenResidentsDialog(false)}>Закрыть</Button>
          </DialogActions>
      </Dialog>

      {/* Диалог выбора нового владельца (для глобального админа) */}
      <Dialog open={transferToNewOwnerDialog} onClose={() => setTransferToNewOwnerDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Передать владение</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Выберите совладельца, который станет новым владельцем дома.
          </Typography>
          <List dense>
            {residents.filter(r => r.role === 'admin').map(r => (
              <ListItem key={r.userId}>
                <ListItemText primary={r.username} secondary={r.email} />
                <Button size="small" variant="outlined" onClick={async () => {
                  if (!window.confirm('Передать владение этому совладельцу? Текущий владелец станет совладельцем.')) return;
                  setTransferToNewOwnerDialog(false);
                  await handleTransferOwnership(r.userId, true);
                }}>Выбрать</Button>
              </ListItem>
            ))}
          </List>
          {residents.filter(r => r.role === 'admin').length === 0 && (
            <Typography color="text.secondary">Нет совладельцев. Сначала владелец должен назначить кого-то совладельцем.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferToNewOwnerDialog(false)}>Отмена</Button>
        </DialogActions>
      </Dialog>
      
      {/* Диалог управления правами */}
      <Dialog open={openPermissionsDialog} onClose={() => setOpenPermissionsDialog(false)} fullWidth sx={{ zIndex: 2000 }}>
          <DialogTitle>Права доступа: {selectedResident?.username}</DialogTitle>
          <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                  Настройте доступ к конкретным устройствам в доме.
              </Typography>
              {houseDevices.length === 0 ? (
                  <Box py={2} display="flex" justifyContent="center">
                      <Typography color="text.secondary">Нет устройств или загрузка...</Typography>
                  </Box>
              ) : (
              <List>
                  {houseDevices.map(dev => (
                      <ListItem key={dev.deviceId}>
                          <ListItemText primary={dev.name} secondary={`${dev.type} (${dev.roomName})`} />
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                              <InputLabel>Доступ</InputLabel>
                              <Select
                                  label="Доступ"
                                  value={residentPermissions[dev.deviceId] || 'none'}
                                  onChange={(e) => handleUpdatePermission(dev.deviceId, e.target.value)}
                                  MenuProps={{ sx: { zIndex: 2001 } }}
                              >
                                  <MenuItem value="none">Нет</MenuItem>
                                  <MenuItem value="viewer">Просмотр</MenuItem>
                                  <MenuItem value="user">Управление</MenuItem>
                              </Select>
                          </FormControl>
                      </ListItem>
                  ))}
              </List>
              )}
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setOpenPermissionsDialog(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {selectedDevice && (
        <ScheduleDialog 
            open={openScheduleDialog} 
            onClose={() => setOpenScheduleDialog(false)} 
            deviceId={selectedDevice.deviceId} 
            deviceName={selectedDevice.name}
            deviceType={selectedDevice.type}
        />
      )}

    </GlassPage>
  );
};
