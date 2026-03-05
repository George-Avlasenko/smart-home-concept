import React, { useEffect, useState } from 'react';
import { Typography, Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Alert, Select, MenuItem, FormControl, InputLabel, Snackbar, Accordion, AccordionSummary, AccordionDetails, Chip, List, ListItem, ListItemText, Tooltip, Checkbox, FormControlLabel, Switch, FormGroup } from '@mui/material';
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
                    sx={{ cursor: 'pointer', p: 1, color: 'primary.main', display: 'inline-flex' }}
                >
                    <CheckIcon fontSize="small" />
                </Box>
                <Box 
                    component="span" 
                    onClick={() => {
                        setError('');
                        onCancel();
                    }}
                    sx={{ cursor: 'pointer', p: 1, color: 'text.secondary', display: 'inline-flex' }}
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
    { value: 'thermostat', label: 'Термостат' },
    { value: 'switch', label: 'Выключатель' },
    { value: 'outlet', label: 'Розетка' },
    { value: 'kettle', label: 'Чайник' },
    { value: 'vacuum', label: 'Робот-пылесос' },
    { value: 'curtain', label: 'Шторы' },
    { value: 'camera', label: 'Камера' },
    { value: 'window', label: 'Окно' },
    { value: 'sensor', label: 'Датчик' },
    { value: 'lock', label: 'Замок' }
  ];

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchHouses();
    fetchDevices();
  }, []);

  // Подписка на события через SSE
  useSSE({
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
      setHouses(res.data);
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

  const handleTransferOwnership = async (newOwnerId: number) => {
      if (!selectedHouseId) return;
      if (!window.confirm('Вы уверены? Вы потеряете полные права на дом и станете совладельцем.')) return;
      try {
          await api.post(`/houses/${selectedHouseId}/users/transfer/${newOwnerId}`);
          setOpenResidentsDialog(false);
          fetchHouses(); 
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
               await api.post('/permissions', {
                  userId: selectedResident.userId,
                  deviceId,
                  permissionLevel: 'viewer' 
              });
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
    <Box sx={{ mt: 4, width: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Управление домами</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenHouseDialog(true)}>
          Добавить дом
        </Button>
      </Box>

      <Snackbar 
          open={!!error || !!successMessage} 
          autoHideDuration={4000} 
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={error ? "error" : "success"} sx={{ width: '100%' }}>
          {error || successMessage}
        </Alert>
      </Snackbar>

      <Box>
        {houses.map(house => {
          const isOwner = house.currentUserRole === 'owner';
          const isAdmin = house.currentUserRole === 'admin';
          const isSystemAdmin = user?.role === 'admin'; // Админ системы имеет полный доступ
          const canManageStructure = isOwner || isSystemAdmin;
          const canManageDevices = isOwner || isAdmin || isSystemAdmin;

          return (
          <Accordion 
              key={house.houseId} 
              expanded={expandedHouse === house.houseId} 
              onChange={handleExpandHouse(house.houseId)}
              sx={{ mb: 2, border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" width="100%" pr={2}>
                    <HomeIcon color="primary" sx={{ mr: 2 }} />
                    
                    {editingHouseId === house.houseId ? (
                        <InlineEdit
                            initialValue={house.address}
                            onSave={(val) => handleEditHouse(house.houseId, val)}
                            onCancel={() => setEditingHouseId(null)}
                        />
                    ) : (
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>{house.address}</Typography>
                    )}

                    <Box display="flex" onClick={(e) => e.stopPropagation()} gap={1} alignItems="center">
                        {editingHouseId !== house.houseId && canManageStructure && (
                            <Box 
                                component="span" 
                                onClick={() => {
                                    setEditingHouseId(house.houseId);
                                }}
                                sx={{ cursor: 'pointer', p: 1, color: 'text.secondary', display: 'inline-flex' }}
                            >
                                <EditIcon fontSize="small" />
                            </Box>
                        )}
                        <Box 
                            sx={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                cursor: 'pointer', 
                                border: '1px solid rgba(0, 0, 0, 0.23)', 
                                borderRadius: '4px', 
                                padding: '4px 10px',
                                color: 'primary.main',
                                '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)' },
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
                                    color: 'text.secondary',
                                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)', borderRadius: '50%' }
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
            
            <AccordionDetails sx={{ bgcolor: '#fcfcfc', borderTop: '1px solid #eee' }}>
                {/* ... Контент аккордеона ... */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" color="text.secondary">Комнаты</Typography>
                    {canManageStructure && (
                        <Button startIcon={<AddIcon />} onClick={() => { setSelectedHouseId(house.houseId); setOpenRoomDialog(true); }}>
                    Добавить комнату
                  </Button>
                    )}
                </Box>
                
                {rooms[house.houseId]?.length === 0 && <Typography color="text.secondary">Комнат пока нет.</Typography>}
                
                  {rooms[house.houseId]?.map(room => (
                    <Accordion 
                        key={room.roomId}
                        expanded={expandedRoom === room.roomId}
                        onChange={handleExpandRoom(room.roomId)}
                        sx={{ mb: 1, boxShadow: 'none', border: '1px solid #eee' }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                             <Box display="flex" alignItems="center" width="100%" pr={2}>
                                <MeetingRoomIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                
                                {editingRoomId === room.roomId ? (
                                    <InlineEdit
                                        initialValue={room.roomName}
                                        onSave={(val) => handleEditRoom(room.roomId, val)}
                                        onCancel={() => setEditingRoomId(null)}
                                    />
                                ) : (
                                    <Box flexGrow={1} display="flex" alignItems="center">
                                        <Typography variant="subtitle1">{room.roomName}</Typography>
                                        <Chip 
                                            label={`${allDevices.filter(d => d.roomId === room.roomId).length} устройств`} 
                                            size="small" 
                                            sx={{ ml: 2, height: 20, fontSize: '0.75rem' }} 
                                        />
                                    </Box>
                                )}

                                <Box display="flex" onClick={(e) => e.stopPropagation()} gap={1} alignItems="center">
                                    {editingRoomId !== room.roomId && canManageStructure && (
                                        <Box 
                                            component="span" 
                                            onClick={() => {
                                                setEditingRoomId(room.roomId);
                                            }}
                                            sx={{ cursor: 'pointer', p: 1, color: 'text.secondary', display: 'inline-flex' }}
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
                                                    border: '1px solid rgba(0, 0, 0, 0.23)', 
                                                    borderRadius: '4px', 
                                                    padding: '4px 10px',
                                                    color: 'primary.main',
                                                    mr: 1,
                                                    '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)' }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRoomId(room.roomId);
                                                    setOpenDeviceDialog(true);
                                                }}
                                            >
                                                <AddIcon fontSize="small" sx={{ mr: 0.5 }} />
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>Девайс</Typography>
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
                        <AccordionDetails sx={{ bgcolor: '#fff', pl: 4 }}>
                            {allDevices.filter(d => d.roomId === room.roomId).length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Устройств нет</Typography>
                            ) : (
                                <Box>
                                    {allDevices.filter(d => d.roomId === room.roomId).map(device => (
                                        <Accordion 
                                            key={device.deviceId}
                                            expanded={expandedDevice === device.deviceId}
                                            onChange={handleExpandDevice(device.deviceId)}
                                            sx={{ mb: 1, border: '1px solid #f0f0f0', boxShadow: 'none' }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Box display="flex" alignItems="center" width="100%">
                                                    <RouterIcon sx={{ mr: 2, color: 'primary.light' }} />
                                                    <Box>
                                                        <Typography variant="body1" fontWeight="medium">{device.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {device.type} | IP: {device.ip || '-'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ bgcolor: '#fafafa' }}>
                                                {canManageDevices ? (
                                                    <DeviceEditItem 
                                                        device={device}
                                                        deviceTypes={DEVICE_TYPES}
                                                        onSave={handleUpdateDevice}
                                                        onDelete={handleDeleteDevice}
                                                        onSchedule={handleOpenSchedule}
                                                    />
                                                ) : (
                                                    <Typography color="text.secondary">
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
              {(houses.find(h => h.houseId === selectedHouseId)?.currentUserRole === 'owner' || 
                houses.find(h => h.houseId === selectedHouseId)?.currentUserRole === 'admin' ||
                houses.find(h => h.houseId === selectedHouseId)?.currentUserRole === 'inviter') && (
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
                      const canManage = amIOwner || amIAdmin;

                      const isTargetOwner = res.role === 'owner';
                      const isTargetAdmin = res.role === 'admin';
                      const isMe = res.userId === user?.userId;

                      return (
                      <ListItem key={res.userId} sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee', py: 2 }}>
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
      
      {/* Диалог управления правами */}
      <Dialog 
        open={openPermissionsDialog} 
        onClose={() => setOpenPermissionsDialog(false)} 
        fullWidth 
        sx={{ zIndex: 2000 }}
      >
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

    </Box>
  );
};
