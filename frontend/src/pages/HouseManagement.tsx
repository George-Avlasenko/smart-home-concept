import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Select, MenuItem, FormControl, InputLabel, Accordion, AccordionSummary, AccordionDetails, Chip, List, ListItem, ListItemButton, ListItemText, Tooltip, Checkbox, FormControlLabel, Switch, FormGroup, Divider, Alert, CircularProgress } from '@mui/material';
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
import type { House, Room, HouseUser, UserDevicePermission, Device, DeviceSchedule, SupportedDeviceProduct } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../hooks/useSSE';

type NetworkDiscoveredRow = {
  device_id: string;
  ip?: string;
  version?: string;
  product_key?: string;
  /** Из Tuya Cloud при настроенных интеграциях */
  cloud_product_name?: string;
  matched_catalog_sku?: string;
  matched_catalog_label?: string;
  guessedSku?: string;
  guessedDisplayName?: string;
  guessedCategory?: string;
  guessedFeatures?: string[];
};

/** Игнорировать клики по карточкам каталога сразу после открытия диалога (mouseup «пробивает» на первый элемент). */
const DEVICE_DIALOG_CATALOG_CLICK_GUARD_MS = 450;

/** Фиксированный порядок категорий в диалоге добавления (не порядок из ответа API). */
const CATALOG_CATEGORY_ORDER = [
  'Освещение',
  'Климат',
  'Камеры',
  'Бытовая техника',
  'Энергия',
  'Безопасность',
  'Прочее',
];

function sortCatalogCategoryLabels(categories: string[]): string[] {
  const uniq = Array.from(new Set(categories.map((c) => (c || 'Прочее').trim() || 'Прочее')));
  const ordered = CATALOG_CATEGORY_ORDER.filter((c) => uniq.includes(c));
  const rest = uniq.filter((c) => !CATALOG_CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, 'ru'));
  return [...ordered, ...rest];
}

/** Вторая строка карточки и подписи: лейбл модели и производитель без дубля «Tuya». */
function catalogProductSubtitle(p: SupportedDeviceProduct): string {
  const bits: string[] = [];
  if (p.tuyaProductLabel?.trim()) bits.push(p.tuyaProductLabel.trim());
  const m = (p.manufacturer || '').trim();
  if (m && (!p.tuyaProductLabel || !p.tuyaProductLabel.toLowerCase().includes(m.toLowerCase()))) {
    bits.push(m);
  }
  return bits.join(' · ');
}

function normalizeDiscoveryName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
}

function stripVendorPrefix(s: string): string {
  return s.trim().replace(/^tuya\s+/i, '');
}

function messageFromDeviceApiBody(o: Record<string, unknown>): string {
  if (typeof o.detail === 'string' && o.detail.trim()) return o.detail.trim();
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  const errors = o.errors;
  if (errors && typeof errors === 'object' && errors !== null) {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
      if (Array.isArray(v)) lines.push(...v.map((x) => `${k}: ${String(x)}`));
      else lines.push(`${k}: ${String(v)}`);
    }
    if (lines.length) return lines.join(' ');
  }
  if (typeof o.title === 'string' && o.title.trim()) return o.title.trim();
  return '';
}

/** Ответ 400/500 API: ProblemDetails, FluentValidation, строка или JSON-строка. */
function formatDeviceApiError(err: unknown): string {
  const ax = err as { response?: { data?: unknown; statusText?: string } };
  const res = ax.response;
  const data = res?.data;
  if (typeof data === 'string') {
    const t = data.trim();
    if (!t) return res?.statusText || 'Ошибка запроса';
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as Record<string, unknown>;
        const msg = messageFromDeviceApiBody(parsed);
        if (msg) return msg;
      } catch {
        /* ignore */
      }
    }
    return t;
  }
  if (data && typeof data === 'object') {
    const msg = messageFromDeviceApiBody(data as Record<string, unknown>);
    if (msg) return msg;
  }
  return res?.statusText || 'Ошибка добавления устройства';
}

interface DeviceEditItemProps {
    device: Device;
    deviceCatalog: SupportedDeviceProduct[];
    typeLabels: { value: string; label: string }[];
    onSave: (deviceId: number, data: { name: string; hardwareDeviceId: string; ip: string }) => Promise<void>;
    onDelete: (deviceId: number) => void;
    onSchedule: (device: Device) => void;
}

const DeviceEditItem = ({ device, deviceCatalog, typeLabels, onSave, onDelete, onSchedule }: DeviceEditItemProps) => {
    const [localForm, setLocalForm] = useState({
        name: device.name,
        hardwareDeviceId: device.hardwareDeviceId || '',
        ip: device.ip || ''
    });

    useEffect(() => {
        setLocalForm({
            name: device.name,
            hardwareDeviceId: device.hardwareDeviceId || '',
            ip: device.ip || ''
        });
    }, [device.deviceId, device.name, device.hardwareDeviceId, device.ip]);

    const sku = device.productSku || (device.settings && typeof device.settings.catalogSku === 'string' ? device.settings.catalogSku : '');
    const catalogProduct = deviceCatalog.find((p) => p.sku === sku);
    const typeLabel = typeLabels.find((t) => t.value === device.type)?.label ?? device.type;

    const [ipError, setIpError] = useState('');
    const [nameError, setNameError] = useState('');
    const [hardwareDeviceIdError, setHardwareDeviceIdError] = useState('');

    const validateIP = (ip: string): boolean => {
        if (!ip || ip.trim() === '') return true; // Пустой IP допустим
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    };

    return (
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={2}>
            <Box gridColumn="1 / -1">
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }}>
                    {catalogProduct
                        ? `${catalogProduct.displayName} — ${catalogProductSubtitle(catalogProduct)}`
                        : `${typeLabel}${device.manufacturer ? ` · ${device.manufacturer}` : ''}`}
                </Typography>
            </Box>
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
            <Box gridColumn="1 / -1">
                <TextField
                    label="Device ID"
                    fullWidth
                    size="small"
                    required
                    value={localForm.hardwareDeviceId}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 100) {
                            setLocalForm({ ...localForm, hardwareDeviceId: val });
                            if (val.trim() === '') {
                                setHardwareDeviceIdError('Укажите идентификатор устройства');
                            } else {
                                setHardwareDeviceIdError('');
                            }
                        }
                    }}
                    onBlur={() => {
                        if (!localForm.hardwareDeviceId || localForm.hardwareDeviceId.trim() === '') {
                            setHardwareDeviceIdError('Укажите идентификатор устройства');
                        } else {
                            setHardwareDeviceIdError('');
                        }
                    }}
                    error={!!hardwareDeviceIdError}
                    helperText={hardwareDeviceIdError || `${localForm.hardwareDeviceId.length}/100`}
                    inputProps={{ maxLength: 100, 'aria-label': 'Device ID устройства' }}
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
                            if (!localForm.hardwareDeviceId || localForm.hardwareDeviceId.trim() === '') {
                                setHardwareDeviceIdError('Укажите идентификатор устройства');
                                return;
                            }
                            if (localForm.ip && !validateIP(localForm.ip)) {
                                setIpError('Неверный формат IP адреса (например: 192.168.1.1)');
                                return;
                            }
                            setNameError('');
                            setHardwareDeviceIdError('');
                            setIpError('');
                            onSave(device.deviceId, {
                                name: localForm.name.trim(),
                                hardwareDeviceId: localForm.hardwareDeviceId.trim(),
                                ip: localForm.ip.trim(),
                            });
                        }}
                        disabled={!!ipError || !!nameError || !!hardwareDeviceIdError ||
                                 !localForm.name || localForm.name.trim() === '' ||
                                 !localForm.hardwareDeviceId || localForm.hardwareDeviceId.trim() === ''}
                    >
                        Сохранить
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const InlineEdit = React.memo(function InlineEdit({
  initialValue,
  onSave,
  onCancel,
  maxLength = 50,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  maxLength?: number;
}) {
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
});

/** Локальное состояние — ввод не перерисовывает весь HouseManagement. */
const CreateHouseDialog = React.memo(function CreateHouseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAddress('');
    setAddressError('');
  }, [open]);

  const handleCreate = async () => {
    if (!address || address.trim() === '') {
      setAddressError('Адрес дома обязателен для заполнения');
      return;
    }
    setAddressError('');
    try {
      await api.post('/houses', { address: address.trim() });
      onClose();
      await onCreated();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; title?: string; message?: string } | string } };
      const data = ax.response?.data;
      const errorMsg =
        typeof data === 'string' ? data : data?.error || data?.title || data?.message || 'Ошибка создания дома';
      setAddressError(errorMsg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setAddress('');
        setAddressError('');
        onClose();
      }}
    >
      <DialogTitle>Новый дом</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Адрес дома"
          fullWidth
          required
          value={address}
          onChange={(e) => {
            const val = e.target.value;
            if (val.length <= 50) {
              setAddress(val);
              setAddressError(val.trim() === '' ? 'Адрес дома обязателен для заполнения' : '');
            }
          }}
          onBlur={() => {
            if (!address || address.trim() === '') setAddressError('Адрес дома обязателен для заполнения');
            else setAddressError('');
          }}
          error={!!addressError}
          helperText={addressError || `${address.length}/50`}
          inputProps={{ maxLength: 50 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setAddress('');
            setAddressError('');
            onClose();
          }}
        >
          Отмена
        </Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={!!addressError || !address.trim()}>
          Создать
        </Button>
      </DialogActions>
    </Dialog>
  );
});

const CreateRoomDialog = React.memo(function CreateRoomDialog({
  open,
  houseId,
  onClose,
  onCreated,
}: {
  open: boolean;
  houseId: number | null;
  onClose: () => void;
  onCreated: (hid: number) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setNameError('');
  }, [open]);

  const handleCreate = async () => {
    if (houseId == null) return;
    if (!name || name.trim() === '') {
      setNameError('Название комнаты обязательно для заполнения');
      return;
    }
    setNameError('');
    try {
      await api.post('/rooms', { houseId, roomName: name.trim(), floor: 1 });
      onClose();
      await onCreated(houseId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; title?: string; message?: string } | string } };
      const data = ax.response?.data;
      const errorMsg =
        typeof data === 'string' ? data : data?.error || data?.title || data?.message || 'Ошибка создания комнаты';
      setNameError(errorMsg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setName('');
        setNameError('');
        onClose();
      }}
    >
      <DialogTitle>Новая комната</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Название комнаты"
          fullWidth
          required
          value={name}
          onChange={(e) => {
            const val = e.target.value;
            if (val.length <= 50) {
              setName(val);
              setNameError(val.trim() === '' ? 'Название комнаты обязательно для заполнения' : '');
            }
          }}
          onBlur={() => {
            if (!name || name.trim() === '') setNameError('Название комнаты обязательно для заполнения');
            else setNameError('');
          }}
          error={!!nameError}
          helperText={nameError || `${name.length}/50`}
          inputProps={{ maxLength: 50 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setName('');
            setNameError('');
            onClose();
          }}
        >
          Отмена
        </Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={!!nameError || !name.trim()}>
          Создать
        </Button>
      </DialogActions>
    </Dialog>
  );
});

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
  const deviceDialogOpenedAtRef = useRef(0);
  const [openResidentsDialog, setOpenResidentsDialog] = useState(false);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [transferToNewOwnerDialog, setTransferToNewOwnerDialog] = useState(false);
  const [openCatalogRequestDialog, setOpenCatalogRequestDialog] = useState(false);
  
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedResident, setSelectedResident] = useState<HouseUser | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Данные для модалок
  const [residents, setResidents] = useState<HouseUser[]>([]);
  const [houseDevices, setHouseDevices] = useState<Device[]>([]);
  const [residentPermissions, setResidentPermissions] = useState<Record<number, string>>({});
  const [schedules, setSchedules] = useState<DeviceSchedule[]>([]);
  const [deviceCatalog, setDeviceCatalog] = useState<SupportedDeviceProduct[]>([]);

  // Формы
  const [newResidentEmail, setNewResidentEmail] = useState('');
  const [newSchedule, setNewSchedule] = useState({
      time: '08:00',
      days: [] as number[],
      action: true
  });
  
  // Для инлайн редактирования
  const [editingHouseId, setEditingHouseId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  // Форма девайса (модель из каталога + свой Device ID)
  const DEFAULT_DEVICE_FORM = {
    productSku: '',
    name: '',
    hardwareDeviceId: '',
    ip: '',
  };

  const [deviceForm, setDeviceForm] = useState(DEFAULT_DEVICE_FORM);
  const [deviceFormIpError, setDeviceFormIpError] = useState('');
  const [deviceFormNameError, setDeviceFormNameError] = useState('');
  const [deviceFormProductSkuError, setDeviceFormProductSkuError] = useState('');
  const [deviceFormHardwareIdError, setDeviceFormHardwareIdError] = useState('');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [networkFoundDevices, setNetworkFoundDevices] = useState<NetworkDiscoveredRow[] | null>(null);
  const [discoveredDevice, setDiscoveredDevice] = useState<{ hardwareDeviceId: string; ip?: string; version?: string; source: 'real' | 'virtual' } | null>(null);
  const [deviceDiscoveryError, setDeviceDiscoveryError] = useState('');
  const [deviceAddInProgress, setDeviceAddInProgress] = useState(false);
  const DEFAULT_CONSOLE_TUYA = { deviceId: '', localKey: '', ip: '', version: '3.5', dps: '20' };
  const [consoleTuyaForm, setConsoleTuyaForm] = useState(DEFAULT_CONSOLE_TUYA);
  const [openManualTuyaDialog, setOpenManualTuyaDialog] = useState(false);
  const [catalogRequestForm, setCatalogRequestForm] = useState({
    category: '',
    deviceKind: '',
    connectivity: '',
    lightMode: '',
    contact: '',
    comment: '',
  });
  const [catalogRequestError, setCatalogRequestError] = useState('');

  const devicesByRoomId = useMemo(() => {
    const m = new Map<number, Device[]>();
    for (const d of allDevices) {
      const list = m.get(d.roomId);
      if (list) list.push(d);
      else m.set(d.roomId, [d]);
    }
    return m;
  }, [allDevices]);

  const catalogCategories = useMemo(
    () => sortCatalogCategoryLabels(deviceCatalog.map((x) => x.category || 'Прочее')),
    [deviceCatalog]
  );
  const filteredCatalogProducts = useMemo(
    () => deviceCatalog.filter((x) => (x.category || 'Прочее') === selectedCatalogCategory),
    [deviceCatalog, selectedCatalogCategory]
  );
  const groupedCatalogProducts = useMemo(() => {
    const cat = selectedCatalogCategory || '';
    if (cat === 'Освещение') {
      const lightGroupKey = (p: SupportedDeviceProduct) => {
        const text = `${p.displayName} ${p.suggestedName}`.toLowerCase();
        if (text.includes('настольн')) return 'Настольные лампы';
        if (text.includes('лента') || text.includes('strip')) return 'Светодиодные ленты';
        if (text.includes('гирлянд')) return 'Гирлянды';
        if (text.includes('потолоч')) return 'Потолочные светильники';
        if (text.includes('ламп')) return 'Лампы';
        return 'Прочее освещение';
      };
      const order = [
        'Лампы',
        'Настольные лампы',
        'Светодиодные ленты',
        'Гирлянды',
        'Потолочные светильники',
        'Прочее освещение',
      ];
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const key = lightGroupKey(p);
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }
    if (cat === 'Безопасность') {
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const text = `${p.displayName} ${p.suggestedName}`.toLowerCase();
        const key = text.includes('окн') || text.includes('замок') ? 'Активная' : 'Пассивная';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      const order = ['Активная', 'Пассивная'];
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }
    if (cat === 'Камеры') {
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const feats = (p.features ?? []).map((f) => f.toUpperCase());
        const key = feats.includes('MIC') ? 'MIC' : 'NMIC';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      const order = ['MIC', 'NMIC'];
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }
    if (cat === 'Энергия') {
      const energyGroupKey = (p: SupportedDeviceProduct) => {
        const text = `${p.displayName} ${p.suggestedName}`.toLowerCase();
        if (text.includes('автомат')) return 'Автоматические выключатели';
        if (text.includes('электроэнерг')) return 'Счётчики электроэнергии';
        if (text.includes('воды')) return 'Счётчики воды';
        if (text.includes('газа')) return 'Счётчики газа';
        return 'Прочее';
      };
      const order = [
        'Автоматические выключатели',
        'Счётчики электроэнергии',
        'Счётчики воды',
        'Счётчики газа',
        'Прочее',
      ];
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const key = energyGroupKey(p);
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }

    if (cat === 'Климат') {
      const climateGroupKey = (p: SupportedDeviceProduct) => {
        const text = `${p.displayName} ${p.suggestedName}`.toLowerCase();
        if (text.includes('кондиц')) return 'Кондиционеры';
        if (text.includes('увлажн')) return 'Увлажнители';
        if (text.includes('вентил')) return 'Вентиляция';
        if (text.includes('датчик')) return 'Климатические датчики';
        return 'Прочее';
      };
      const order = ['Кондиционеры', 'Увлажнители', 'Вентиляция', 'Климатические датчики', 'Прочее'];
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const key = climateGroupKey(p);
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }

    if (cat === 'Бытовая техника') {
      const homeGroupKey = (p: SupportedDeviceProduct) => {
        const text = `${p.displayName} ${p.suggestedName}`.toLowerCase();
        if (text.includes('выключател')) return 'Выключатели';
        if (text.includes('розетк')) return 'Розетки';
        if (text.includes('чайник')) return 'Чайники';
        if (text.includes('пылесос')) return 'Пылесосы';
        return 'Прочее';
      };
      const order = ['Выключатели', 'Розетки', 'Чайники', 'Пылесосы', 'Прочее'];
      const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
        const key = homeGroupKey(p);
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});
      return order.filter((k) => grouped[k]?.length).map((k) => ({ title: k, items: grouped[k] }));
    }

    const localizeType = (type?: string) => {
      const t = (type ?? '').trim().toLowerCase();
      if (!t) return 'Прочее';
      if (t === 'curtain') return 'Шторы';
      if (t === 'sensor') return 'Датчики';
      if (t === 'switch') return 'Выключатели';
      if (t === 'outlet') return 'Розетки';
      if (t === 'camera') return 'Камеры';
      if (t === 'lock') return 'Замки';
      if (t === 'window') return 'Окна';
      if (t === 'thermostat') return 'Кондиционеры';
      if (t === 'humidifier') return 'Увлажнители';
      if (t === 'ventilation') return 'Вентиляция';
      if (t === 'light') return 'Освещение';
      return t;
    };
    const grouped = filteredCatalogProducts.reduce<Record<string, SupportedDeviceProduct[]>>((acc, p) => {
      const key = localizeType(p.type);
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ru')).map((k) => ({ title: k, items: grouped[k] }));
  }, [filteredCatalogProducts, selectedCatalogCategory]);

  const selectedCatalogProduct = useMemo(
    () => deviceCatalog.find((p) => p.sku === deviceForm.productSku),
    [deviceCatalog, deviceForm.productSku],
  );

  const matchCatalogByCloudName = useMemo(() => {
    return (cloudName?: string): SupportedDeviceProduct | null => {
      const raw = (cloudName ?? '').trim();
      if (!raw) return null;
      const n = normalizeDiscoveryName(raw);
      if (!n) return null;
      return (
        deviceCatalog.find((p) => {
          const label = (p.tuyaProductLabel ?? '').trim();
          const variants = [
            label,
            stripVendorPrefix(label),
            p.displayName ?? '',
            p.suggestedName ?? '',
          ].filter(Boolean);
          return variants.some((v) => normalizeDiscoveryName(v) === n);
        }) ?? null
      );
    };
  }, [deviceCatalog]);

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

  const fetchDeviceCatalog = async () => {
      try {
          const res = await api.get<SupportedDeviceProduct[]>('/devices/catalog');
          const next = Array.isArray(res.data) ? res.data : [];
          setDeviceCatalog(next);
          if (!selectedCatalogCategory && next.length > 0) {
            const cats = sortCatalogCategoryLabels(next.map((x) => x.category || 'Прочее'));
            setSelectedCatalogCategory(cats[0] ?? next[0].category ?? 'Прочее');
          }
      } catch (err: any) {
          console.error('Error fetching device catalog:', err);
          setDeviceCatalog([]);
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
          await fetchDevices();
        } catch (_) { /* ignore */ }
      }
    } catch (err: any) {
        console.error("Error fetching houses:", err);
        setError("Не удалось загрузить список домов: " + (err.response?.data?.title || err.message));
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchHouses(), fetchDevices(), fetchDeviceCatalog()]).finally(() => {
      if (!cancelled) setInitialLoadDone(true);
    });
    return () => { cancelled = true; };
  }, []);

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

  // Сначала загружаем данные, потом подключаемся к SSE
  useSSE({
    enabled: initialLoadDone,
    onMessage: async (event) => {
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

        case 'devices.settings.batch': {
          const updates = event.data?.updates as { deviceId: number; settings: Record<string, unknown> }[] | undefined;
          if (!updates?.length) break;
          const byId = new Map(updates.map(u => [u.deviceId, u.settings]));
          const applyBatch = (prev: Device[]) =>
            prev.map(d => {
              const patch = byId.get(d.deviceId);
              return patch ? { ...d, settings: { ...d.settings, ...patch } } : d;
            });
          setAllDevices(applyBatch);
          setHouseDevices(applyBatch);
          break;
        }
        
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

  const handleUpdateDevice = async (deviceId: number, updatedData: { name: string; hardwareDeviceId: string; ip: string }) => {
      if (!updatedData.name || updatedData.name.trim() === '') {
          setError('Название устройства обязательно для заполнения');
          return;
      }
      if (!updatedData.hardwareDeviceId || updatedData.hardwareDeviceId.trim() === '') {
          setError('Device ID обязателен для заполнения');
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
      try {
          const usageRes = await api.get<{ scenarioGroups?: Array<{ groupId: number; name: string }>; scenarioGroupsCount?: number }>(
            `/devices/${deviceId}/usage`,
          );
          const groups = usageRes.data?.scenarioGroups ?? [];
          const count = usageRes.data?.scenarioGroupsCount ?? groups.length;
          const prompt = count > 0
            ? `Устройство используется в ${count} сценарии(ях).\nУдалить устройство и автоматически очистить связи в этих сценариях?`
            : 'Удалить устройство?';
          if (!window.confirm(prompt)) return;
      } catch {
      if (!window.confirm('Удалить устройство?')) return;
      }
      try {
          await api.delete(`/devices/${deviceId}`);
          fetchDevices();
          showSuccess('Устройство удалено (связи в сценариях очищены)');
      } catch (err: any) {
          const data = err.response?.data;
          setError(typeof data === 'string' ? data : data?.message || data?.detail || 'Ошибка удаления');
      }
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

  const afterDeviceAddedSuccess = () => {
    setOpenManualTuyaDialog(false);
    setDeviceForm({
      productSku: deviceForm.productSku,
      name: deviceForm.name,
      hardwareDeviceId: '',
      ip: '',
    });
    setDiscoveredDevice(null);
    setDiscoveryStatus('idle');
    setNetworkFoundDevices(null);
    setConsoleTuyaForm(DEFAULT_CONSOLE_TUYA);
    showSuccess('Устройство добавлено');
    void fetchDevices();
  };

  const registerDeviceCore = async (
    hardwareDeviceId: string,
    ip?: string,
    tuya?: { localKey: string; version: string; dpsSwitch: number },
    tuyaLanVersion?: string,
  ) => {
    if (!selectedRoomId) throw new Error('room');
    const ipTrim = ip?.trim() ?? '';
    if (ipTrim && !validateIP(ipTrim)) {
      throw { response: { data: 'Некорректный IP устройства (ожидается формат 192.168.x.x)' } };
    }
    const hid = hardwareDeviceId.trim();
    const created = await api.post('/devices', {
      roomId: selectedRoomId,
      productSku: deviceForm.productSku,
      name: deviceForm.name.trim(),
      hardwareDeviceId: hid,
      ip: ipTrim || undefined,
      tuyaLanVersion: tuyaLanVersion?.trim() || undefined,
    });
    const newId = (created.data as { deviceId?: number })?.deviceId;
    if (newId && tuya) {
      await api.put(`/devices/${newId}/settings`, {
        settings: {
          tuya: {
            enabled: true,
            deviceId: hid,
            localKey: tuya.localKey,
            ip: ipTrim,
            version: tuya.version,
            dpsSwitch: tuya.dpsSwitch,
          },
        },
      });
    }
  };

  const handleCreateDevice = async () => {
    if (!selectedRoomId) return;
    if (!deviceForm.productSku) {
      setDeviceFormProductSkuError('Выберите модель из каталога');
      return;
    }
    if (!deviceForm.name || deviceForm.name.trim() === '') {
      setDeviceFormNameError('Название устройства обязательно для заполнения');
      return;
    }
    if (!discoveredDevice?.hardwareDeviceId) {
      setDeviceDiscoveryError('Сначала выберите устройство из списка сети или добавьте вручную');
      return;
    }
    setDeviceFormProductSkuError('');
    setDeviceFormNameError('');
    setDeviceFormHardwareIdError('');
    setDeviceFormIpError('');
    setDeviceDiscoveryError('');
    setDeviceAddInProgress(true);
    try {
      await registerDeviceCore(discoveredDevice.hardwareDeviceId, discoveredDevice.ip, undefined, discoveredDevice.version);
      afterDeviceAddedSuccess();
    } catch (err: unknown) {
      setDeviceFormHardwareIdError(formatDeviceApiError(err));
    } finally {
      setDeviceAddInProgress(false);
    }
  };

  const handleCreateVirtualDevice = () => {
    if (!selectedRoomId) {
      setDeviceDiscoveryError('Откройте добавление устройства из комнаты');
      return;
    }
    if (!deviceForm.productSku) {
      setDeviceFormProductSkuError('Сначала выберите модель устройства');
      return;
    }
    if (!deviceForm.name?.trim()) {
      setDeviceFormNameError('Сначала укажите название');
      return;
    }
    const skuTail = deviceForm.productSku.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const hid = `VIRTUAL-${skuTail}-${Date.now().toString().slice(-5)}`;
    setDeviceFormProductSkuError('');
    setDeviceFormNameError('');
    setDeviceFormHardwareIdError('');
    setDeviceDiscoveryError('');
    setDeviceAddInProgress(true);
    void (async () => {
      try {
        await registerDeviceCore(hid, undefined, undefined, undefined);
        afterDeviceAddedSuccess();
      } catch (err: unknown) {
        setDeviceFormHardwareIdError(formatDeviceApiError(err));
      } finally {
        setDeviceAddInProgress(false);
      }
    })();
  };

  const handleNetworkRowClick = async (row: NetworkDiscoveredRow) => {
    if (!selectedRoomId) {
      setDeviceDiscoveryError('Откройте добавление устройства из комнаты');
      return;
    }
    const resolvedSku = row.guessedSku || deviceForm.productSku;
    if (!resolvedSku) {
      setDeviceFormProductSkuError(
        row.cloud_product_name
          ? `Не удалось сопоставить модель из Cloud: "${row.cloud_product_name}".`
          : 'Не удалось определить модель автоматически: в ответе нет cloud_product_name.'
      );
      return;
    }
    const guessedName = row.guessedDisplayName || '';
    const resolvedName = (deviceForm.name || guessedName || '').trim();
    if (!resolvedName) {
      setDeviceFormNameError('Сначала укажите название');
      return;
    }
    if (!deviceForm.productSku || deviceForm.productSku !== resolvedSku || deviceForm.name.trim() !== resolvedName) {
      setDeviceForm((prev) => ({ ...prev, productSku: resolvedSku, name: resolvedName }));
    }
    setDeviceFormProductSkuError('');
    setDeviceFormNameError('');
    setDeviceFormHardwareIdError('');
    setDeviceDiscoveryError('');
    setDeviceAddInProgress(true);
    try {
      await registerDeviceCore(row.device_id, row.ip, undefined, row.version);
      afterDeviceAddedSuccess();
    } catch (err: unknown) {
      setDeviceFormHardwareIdError(formatDeviceApiError(err));
      setDiscoveredDevice({
        hardwareDeviceId: row.device_id,
        ip: row.ip,
        version: row.version,
        source: 'real',
      });
      setDiscoveryStatus('found');
    } finally {
      setDeviceAddInProgress(false);
    }
  };

  const handleConsoleTuyaAdd = async () => {
      if (!selectedRoomId) return;
    if (!deviceForm.productSku) {
      setDeviceFormProductSkuError('Выберите модель из каталога');
          return;
      }
    if (!deviceForm.name?.trim()) {
      setDeviceFormNameError('Укажите название');
          return;
      }
    const hid = consoleTuyaForm.deviceId.trim();
    const lk = consoleTuyaForm.localKey.trim();
    const ip = consoleTuyaForm.ip.trim();
    if (!hid || !lk || !ip) {
      setDeviceDiscoveryError('Заполните Device ID, local key и IP');
          return;
      }
    if (!validateIP(ip)) {
      setDeviceDiscoveryError('Некорректный IP');
      return;
    }
    const dps = Number.parseInt(consoleTuyaForm.dps, 10) || 20;
    const ver = (consoleTuyaForm.version || '3.5').trim();
    setDeviceFormProductSkuError('');
    setDeviceFormNameError('');
    setDeviceFormHardwareIdError('');
    setDeviceDiscoveryError('');
    setDeviceAddInProgress(true);
    try {
      await registerDeviceCore(hid, ip, { localKey: lk, version: ver, dpsSwitch: dps });
      afterDeviceAddedSuccess();
    } catch (err: unknown) {
      setDeviceFormHardwareIdError(formatDeviceApiError(err));
    } finally {
      setDeviceAddInProgress(false);
    }
  };

  const runDeviceDiscovery = async (opts?: { strictSku?: string }) => {
    const strictSku = (opts?.strictSku ?? '').trim();
    const strictProduct = strictSku
      ? deviceCatalog.find((p) => p.sku.toLowerCase() === strictSku.toLowerCase())
      : undefined;
    setDeviceFormProductSkuError('');
    setDeviceDiscoveryError('');
    setDiscoveryStatus('searching');
    setNetworkFoundDevices(null);
    setDiscoveredDevice(null);
    try {
      const res = await api.post('/devices/discover', {
        productSku: strictSku || deviceForm.productSku,
        mode: 'auto',
        timeoutSec: 25,
      });
      const raw = (res.data?.devices ?? []) as Array<Record<string, unknown>>;
      const list: NetworkDiscoveredRow[] = raw
        .map((d) => ({
          device_id: String(d.device_id || '').trim(),
          ip: d.ip != null && String(d.ip).trim() ? String(d.ip).trim() : undefined,
          version: d.version != null && String(d.version).trim() ? String(d.version).trim() : undefined,
          product_key: d.product_key != null ? String(d.product_key) : undefined,
          cloud_product_name:
            d.cloud_product_name != null && String(d.cloud_product_name).trim()
              ? String(d.cloud_product_name).trim()
              : undefined,
          matched_catalog_sku:
            d.matched_catalog_sku != null && String(d.matched_catalog_sku).trim()
              ? String(d.matched_catalog_sku).trim()
              : undefined,
          matched_catalog_label:
            d.matched_catalog_label != null && String(d.matched_catalog_label).trim()
              ? String(d.matched_catalog_label).trim()
              : undefined,
        }))
        .filter((d) => d.device_id.length > 0);
      const enriched = list.map((row) => {
        // Только тупое точное сопоставление по имени модели из сети/cloud (без эвристик и partial match).
        const fromCloudName = matchCatalogByCloudName(row.cloud_product_name);
        const fromCloudSku = row.matched_catalog_sku
          ? deviceCatalog.find((p) => p.sku === row.matched_catalog_sku) ?? null
          : null;
        let p = fromCloudName ?? fromCloudSku;
        if (!p && strictProduct && row.cloud_product_name) {
          const candidateNames = [
            strictProduct.tuyaProductLabel ?? '',
            stripVendorPrefix(strictProduct.tuyaProductLabel ?? ''),
            strictProduct.displayName ?? '',
            strictProduct.suggestedName ?? '',
          ].filter(Boolean);
          const cloud = normalizeDiscoveryName(row.cloud_product_name);
          if (candidateNames.some((x) => normalizeDiscoveryName(x) === cloud)) {
            p = strictProduct;
          }
        }
        const label = row.cloud_product_name || undefined;
        return {
          ...row,
          guessedSku: p?.sku,
          guessedDisplayName: label,
          guessedCategory: p?.category,
          guessedFeatures: p?.features ?? [],
        } as NetworkDiscoveredRow;
      });
      const sorted = [...enriched].sort((a, b) => {
        const ai = CATALOG_CATEGORY_ORDER.indexOf(a.guessedCategory ?? '');
        const bi = CATALOG_CATEGORY_ORDER.indexOf(b.guessedCategory ?? '');
        const ar = ai === -1 ? 999 : ai;
        const br = bi === -1 ? 999 : bi;
        if (ar !== br) return ar - br;
        return (a.guessedDisplayName ?? '').localeCompare(b.guessedDisplayName ?? '', 'ru');
      });
      // Если пользователь уже выбрал модель (strictSku), не скрываем устройства без guessedSku:
      // дадим выбрать найденную розетку и привяжем выбранный SKU при добавлении.
      const filteredByQuery = strictSku
        ? sorted
        : sorted.filter((x) => !!x.guessedSku);

      const houseRoomIds = selectedHouseId
        ? new Set((rooms[selectedHouseId] ?? []).map((r) => r.roomId))
        : null;
      const existingIds = new Set(
        allDevices
          .filter((d) => d.hardwareDeviceId && (!houseRoomIds || houseRoomIds.has(d.roomId)))
          .map((d) => String(d.hardwareDeviceId).trim().toLowerCase()),
      );
      const filtered = filteredByQuery.filter((x) => !existingIds.has(x.device_id.trim().toLowerCase()));

      if (filtered.length === 0) {
        setDiscoveryStatus('not_found');
        setNetworkFoundDevices([]);
        setDeviceDiscoveryError('Новых устройств не найдено');
          return;
      }
      setNetworkFoundDevices(filtered);
      if (!deviceForm.productSku) {
        const firstGuess = filtered.find((x) => !!x.guessedSku);
        if (firstGuess?.guessedSku) {
          setDeviceForm((prev) => ({
            ...prev,
            productSku: firstGuess.guessedSku || prev.productSku,
            name: prev.name.trim() || firstGuess.guessedDisplayName || prev.name,
          }));
        }
      }
      setDiscoveryStatus('idle');
      setDeviceDiscoveryError('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown } };
      const data = ax.response?.data;
      setDiscoveryStatus('not_found');
      setNetworkFoundDevices(null);
      const msg =
        typeof data === 'string'
          ? data
          : (data as { message?: string })?.message ||
            (data as { detail?: string })?.detail ||
            'Ошибка автопоиска устройства';
      setDeviceDiscoveryError(msg);
    }
  };

  const handleSubmitCatalogRequest = async () => {
      if (!catalogRequestForm.category.trim() ||
          !catalogRequestForm.deviceKind.trim() ||
          !catalogRequestForm.connectivity.trim() ||
          !catalogRequestForm.contact.trim()) {
          setCatalogRequestError('Заполните обязательные поля заявки');
          return;
      }
      setCatalogRequestError('');
      try {
          await api.post('/devices/catalog-requests', {
              category: catalogRequestForm.category.trim(),
              deviceKind: catalogRequestForm.deviceKind.trim(),
              connectivity: catalogRequestForm.connectivity.trim(),
              lightMode: catalogRequestForm.lightMode.trim() || undefined,
              contact: catalogRequestForm.contact.trim(),
              comment: catalogRequestForm.comment.trim() || undefined,
          });
          setCatalogRequestForm({
              category: '',
              deviceKind: '',
              connectivity: '',
              lightMode: '',
              contact: '',
              comment: '',
          });
          showSuccess('Заявка на добавление устройства отправлена');
      } catch (err: any) {
          const data = err.response?.data;
          setCatalogRequestError(typeof data === 'string' ? data : data?.message || 'Не удалось отправить заявку');
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
      } catch (err: any) {
          const data = err?.response?.data;
          const msg = typeof data === 'string' ? data : data?.detail || data?.message || data?.title || 'Не удалось сохранить права';
          setError(msg);
      }
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
                                            label={`${devicesByRoomId.get(room.roomId)?.length ?? 0} устройств`} 
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
                                                    const cats0 = sortCatalogCategoryLabels(
                                                      deviceCatalog.map((x) => x.category || 'Прочее'),
                                                    );
                                                    setSelectedCatalogCategory(cats0[0] ?? 'Прочее');
                                                    setDeviceForm({
                                                        productSku: '',
                                                        name: '',
                                                        hardwareDeviceId: '',
                                                        ip: '',
                                                    });
                                                    setDeviceFormNameError('');
                                                    setDeviceFormIpError('');
                                                    setDeviceFormProductSkuError('');
                                                    setDeviceFormHardwareIdError('');
                                                    setNetworkFoundDevices(null);
                                                    setDeviceDiscoveryError('');
                                                    setDiscoveryStatus('idle');
                                                    setDiscoveredDevice(null);
                                                    setConsoleTuyaForm(DEFAULT_CONSOLE_TUYA);
                                                    deviceDialogOpenedAtRef.current = Date.now();
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
                            {(devicesByRoomId.get(room.roomId)?.length ?? 0) === 0 ? (
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Устройств нет</Typography>
                            ) : (
                                <Box>
                                    {(devicesByRoomId.get(room.roomId) ?? []).map((device) => (
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
                                                            {DEVICE_TYPES.find((t) => t.value === device.type)?.label ?? device.type} · Device ID: {device.hardwareDeviceId || '—'} · IP: {device.ip || '—'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ bgcolor: 'rgba(0,0,0,0.15)', color: '#fff' }}>
                                                {canManageDevices ? (
                                                    <DeviceEditItem 
                                                        device={device}
                                                        deviceCatalog={deviceCatalog}
                                                        typeLabels={DEVICE_TYPES}
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

      <CreateHouseDialog
        open={openHouseDialog}
        onClose={() => setOpenHouseDialog(false)}
        onCreated={async () => {
          await fetchHouses();
          showSuccess('Дом успешно создан');
        }}
      />

      <CreateRoomDialog
        open={openRoomDialog}
        houseId={selectedHouseId}
        onClose={() => setOpenRoomDialog(false)}
        onCreated={async (hid) => {
          await fetchRooms(hid);
          showSuccess('Комната добавлена');
        }}
      />

      {/* Диалог создания устройства */}
      <Dialog open={openDeviceDialog} onClose={() => {
          setOpenDeviceDialog(false);
          setDeviceFormNameError('');
          setDeviceFormIpError('');
          setDeviceFormProductSkuError('');
          setDeviceFormHardwareIdError('');
          setDeviceDiscoveryError('');
          setDiscoveryStatus('idle');
          setDiscoveredDevice(null);
          setNetworkFoundDevices(null);
          setCatalogRequestError('');
          setConsoleTuyaForm({ deviceId: '', localKey: '', ip: '', version: '3.5', dps: '20' });
          setOpenManualTuyaDialog(false);
          setDeviceAddInProgress(false);
      }} fullWidth maxWidth="lg">
        <DialogTitle>Новое устройство</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              Выберите устройство из каталога
            </Typography>
            <Alert severity="info" sx={{ bgcolor: 'rgba(240,139,92,0.12)', color: '#fff' }}>
              Перед поиском на устройстве включите Bluetooth и Wi-Fi 2.4 GHz.
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
                gap: 1.5,
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 1.5,
                p: 1.25,
                bgcolor: 'rgba(255,255,255,0.03)'
              }}
            >
              <Box sx={{ borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.12)' }, pr: { md: 1 } }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Категории</Typography>
                <List dense sx={{ mt: 0.5 }}>
                  {catalogCategories.map((cat) => (
                    <ListItem key={cat} disablePadding sx={{ mb: 0.5 }}>
                      <Button
                        fullWidth
                        size="small"
                        variant={selectedCatalogCategory === cat ? 'contained' : 'outlined'}
                        onClick={() => setSelectedCatalogCategory(cat)}
                        sx={{
                          justifyContent: 'flex-start',
                          fontWeight: selectedCatalogCategory === cat ? 700 : 500,
                          boxShadow: selectedCatalogCategory === cat ? '0 0 0 1px rgba(240,139,92,0.7) inset' : 'none',
                        }}
                      >
                        {cat}
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  Модели в категории: {selectedCatalogCategory || '—'}
                </Typography>
                {groupedCatalogProducts.map((grp, idx) => (
                  <Box key={grp.title} sx={{ mt: idx === 0 ? 0.75 : 1.25 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)', fontWeight: 700 }}>
                      {grp.title}
                    </Typography>
                    <Box
                      sx={{
                        mt: 0.5,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1
                      }}
                    >
                      {grp.items.map((p) => (
                        <Box
                          key={p.sku}
                          onClick={() => {
                            if (Date.now() - deviceDialogOpenedAtRef.current < DEVICE_DIALOG_CATALOG_CLICK_GUARD_MS) {
                              return;
                            }
                            setDeviceFormProductSkuError('');
                            setDiscoveredDevice(null);
                            setNetworkFoundDevices(null);
                            setDeviceForm({
                              ...deviceForm,
                              productSku: p.sku,
                              name: p.suggestedName || deviceForm.name,
                            });
                          }}
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            border: deviceForm.productSku === p.sku
                              ? '1px solid rgba(240,139,92,0.9)'
                              : '1px solid rgba(255,255,255,0.16)',
                            bgcolor: deviceForm.productSku === p.sku
                              ? 'rgba(240,139,92,0.12)'
                              : 'rgba(255,255,255,0.03)',
                            cursor: 'pointer'
                          }}
                        >
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                            {p.displayName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                            {catalogProductSubtitle(p)}
                          </Typography>
                          {!!p.features?.length && (
                            <Box sx={{ mt: 0.75, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {p.features.slice(0, 5).map((f) => (
                                <Chip key={`${p.sku}-${f}`} size="small" label={f} sx={{ height: 20, color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' }} />
                              ))}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
                {deviceFormProductSkuError && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.75, display: 'block' }}>
                    {deviceFormProductSkuError}
                  </Typography>
                )}
              </Box>
            </Box>
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
            {selectedCatalogProduct && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                <Box component="span" sx={{ color: 'rgba(255,255,255,0.55)' }}>Модель каталога</Box>
                {' — '}
                <Box component="span" sx={{ color: '#F08B5C', fontWeight: 600 }}>
                  {selectedCatalogProduct.displayName}
                </Box>
                {' — '}
                {catalogProductSubtitle(selectedCatalogProduct)}
                . Ниже — результаты поиска: нажмите строку, чтобы сразу добавить устройство в эту комнату.
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                onClick={() => void runDeviceDiscovery({ strictSku: deviceForm.productSku })}
                disabled={discoveryStatus === 'searching' || !deviceForm.productSku}
              >
                Искать выбранную модель
              </Button>
              <Button
                variant="outlined"
                onClick={() => void runDeviceDiscovery()}
                disabled={discoveryStatus === 'searching'}
              >
                Автоопределить в сети
              </Button>
              {discoveryStatus === 'searching' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.75)' }}>
                  <CircularProgress size={18} />
                  <Typography variant="caption">Скан локальной сети…</Typography>
                </Box>
              )}
            </Box>
            {networkFoundDevices && networkFoundDevices.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 0.75 }}>
                  Нажмите устройство — оно сразу добавится в комнату (при ошибке можно нажать «Добавить» внизу)
                </Typography>
                <List dense disablePadding sx={{ maxHeight: 220, overflow: 'auto', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                  {networkFoundDevices.map((row) => {
                    const sel = discoveredDevice?.hardwareDeviceId === row.device_id && discoveredDevice?.ip === row.ip;
                    return (
                      <ListItem key={`${row.device_id}-${row.ip ?? ''}`} disablePadding>
                        <ListItemButton
                          selected={!!sel}
                          disabled={deviceAddInProgress}
                          onClick={() => void handleNetworkRowClick(row)}
                          sx={{ alignItems: 'flex-start', py: 1 }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                                {row.device_id}
                              </Typography>
                            }
                            secondary={
                              <Typography component="span" variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                                {[row.ip ? `IP ${row.ip}` : null, row.version ? `протокол ${row.version}` : null, row.product_key ? `product ${row.product_key}` : null, row.cloud_product_name ? `cloud "${row.cloud_product_name}"` : 'cloud name: —']
                                  .filter(Boolean)
                                  .join(' · ') || 'нажмите, чтобы добавить в систему'}
                              </Typography>
                            }
                          />
                          {(row.guessedSku || row.guessedDisplayName || row.cloud_product_name) && (
                            <Box sx={{ ml: 1, mt: 0.25, textAlign: 'right' }}>
                              <Typography variant="caption" sx={{ color: '#F08B5C', display: 'block' }}>
                                {row.guessedCategory ? `${row.guessedCategory} · ` : ''}
                                {row.guessedDisplayName || (row.cloud_product_name ? `Tuya ${row.cloud_product_name}` : 'Не сопоставлено')}
                              </Typography>
                              {!!row.guessedFeatures?.length && (
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                                  {row.guessedFeatures.join(' · ')}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
            {discoveryStatus === 'found' && discoveredDevice && (
              <Alert severity="success" sx={{ bgcolor: 'rgba(46,125,50,0.25)', color: '#fff' }}>
                {discoveredDevice.source === 'virtual'
                  ? `Тестовое устройство подготовлено: Device ID ${discoveredDevice.hardwareDeviceId}`
                  : `Выбрано устройство: Device ID ${discoveredDevice.hardwareDeviceId}${discoveredDevice.ip ? `, IP ${discoveredDevice.ip}` : ''}${discoveredDevice.version ? `, версия ${discoveredDevice.version}` : ''}`}
              </Alert>
            )}
            {deviceDiscoveryError && (
              <Typography variant="caption" color="error" sx={{ display: 'block' }}>{deviceDiscoveryError}</Typography>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.14)', my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Button variant="text" onClick={() => setOpenManualTuyaDialog(true)}>
                Добавить вручную
              </Button>
              <Button variant="text" onClick={() => setOpenCatalogRequestDialog(true)}>
                Не нашли свое устройство?
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', px: 3, pb: 2, pt: 0, gap: 1 }}>
          {!!deviceFormHardwareIdError && (
            <Alert severity="error" sx={{ bgcolor: 'rgba(198,40,40,0.2)', color: '#ffcdd2' }}>
              {deviceFormHardwareIdError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="text"
              disabled={deviceAddInProgress}
              onClick={handleCreateVirtualDevice}
            >
              Создать тестовое
            </Button>
            <Button onClick={() => {
                setOpenDeviceDialog(false);
                setDeviceFormNameError('');
                setDeviceFormIpError('');
                setDeviceFormProductSkuError('');
                setDeviceFormHardwareIdError('');
                setCatalogRequestError('');
                setDeviceDiscoveryError('');
                setDiscoveryStatus('idle');
                setDiscoveredDevice(null);
                setNetworkFoundDevices(null);
                setConsoleTuyaForm({ deviceId: '', localKey: '', ip: '', version: '3.5', dps: '20' });
                setOpenManualTuyaDialog(false);
                setDeviceAddInProgress(false);
            }}>Отмена</Button>
            <Button
              onClick={handleCreateDevice}
              variant="contained"
              disabled={deviceAddInProgress || !!deviceFormNameError || !!deviceFormProductSkuError ||
                       !deviceForm.name || deviceForm.name.trim() === '' ||
                       !deviceForm.productSku ||
                       !discoveredDevice?.hardwareDeviceId ||
                       deviceCatalog.length === 0}
            >
              {discoveredDevice?.source === 'virtual' ? 'Добавить тестовое' : 'Добавить'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openManualTuyaDialog}
        onClose={() => {
          setOpenManualTuyaDialog(false);
          setConsoleTuyaForm({ deviceId: '', localKey: '', ip: '', version: '3.5', dps: '20' });
          setDeviceDiscoveryError('');
          setDeviceFormHardwareIdError('');
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Добавить вручную (Tuya)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Device ID и Local Key — в Tuya IoT Cloud; IP — в вашей LAN (роутер или поиск). Модель и имя — в основном окне.
            </Typography>
            <TextField
              label="Device ID"
              size="small"
              fullWidth
              value={consoleTuyaForm.deviceId}
              onChange={(e) => setConsoleTuyaForm({ ...consoleTuyaForm, deviceId: e.target.value })}
              inputProps={{ spellCheck: false }}
            />
            <TextField 
              label="Local key"
              size="small"
              fullWidth 
              value={consoleTuyaForm.localKey}
              onChange={(e) => setConsoleTuyaForm({ ...consoleTuyaForm, localKey: e.target.value })}
              autoComplete="off"
              inputProps={{ spellCheck: false }}
            />
            <TextField 
              label="IP в LAN"
              size="small"
              fullWidth 
              value={consoleTuyaForm.ip}
              onChange={(e) => setConsoleTuyaForm({ ...consoleTuyaForm, ip: e.target.value })}
              placeholder="192.168.x.x"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Версия протокола"
                size="small"
                fullWidth
                value={consoleTuyaForm.version}
                onChange={(e) => setConsoleTuyaForm({ ...consoleTuyaForm, version: e.target.value })}
              />
              <TextField
                label="DPS вкл/выкл"
                size="small"
                fullWidth
                value={consoleTuyaForm.dps}
                onChange={(e) => setConsoleTuyaForm({ ...consoleTuyaForm, dps: e.target.value })}
              />
            </Box>
            {!!deviceFormHardwareIdError && (
              <Typography variant="caption" color="error">{deviceFormHardwareIdError}</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenManualTuyaDialog(false); setDeviceFormHardwareIdError(''); }}>Закрыть</Button>
          <Button 
            variant="contained"
            disabled={deviceAddInProgress || !deviceForm.productSku || !deviceForm.name?.trim()}
            onClick={() => void handleConsoleTuyaAdd()}
          >
            Добавить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openCatalogRequestDialog}
        onClose={() => setOpenCatalogRequestDialog(false)}
        fullWidth
        maxWidth="md"
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: 6 } }}
      >
        <DialogTitle>Запрос на добавление нового устройства</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mt: 0.5 }}>
            <TextField
              label="Категория"
              size="small"
              value={catalogRequestForm.category}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, category: e.target.value })}
            />
            <TextField
              label="Тип устройства"
              size="small"
              value={catalogRequestForm.deviceKind}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, deviceKind: e.target.value })}
            />
            <TextField
              label="Подключение (Wi-Fi/BLE/Zigbee/Thread...)"
              size="small"
              value={catalogRequestForm.connectivity}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, connectivity: e.target.value })}
            />
            <TextField
              label="Особенности (опционально)"
              size="small"
              value={catalogRequestForm.lightMode}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, lightMode: e.target.value })}
            />
            <TextField
              label="Контакт для обратной связи"
              size="small"
              value={catalogRequestForm.contact}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, contact: e.target.value })}
              sx={{ gridColumn: '1 / -1' }}
            />
            <TextField
              label="Комментарий"
              size="small"
              multiline
              minRows={3}
              value={catalogRequestForm.comment}
              onChange={(e) => setCatalogRequestForm({ ...catalogRequestForm, comment: e.target.value })}
              sx={{ gridColumn: '1 / -1' }}
            />
            {catalogRequestError && (
              <Typography variant="caption" color="error" sx={{ gridColumn: '1 / -1' }}>
                {catalogRequestError}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCatalogRequestDialog(false)}>Закрыть</Button>
          <Button variant="contained" onClick={handleSubmitCatalogRequest}>
            Отправить разработчику
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
                              <InputLabel id={`resident-access-label-${dev.deviceId}`}>Доступ</InputLabel>
                              <Select
                                  id={`resident-access-select-${dev.deviceId}`}
                                  labelId={`resident-access-label-${dev.deviceId}`}
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
