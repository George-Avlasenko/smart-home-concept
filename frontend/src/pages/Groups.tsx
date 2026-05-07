import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EventIcon from '@mui/icons-material/Event';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import CoffeeIcon from '@mui/icons-material/Coffee';
import LockIcon from '@mui/icons-material/Lock';
import SensorsIcon from '@mui/icons-material/Sensors';
import OutletIcon from '@mui/icons-material/Power';
import WindowIcon from '@mui/icons-material/Window';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CurtainsIcon from '@mui/icons-material/Curtains';
import OpacityIcon from '@mui/icons-material/Opacity';
import AirIcon from '@mui/icons-material/Air';
import { DeskLampIcon, SwitchLeverIcon, isBreakerSwitch, isDeskLamp } from '../components/DeviceIcons';
import type { Device, House, Room, ScenarioGroup, ScenarioGroupCommand } from '../types';
import { DeviceStatus } from '../types';
import { api } from '../api/client';
import { GlassPage } from '../components/GlassPage';
import { GlassDeviceCard } from '../components/GlassDeviceCard';
import { Toast } from '../components/Toast';
import { useSelectedHouse } from '../context/SelectedHouseContext';
import { useAuth } from '../context/AuthContext';
import { scrollbarLikeDevicesSx } from '../theme/scrollbarStyles';
import {
  CategorySidebar,
  DeviceCategory,
  computeDeviceCategoryCounts,
  filterDevicesByCategory,
} from '../components/CategorySidebar';
import { useSSE } from '../hooks/useSSE';
import { GroupScheduleDialog } from '../components/GroupScheduleDialog';

const NAME_MAX = 20;
const DESC_MAX = 100;

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function commandFromDevice(d: Device): ScenarioGroupCommand {
  return {
    deviceId: d.deviceId,
    status: d.status,
    settings: deepClone(d.settings ?? {}) as Record<string, unknown>,
  };
}

function buildScenarioDevice(base: Device, cmd: ScenarioGroupCommand): Device {
  return {
    ...base,
    status: cmd.status,
    settings: deepClone(cmd.settings) as Record<string, any>,
  };
}

function normalizeApiCommand(raw: unknown): ScenarioGroupCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const deviceId = Number(o.deviceId);
  if (!Number.isFinite(deviceId)) return null;
  const status = typeof o.status === 'string' ? o.status : 'inactive';
  const settings =
    o.settings && typeof o.settings === 'object' && !Array.isArray(o.settings)
      ? (deepClone(o.settings) as Record<string, unknown>)
      : {};
  return { deviceId, status, settings };
}

function mapGroupFromApi(g: ScenarioGroup): ScenarioGroup {
  const cmds = Array.isArray(g.commands)
    ? (g.commands.map((c) => normalizeApiCommand(c)).filter(Boolean) as ScenarioGroupCommand[])
    : [];
  return { ...g, commands: cmds };
}

function commandsForApi(cmds: ScenarioGroupCommand[]) {
  return cmds.map((c) => ({
    deviceId: c.deviceId,
    status: c.status,
    settings: c.settings ?? {},
  }));
}

function deviceMiniIcon(device: Device, selected: boolean, iconPx = 22) {
  const t = device.type.toLowerCase();
  const color = selected ? '#F08B5C' : 'rgba(255,255,255,0.55)';
  const sx = { color, fontSize: iconPx };
  switch (t) {
    case 'light':
      return isDeskLamp(device) ? <DeskLampIcon sx={sx} /> : <LightbulbIcon sx={sx} />;
    case 'thermostat':
      return <ThermostatIcon sx={sx} />;
    case 'kettle':
      return <CoffeeIcon sx={sx} />;
    case 'switch':
      return isBreakerSwitch(device) ? <PowerSettingsNewIcon sx={sx} /> : <SwitchLeverIcon sx={sx} />;
    case 'outlet':
      return <OutletIcon sx={sx} />;
    case 'vacuum':
      return <CleaningServicesIcon sx={sx} />;
    case 'curtain':
      return <CurtainsIcon sx={sx} />;
    case 'lock':
      return <LockIcon sx={sx} />;
    case 'window':
      return <WindowIcon sx={sx} />;
    case 'camera':
      return <VideocamIcon sx={sx} />;
    case 'sensor':
      return <SensorsIcon sx={sx} />;
    case 'humidifier':
      return <OpacityIcon sx={sx} />;
    case 'ventilation':
      return <AirIcon sx={sx} />;
    default:
      return <PowerSettingsNewIcon sx={sx} />;
  }
}

const groupCardSx = {
  width: '100%',
  maxWidth: 340,
  height: 170,
  display: 'flex',
  flexDirection: 'column' as const,
  background: 'rgba(255, 255, 255, 0.14)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.24)',
  borderRadius: 4,
  // Стабилизируем слой карточки: убираем микродрожание нижней границы на некоторых GPU/масштабах.
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
  overflow: 'hidden',
  transition: 'border-color 0.2s ease',
  cursor: 'pointer' as const,
  '&:hover': {
    border: '1px solid rgba(240, 139, 92, 0.5)',
    boxShadow: '0 6px 18px 0 rgba(240, 139, 92, 0.15)',
  },
};

type DevicePickDialogProps = {
  open: boolean;
  title: string;
  devices: Device[];
  rooms: Room[];
  initialSelected: number[];
  onClose: () => void;
  onConfirm: (ids: number[]) => void;
  /** Слот слева в панели действий (напр. «Название и пояснение» при редактировании группы). */
  actionsLeft?: React.ReactNode;
};

const DevicePickDialog: React.FC<DevicePickDialogProps> = ({
  open,
  title,
  devices,
  rooms,
  initialSelected,
  onClose,
  onConfirm,
  actionsLeft,
}) => {
  const compactCats = useMediaQuery('(max-width:900px)');
  const [category, setCategory] = useState<DeviceCategory>('all');
  const [roomIndex, setRoomIndex] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const wasOpenRef = useRef(false);

  const deviceCounts = useMemo(() => computeDeviceCategoryCounts(devices), [devices]);

  // Сбрасываем выбор только в момент открытия диалога, а не при каждом рендере родителя (новый [] / новый map()).
  useEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        setSelected(new Set(initialSelected));
        setCategory('all');
        setRoomIndex(0);
      }
    }
    wasOpenRef.current = open;
  }, [open, initialSelected]);

  const roomItems = useMemo(() => {
    const list: { id: number; label: string }[] = [{ id: 0, label: 'Все комнаты' }];
    rooms.forEach((r) => list.push({ id: r.roomId, label: r.roomName }));
    return list;
  }, [rooms]);

  const filtered = useMemo(() => {
    let list = devices;
    const ri = roomItems[roomIndex];
    if (ri && ri.id !== 0) list = list.filter((d) => d.roomId === ri.id);
    return filterDevicesByCategory(list, category);
  }, [devices, roomItems, roomIndex, category]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      scroll="paper"
      sx={{
        '& .MuiDialog-paper': {
          height: { xs: '92vh', sm: '88vh' },
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ color: '#fff', flexShrink: 0 }}>{title}</DialogTitle>
      <DialogContent
        dividers
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          height: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          p: 0,
          overflow: 'hidden',
          bgcolor: 'rgba(0,0,0,0.12)',
          ...scrollbarLikeDevicesSx,
        }}
      >
        <CategorySidebar
          selectedCategory={category}
          onCategoryChange={setCategory}
          compact={compactCats}
          deviceCounts={deviceCounts}
          stretchColumn
        />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              flexShrink: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {roomItems.map((r, idx) => (
              <Chip
                key={r.id === 0 ? 'all' : r.id}
                label={r.label}
                onClick={() => setRoomIndex(idx)}
                color={roomIndex === idx ? 'primary' : 'default'}
                variant={roomIndex === idx ? 'filled' : 'outlined'}
                sx={{
                  borderColor: 'rgba(255,255,255,0.25)',
                  ...(roomIndex !== idx && { color: 'rgba(255,255,255,0.85)' }),
                }}
              />
            ))}
          </Box>
          <Box sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2, ...scrollbarLikeDevicesSx }}>
            <Grid container spacing={1.5} sx={{ alignItems: 'stretch' }}>
              {filtered.map((d) => {
                const on = selected.has(d.deviceId);
                return (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={d.deviceId} sx={{ display: 'flex' }}>
                    <Box
                      onClick={() => toggle(d.deviceId)}
                      sx={{
                        flex: 1,
                        width: '100%',
                        cursor: 'pointer',
                        borderRadius: 2,
                        // Даём место сверху под hover-анимацию карточки.
                        pt: '4px',
                        pb: '1px',
                        overflow: 'visible',
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                        '& .pick-device-card': {
                          transition: 'transform 0.18s ease, border-color 0.15s ease, background 0.15s ease',
                        },
                        '&:hover .pick-device-card': {
                          transform: 'translateY(-3px)',
                          borderColor: 'rgba(240, 139, 92, 0.45)',
                        },
                      }}
                    >
                      <Card
                        className="pick-device-card"
                        sx={{
                          width: '100%',
                          minHeight: 128,
                          display: 'flex',
                          flexDirection: 'column',
                          background: on ? 'rgba(240, 139, 92, 0.22)' : 'rgba(255,255,255,0.1)',
                          border: on ? '2px solid rgba(240, 139, 92, 0.65)' : '1px solid rgba(255,255,255,0.18)',
                          borderRadius: 2,
                          boxSizing: 'border-box',
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                        }}
                      >
                      <CardContent
                        sx={{
                          // На всю высоту карточки + вертикальное центрирование блока иконка+текст
                          flex: '1 1 0%',
                          minHeight: 0,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          py: 1.5,
                          px: 1,
                          textAlign: 'center',
                          boxSizing: 'border-box',
                          '&:last-child': { pb: 1.5 },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.75,
                            width: '100%',
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              flexShrink: 0,
                              minHeight: 36,
                            }}
                          >
                            {deviceMiniIcon(d, on, 28)}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#fff',
                              fontWeight: on ? 600 : 500,
                              width: '100%',
                              fontSize: '0.8125rem',
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {d.name}
                          </Typography>
                        </Box>
                      </CardContent>
                      </Card>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
            {filtered.length === 0 && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', py: 4, textAlign: 'center' }}>
                Нет устройств в этой комнате и категории
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>{actionsLeft}</Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="contained" onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0}>
            Готово ({selected.size})
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export const Groups: React.FC = () => {
  const { selectedHouseId, setSelectedHouseId } = useSelectedHouse();
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<ScenarioGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({
    open: false,
    message: '',
    severity: 'error',
  });

  const [createPickOpen, setCreatePickOpen] = useState(false);
  const [createPickKey, setCreatePickKey] = useState(0);
  const [createMetaOpen, setCreateMetaOpen] = useState(false);
  const [createSelectedIds, setCreateSelectedIds] = useState<number[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCommands, setEditCommands] = useState<ScenarioGroupCommand[]>([]);
  const [detailDeviceId, setDetailDeviceId] = useState<number | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [editPickOpen, setEditPickOpen] = useState(false);
  const [editGroupMetaOpen, setEditGroupMetaOpen] = useState(false);
  const [groupScheduleOpen, setGroupScheduleOpen] = useState(false);
  const [metaSaveBusy, setMetaSaveBusy] = useState(false);
  const isOnly3DeviceCards = useMediaQuery('(max-width:1380px)');

  const roleForHouse = useMemo(() => {
    if (selectedHouseId == null) return null as string | null;
    return houses.find((h) => h.houseId === selectedHouseId)?.currentUserRole ?? null;
  }, [houses, selectedHouseId]);

  const canManageGroups = useMemo(() => {
    if (user?.role === 'admin') return true;
    return roleForHouse === 'owner' || roleForHouse === 'admin';
  }, [user?.role, roleForHouse]);

  const fetchHouses = useCallback(async () => {
    try {
      const res = await api.get<House[]>('/houses');
      const list = res.data ?? [];
      setHouses(list);
      // Как на дашборде: если дом ещё не выбран — берём первый из списка доступных.
      if (list.length > 0) {
        setSelectedHouseId((prev) => (prev == null ? list[0].houseId : prev));
      }
    } catch {
      setHouses([]);
    }
  }, [setSelectedHouseId]);

  const fetchDevices = useCallback(async () => {
      try {
        const res = await api.get<Device[]>('/devices');
        setDevices(res.data ?? []);
      } catch {
        setDevices([]);
      }
  }, []);

  const fetchRooms = useCallback(async (houseId: number) => {
    try {
      const res = await api.get<Room[]>(`/houses/${houseId}/rooms`);
      setRooms(res.data ?? []);
    } catch {
      setRooms([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    if (selectedHouseId == null || !canManageGroups) {
      setGroups([]);
      return;
    }
    setGroupsLoading(true);
    setForbidden(false);
    try {
      const res = await api.get<ScenarioGroup[]>(`/houses/${selectedHouseId}/scenario-groups`);
      setGroups((res.data ?? []).map(mapGroupFromApi));
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number } };
      if (ax.response?.status === 403) {
        setForbidden(true);
        setGroups([]);
      } else {
        setGroups([]);
      }
    } finally {
      setGroupsLoading(false);
    }
  }, [selectedHouseId, canManageGroups]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchHouses();
      await fetchDevices();
      setLoading(false);
    })();
  }, [fetchHouses, fetchDevices]);

  useEffect(() => {
    if (selectedHouseId != null) void fetchRooms(selectedHouseId);
    else setRooms([]);
  }, [selectedHouseId, fetchRooms]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  useSSE({
    enabled: !loading && selectedHouseId != null && canManageGroups,
    onMessage: (event) => {
      if (!['scenario_group.created', 'scenario_group.updated', 'scenario_group.deleted'].includes(event.type)) return;
      const hid = (event.data as { houseId?: number })?.houseId;
      if (hid !== selectedHouseId) return;
      void fetchGroups();
    },
    onError: () => {},
  });

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.deviceId, d])), [devices]);

  const houseDevices = useMemo(() => {
    if (selectedHouseId == null) return [];
    return devices.filter((d) => d.houseId === selectedHouseId);
  }, [devices, selectedHouseId]);

  const editingGroup = useMemo(
    () => (editingGroupId != null ? groups.find((g) => g.groupId === editingGroupId) ?? null : null),
    [groups, editingGroupId],
  );

  const openEditor = (g: ScenarioGroup) => {
    setEditingGroupId(g.groupId);
    setEditName(g.name);
    setEditDescription(g.description);
    setEditCommands(deepClone(g.commands));
    setDetailDeviceId(null);
    setEditOpen(true);
  };

  const persistGroupFromEditor = async () => {
    if (selectedHouseId == null || editingGroupId == null) return;
    const cleaned = pruneMissingCommands(editCommands);
    if (cleaned.length === 0) {
      setToast({ open: true, message: 'В сценарии не осталось доступных устройств', severity: 'error' });
      return;
    }
    setSaveBusy(true);
    try {
      await api.put(`/houses/${selectedHouseId}/scenario-groups/${editingGroupId}`, {
        name: editName.trim().slice(0, NAME_MAX),
        description: editDescription.trim().slice(0, DESC_MAX),
        commands: commandsForApi(cleaned),
      });
      await fetchGroups();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; detail?: string } } };
      const msg =
        ax.response?.data?.detail || ax.response?.data?.message || 'Не удалось сохранить сценарий';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setSaveBusy(false);
    }
  };

  const updateCommand = (deviceId: number, patch: Partial<ScenarioGroupCommand>) => {
    setEditCommands((prev) => prev.map((c) => (c.deviceId === deviceId ? { ...c, ...patch } : c)));
  };

  const pruneMissingCommands = useCallback(
    (cmds: ScenarioGroupCommand[]) => cmds.filter((c) => deviceMap.has(c.deviceId)),
    [deviceMap],
  );

  useEffect(() => {
    if (!editOpen) return;
    setEditCommands((prev) => prev.filter((c) => deviceMap.has(c.deviceId)));
  }, [editOpen, deviceMap]);

  const handleScenarioToggle = (id: number, st: DeviceStatus) => {
    updateCommand(id, { status: st });
  };

  const handleScenarioSettings = (id: number, settings: Record<string, any>) => {
    updateCommand(id, { settings: deepClone(settings) as Record<string, unknown> });
  };

  const applyGroup = async (cmds: ScenarioGroupCommand[]) => {
    const effective = pruneMissingCommands(cmds);
    if (effective.length === 0) {
      setToast({ open: true, message: 'В сценарии не осталось доступных устройств', severity: 'error' });
      return;
    }
    setApplyBusy(true);
    setToast((t) => ({ ...t, open: false }));
    try {
      // Сначала настройки в MetaData (Tuya local key и т.д.), затем статус — иначе PUT /status не видит ключи и LAN не сработает.
      for (const c of effective) {
        await api.put(`/devices/${c.deviceId}/settings`, { settings: c.settings });
        await api.put(`/devices/${c.deviceId}/status`, { status: c.status });
      }
      setToast({ open: true, message: 'Сценарий применён', severity: 'success' });
      const res = await api.get<Device[]>('/devices');
      setDevices(res.data ?? []);
      await persistGroupFromEditor();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; detail?: string } } };
      const msg =
        ax.response?.data?.detail || ax.response?.data?.message || 'Не удалось применить сценарий';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setApplyBusy(false);
    }
  };

  const deleteGroup = async () => {
    if (selectedHouseId == null || editingGroupId == null) return;
    if (!window.confirm('Удалить этот сценарий?')) return;
    try {
      await api.delete(`/houses/${selectedHouseId}/scenario-groups/${editingGroupId}`);
      setEditOpen(false);
      setEditingGroupId(null);
      await fetchGroups();
      setToast({ open: true, message: 'Сценарий удалён', severity: 'success' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; detail?: string } } };
      const msg = ax.response?.data?.detail || ax.response?.data?.message || 'Не удалось удалить';
      setToast({ open: true, message: msg, severity: 'error' });
    }
  };

  const closeEditor = async () => {
    setGroupScheduleOpen(false);
    setEditGroupMetaOpen(false);
    if (editOpen && editingGroupId != null) {
      await persistGroupFromEditor();
    }
    setEditOpen(false);
    setEditingGroupId(null);
    setDetailDeviceId(null);
  };

  const saveEditGroupMeta = async () => {
    if (selectedHouseId == null || editingGroupId == null) return;
    const name = editName.trim();
    if (!name) {
      setToast({ open: true, message: 'Введите название', severity: 'error' });
      return;
    }
    setMetaSaveBusy(true);
    try {
      await api.put(`/houses/${selectedHouseId}/scenario-groups/${editingGroupId}`, {
        name: name.slice(0, NAME_MAX),
        description: editDescription.trim().slice(0, DESC_MAX),
      });
      setEditGroupMetaOpen(false);
      await fetchGroups();
      setToast({ open: true, message: 'Сохранено', severity: 'success' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; detail?: string } } };
      const msg = ax.response?.data?.detail || ax.response?.data?.message || 'Не удалось сохранить';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setMetaSaveBusy(false);
    }
  };

  const startCreate = () => {
    setCreateSelectedIds([]);
    setDraftName('');
    setDraftDescription('');
    setCreatePickKey((k) => k + 1);
    setCreatePickOpen(true);
  };

  const onCreatePickConfirm = (ids: number[]) => {
    setCreateSelectedIds(ids);
    setCreatePickOpen(false);
    setCreateMetaOpen(true);
  };

  const submitCreate = async () => {
    if (selectedHouseId == null) return;
    const name = draftName.trim();
    if (!name) {
      setToast({ open: true, message: 'Введите название', severity: 'error' });
      return;
    }
    if (createSelectedIds.length === 0) {
      setToast({ open: true, message: 'Выберите устройства', severity: 'error' });
      return;
    }
    const commands: ScenarioGroupCommand[] = [];
    for (const id of createSelectedIds) {
      const d = deviceMap.get(id);
      if (d) commands.push(commandFromDevice(d));
    }
    if (commands.length === 0) {
      setToast({ open: true, message: 'Устройства не найдены', severity: 'error' });
      return;
    }
    setCreateBusy(true);
    try {
      await api.post(`/houses/${selectedHouseId}/scenario-groups`, {
        name: name.slice(0, NAME_MAX),
        description: draftDescription.trim().slice(0, DESC_MAX),
        commands: commandsForApi(commands),
      });
      setCreateMetaOpen(false);
      setCreateSelectedIds([]);
      setDraftName('');
      setDraftDescription('');
      await fetchGroups();
      setToast({ open: true, message: 'Сценарий создан', severity: 'success' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; detail?: string } } };
      const msg = ax.response?.data?.detail || ax.response?.data?.message || 'Не удалось создать';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setCreateBusy(false);
    }
  };

  const onEditPickConfirm = (ids: number[]) => {
    const next: ScenarioGroupCommand[] = [];
    const existing = new Map(editCommands.map((c) => [c.deviceId, c]));
    for (const id of ids) {
      const prev = existing.get(id);
      if (prev) next.push(deepClone(prev));
      else {
        const d = deviceMap.get(id);
        if (d) next.push(commandFromDevice(d));
      }
    }
    setEditCommands(next);
    setEditPickOpen(false);
  };

  const detailDevice = useMemo(() => {
    if (detailDeviceId == null) return null;
    const cmd = editCommands.find((c) => c.deviceId === detailDeviceId);
    const base = deviceMap.get(detailDeviceId);
    if (!cmd || !base) return null;
    return buildScenarioDevice(base, cmd);
  }, [detailDeviceId, editCommands, deviceMap]);

  if (loading) {
    return (
      <GlassPage>
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress sx={{ color: '#F08B5C' }} />
        </Box>
      </GlassPage>
    );
  }

  return (
    <GlassPage>
      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
          <Typography variant="h4" sx={{ mb: 0.5, color: '#F08B5C', fontWeight: 600 }}>
        Сценарии
      </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 720 }}>
            Сценарий — набор команд для устройств. В редакторе настройте состояние каждого устройства; кнопка «Применить»
            выполнит все команды подряд.
      </Typography>
        </Box>
        {selectedHouseId != null && canManageGroups && (
          <Button variant="contained" sx={{ flexShrink: 0, mt: 0.5 }} onClick={startCreate}>
            Создать сценарий
          </Button>
        )}
      </Box>

      {selectedHouseId == null ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Выберите дом на главной, чтобы видеть и создавать сценарии для этого дома.
        </Alert>
      ) : forbidden || !canManageGroups ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Раздел «Сценарии» доступен только владельцу дома и совладельцу.
        </Alert>
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: 1.5, color: '#fff' }}>
          Созданные сценарии
        </Typography>
          {groupsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={32} sx={{ color: '#F08B5C' }} />
            </Box>
          ) : groups.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3, bgcolor: 'rgba(25,118,210,0.15)' }}>
              Сценариев пока нет. Нажмите «Создать сценарий» справа сверху.
            </Alert>
          ) : (
            <Grid container spacing={2} sx={{ mb: 2, justifyContent: 'flex-start' }}>
            {groups.map((g) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  lg={3}
                  key={g.groupId}
                  sx={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}
                >
                  <Box
                    onClick={() => openEditor(g)}
                    sx={{
                      width: '100%',
                      maxWidth: 340,
                      pt: '4px',
                      pb: '1px',
                      overflow: 'visible',
                      borderRadius: 4,
                      cursor: 'pointer',
                      '& .group-card-inner': {
                        transition: 'transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                      },
                      '&:hover .group-card-inner': {
                        transform: 'translateY(-3px)',
                        borderColor: 'rgba(240, 139, 92, 0.5)',
                        boxShadow: '0 6px 18px 0 rgba(240, 139, 92, 0.15)',
                      },
                    }}
                  >
                    <Card className="group-card-inner" sx={groupCardSx}>
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', p: 2, minWidth: 0, width: '100%', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1 }}>
                          <GroupWorkIcon sx={{ color: '#F08B5C', fontSize: 32, flexShrink: 0 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 600, color: '#fff', lineHeight: 1.3, wordBreak: 'break-word' }}
                            >
                        {g.name}
                      </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mt: 0.5 }}>
                              Устройств: {g.commands.length}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 'auto',
                            color: 'rgba(255,255,255,0.72)',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: 72,
                          }}
                        >
                          {g.description?.trim() ? g.description : 'Без пояснения'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <DevicePickDialog
        key={`create-pick-${createPickKey}`}
        open={createPickOpen}
        title="Выберите устройства для нового сценария"
        devices={houseDevices}
        rooms={rooms}
        initialSelected={createSelectedIds}
        onClose={() => setCreatePickOpen(false)}
        onConfirm={onCreatePickConfirm}
      />

      <DevicePickDialog
        open={editPickOpen}
        title="Редактирование — выберите устройства"
        devices={houseDevices}
        rooms={rooms}
        initialSelected={editCommands.map((c) => c.deviceId)}
        onClose={() => setEditPickOpen(false)}
        onConfirm={onEditPickConfirm}
        actionsLeft={
          <Button variant="text" sx={{ color: 'rgba(255,255,255,0.92)' }} onClick={() => setEditGroupMetaOpen(true)}>
            Название и пояснение
          </Button>
        }
      />

      <Dialog open={editGroupMetaOpen} onClose={() => setEditGroupMetaOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Название и пояснение</DialogTitle>
        <DialogContent>
          <TextField
            label="Название"
            value={editName}
            onChange={(e) => setEditName(e.target.value.slice(0, NAME_MAX))}
            fullWidth
            size="small"
            sx={{ mb: 2, mt: 0.5 }}
            inputProps={{ maxLength: NAME_MAX }}
            helperText={`${editName.length}/${NAME_MAX}`}
          />
          <TextField
            label="Пояснение"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value.slice(0, DESC_MAX))}
            fullWidth
            size="small"
            multiline
            minRows={3}
            inputProps={{ maxLength: DESC_MAX }}
            helperText={`${editDescription.length}/${DESC_MAX}`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditGroupMetaOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => void saveEditGroupMeta()} disabled={metaSaveBusy}>
            {metaSaveBusy ? <CircularProgress size={22} color="inherit" /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createMetaOpen} onClose={() => setCreateMetaOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новый сценарий</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 2 }}>
            Выбрано устройств: {createSelectedIds.length}
          </Typography>
          <TextField
            label="Название"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value.slice(0, NAME_MAX))}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            inputProps={{ maxLength: NAME_MAX }}
            helperText={`${draftName.length}/${NAME_MAX}`}
          />
          <TextField
            label="Пояснение"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value.slice(0, DESC_MAX))}
            fullWidth
            size="small"
            multiline
            minRows={3}
            inputProps={{ maxLength: DESC_MAX }}
            helperText={`${draftDescription.length}/${DESC_MAX}`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setCreateMetaOpen(false);
              setCreatePickKey((k) => k + 1);
              setCreatePickOpen(true);
            }}
          >
            Назад к выбору
          </Button>
          <Button onClick={() => setCreateMetaOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => void submitCreate()} disabled={createBusy}>
            {createBusy ? <CircularProgress size={22} color="inherit" /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen && !!editingGroup}
        onClose={() => void closeEditor()}
        fullWidth
        maxWidth="lg"
        scroll="paper"
        sx={{
          '& .MuiDialog-paper': {
            height: { xs: '92vh', sm: '90vh' },
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {editingGroup && (
          <>
            <DialogTitle sx={{ pb: 1, pt: 2, flexShrink: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'nowrap',
                }}
              >
                <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mb: 0.25 }}>
                    Редактирование сценария
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {editName.trim() || editingGroup.name}
          </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end', flexShrink: 0 }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    sx={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
                    startIcon={<EventIcon />}
                    onClick={() => setGroupScheduleOpen(true)}
                  >
                    Расписание
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={applyBusy ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                    disabled={applyBusy || editCommands.length === 0}
                    onClick={() => void applyGroup(editCommands)}
                  >
                    Применить сценарий
          </Button>
        </Box>
      </Box>
            </DialogTitle>
            <DialogContent
              dividers
              sx={{
                flex: '1 1 0',
                minHeight: 0,
                overflow: 'auto',
                ...scrollbarLikeDevicesSx,
                bgcolor: 'rgba(0,0,0,0.15)',
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
                <Button variant="outlined" size="small" onClick={() => setEditPickOpen(true)}>
                  Редактирование
                </Button>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                  В сценарии: {editCommands.length} устройств
                </Typography>
              </Box>
              <Grid container spacing={3}>
                {editCommands.map((cmd) => {
                  const base = deviceMap.get(cmd.deviceId);
                  if (!base) return null;
                  const dev = buildScenarioDevice(base, cmd);
                  return (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      lg={isOnly3DeviceCards ? 4 : 3}
                      key={cmd.deviceId}
                      sx={{ display: 'flex', minHeight: 248, minWidth: 0, contentVisibility: 'auto' }}
                    >
                      <GlassDeviceCard
                        device={dev}
                        onToggle={handleScenarioToggle}
                        onSettingsChange={handleScenarioSettings}
                        onFrontError={(msg) => setToast({ open: true, message: msg, severity: 'error' })}
                        size="medium"
                        compact
                        reducedBlur
                        hideAuxControls
                        scenarioDraft
                        onOpenDetails={() => setDetailDeviceId(cmd.deviceId)}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
              <Button color="error" variant="outlined" onClick={() => void deleteGroup()}>
                Удалить сценарий
              </Button>
              <Button onClick={() => void closeEditor()} disabled={saveBusy}>
                {saveBusy ? <CircularProgress size={20} /> : 'Закрыть'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={!!detailDevice}
        onClose={() => setDetailDeviceId(null)}
        fullWidth
        maxWidth="md"
        sx={{ '& .MuiDialog-paper': { width: 'min(92vw, 680px)' } }}
      >
        <DialogContent sx={{ p: 2 }}>
          {detailDevice && (
            <GlassDeviceCard
              device={detailDevice}
              onToggle={handleScenarioToggle}
              onSettingsChange={handleScenarioSettings}
              onFrontError={(msg) => setToast({ open: true, message: msg, severity: 'error' })}
              size="large"
              hideAuxControls
              scenarioDraft
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedHouseId != null && editingGroupId != null && (
        <GroupScheduleDialog
          open={groupScheduleOpen}
          onClose={() => setGroupScheduleOpen(false)}
          houseId={selectedHouseId}
          groupId={editingGroupId}
          groupName={editName.trim() || editingGroup?.name || ''}
        />
      )}
    </GlassPage>
  );
};
