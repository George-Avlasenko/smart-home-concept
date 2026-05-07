import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, Typography, Switch, Box, IconButton, Tooltip, Slider, FormControl, Select, MenuItem, InputLabel, Checkbox, FormControlLabel, Collapse, Alert, Stack, TextField, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { DeviceStatus } from '../types';
import type { Device } from '../types';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import CoffeeIcon from '@mui/icons-material/Coffee';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SensorsIcon from '@mui/icons-material/Sensors';
import OutletIcon from '@mui/icons-material/Power';
import WindowIcon from '@mui/icons-material/Window';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CurtainsIcon from '@mui/icons-material/Curtains';
import OpacityIcon from '@mui/icons-material/Opacity';
import AirIcon from '@mui/icons-material/Air';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import { ScheduleDialog } from './ScheduleDialog';
import { SensorStatsDialog } from './SensorStatsDialog';
import { useAuth } from '../context/AuthContext';
import { tuyaApi } from '../api/tuyaClient';
import { DeskLampIcon, SwitchLeverIcon, isBreakerSwitch, isDeskLamp } from './DeviceIcons';

type TuyaColorPending = { h: number; s: number; v: number };
type TuyaEnergyStats = {
  voltageV?: number;
  currentA?: number;
  powerW?: number;
  energyKwh?: number;
};

function parseTuyaEnergyStats(raw: any): TuyaEnergyStats {
  const dps = raw?.dps && typeof raw.dps === 'object' ? raw.dps : {};
  const n = (k: string): number | undefined => {
    const v = dps[k];
    if (v == null) return undefined;
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };

  // Most Tuya plugs: 18=current(mA), 19=power(0.1W), 20=voltage(0.1V)
  const currentA = n('18') != null ? n('18')! / 1000 : n('102');
  const powerW = n('19') != null ? n('19')! / 10 : n('101');
  const voltageV = n('20') != null ? n('20')! / 10 : n('103');
  const energyKwh =
    n('17') != null
      ? n('17')! / 1000
      : n('104') != null
        ? n('104')!
        : undefined;

  return { voltageV, currentA, powerW, energyKwh };
}

function withOutletDefaults(s: TuyaEnergyStats): Required<TuyaEnergyStats> {
  return {
    voltageV: s.voltageV ?? 220,
    currentA: s.currentA ?? 0,
    powerW: s.powerW ?? 0,
    energyKwh: s.energyKwh ?? 0,
  };
}

function pickNumber(obj: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sensorKindOf(device: Device, settings: Record<string, any>): 'climate' | 'power' | 'water' | 'gas' | 'generic' {
  const sku = String(device.productSku ?? settings.catalogSku ?? '').toLowerCase();
  const name = String(device.name ?? '').toLowerCase();
  if (sku.includes('meter-power') || /\b(энерг|электро|power)\b/.test(name)) return 'power';
  if (sku.includes('meter-water') || /\b(вода|water)\b/.test(name)) return 'water';
  if (sku.includes('meter-gas') || /\b(газ|gas)\b/.test(name)) return 'gas';
  return 'climate';
}

/** Из MetaData после создания устройства; если нет — старые записи: CCT да, RGB нет. */
function parseLightCapabilities(
  localSettings: Record<string, any>,
  settings: Record<string, any>,
): { cct: boolean; rgb: boolean } {
  const raw = localSettings?.lightCapabilities ?? settings?.lightCapabilities;
  if (raw == null || typeof raw !== 'object') {
    return { cct: true, rgb: false };
  }
  const o = raw as Record<string, unknown>;
  const truthy = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    cct: truthy(o.cct),
    rgb: truthy(o.rgb),
  };
}

interface GlassDeviceCardProps {
  device: Device;
  onToggle: (id: number, status: DeviceStatus) => void;
  onSettingsChange?: (id: number, settings: Record<string, any>) => void;
  onFrontError?: (message: string) => void;
  size?: 'small' | 'medium' | 'large';
  /** Компактный режим для списка: без ползунков настроек. */
  compact?: boolean;
  /** Клик по карточке (например, открыть отдельное окно деталей). */
  onOpenDetails?: (device: Device) => void;
  /** Меньший blur для списков — быстрее скролл */
  reducedBlur?: boolean;
  /** Без backdrop-filter: только rgba (страница устройств) */
  alphaGlass?: boolean;
  /** Скрыть расписание и статистику (режим редактирования сценария/группы) */
  hideAuxControls?: boolean;
  /** Только черновик сценария: не слать команды в Tuya-сервис, только обновлять настройки через onSettingsChange */
  scenarioDraft?: boolean;
}

const GlassDeviceCardInner: React.FC<GlassDeviceCardProps> = ({ 
  device, 
  onToggle, 
  onSettingsChange,
  onFrontError,
  size = 'medium',
  compact = false,
  onOpenDetails,
  reducedBlur = false,
  alphaGlass = true,
  hideAuxControls = false,
  scenarioDraft = false,
}) => {
  const { user } = useAuth();
  const isLight = device.type.toLowerCase() === 'light';
  const isActive = device.status.toLowerCase() === 'active';
  const settings = device.settings || {};
  const permission = (device.currentUserPermission || 'viewer').toLowerCase();
  const isGlobalAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isReadOnly = permission === 'viewer';
  const canViewStatistics = permission === 'admin';
  const canManageSchedule = permission === 'admin' || permission === 'user';
  
  const [localSettings, setLocalSettings] = useState(settings);

  const currentTempDisplay = Number(
    settings.currentTemp ?? settings.temp ?? localSettings.currentTemp ?? localSettings.temp ?? 21
  );
  const productFeatures = Array.isArray(settings.productFeatures) ? settings.productFeatures.map((x: any) => String(x).toUpperCase()) : [];
  const supportsIonization = device.type.toLowerCase() === 'thermostat' && productFeatures.includes('ION');
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openStats, setOpenStats] = useState(false);
  const [tuyaError, setTuyaError] = useState('');
  const [tuyaEnergy, setTuyaEnergy] = useState<TuyaEnergyStats>({});
  const outletEnergyView = withOutletDefaults(tuyaEnergy);
  const setTuyaErrorBoth = useCallback((message: string) => {
    setTuyaError(message);
    if (message.trim()) onFrontError?.(message);
  }, [onFrontError]);

  const [settingsExpanded, setSettingsExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const tuyaFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tuyaFlushInFlightRef = useRef(false);
  const tuyaPendingRef = useRef<{ brightness?: number; kelvin?: number; color?: TuyaColorPending }>({});
  const tuyaModeRef = useRef<'white' | 'colour'>('white');
  const tuyaSuppressColorUntilRef = useRef(0);
  const tuyaWhiteLockRef = useRef(false);
  const isTuyaLight = !scenarioDraft && isLight && !!(localSettings?.tuya?.enabled || settings?.tuya?.enabled);
  const lightCaps = isLight ? parseLightCapabilities(localSettings, settings) : { cct: false, rgb: false };
  const showLightCct = isLight && lightCaps.cct;
  const showLightRgb = isLight && lightCaps.rgb;
  const isInteractiveElement = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('button, a, input, textarea, select, [role="button"], [data-no-open-details="true"]');
  };
  const getTuyaBasePayload = useCallback(() => {
    const tuya = (localSettings?.tuya ?? settings?.tuya ?? {}) as Record<string, unknown>;
    const dpsSwitchParsed = Number.parseInt(String(tuya.dpsSwitch ?? ''), 10);
    const ipFromTuya = String(tuya.ip ?? '').trim();
    const ipFromDevice = String(device.ip ?? '').trim();
    return {
      device_id: String(tuya.deviceId ?? device.hardwareDeviceId ?? '').trim(),
      local_key: String(tuya.localKey ?? ''),
      ip: ipFromTuya || ipFromDevice,
      version: String(tuya.version ?? '3.5'),
      dps_switch: Number.isFinite(dpsSwitchParsed) && dpsSwitchParsed > 0 ? dpsSwitchParsed : 20,
    };
  }, [localSettings, settings, device.ip, device.hardwareDeviceId]);

  const canSendToTuya = useCallback(() => {
    const p = getTuyaBasePayload();
    return p.device_id.length > 0 && p.local_key.length > 0 && p.ip.length > 0;
  }, [getTuyaBasePayload]);

  const sendTuyaSwitch = useCallback(async (on: boolean) => {
    if (!canSendToTuya()) {
      setTuyaErrorBoth('Для управления Tuya нужны Device ID, local key и IP.');
      return;
    }
    try {
      await tuyaApi.post('/v1/switch', { ...getTuyaBasePayload(), on });
      setTuyaErrorBoth('');
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = typeof data === 'string'
        ? data
        : data?.detail || data?.message || err?.message || `Ошибка управления Tuya (${err?.response?.status ?? 'network'})`;
      setTuyaErrorBoth(String(detail));
    }
  }, [canSendToTuya, getTuyaBasePayload, setTuyaErrorBoth]);

  const flushTuyaPending = useCallback(async () => {
    tuyaFlushTimerRef.current = null;
    if (tuyaFlushInFlightRef.current) return;
    if (!canSendToTuya()) {
      tuyaPendingRef.current = {};
      return;
    }
    const pending = tuyaPendingRef.current;
    tuyaPendingRef.current = {};
    tuyaFlushInFlightRef.current = true;
    try {
      if (typeof pending.brightness === 'number') {
        const safeBrightness = Math.max(1, Math.min(100, Math.round(pending.brightness)));
        await tuyaApi.post('/v1/brightness', { ...getTuyaBasePayload(), percent: safeBrightness });
      }
      if (typeof pending.kelvin === 'number') {
        await tuyaApi.post('/v1/temperature', { ...getTuyaBasePayload(), kelvin: pending.kelvin });
      }
      if (pending.color) {
        const c = pending.color;
        await tuyaApi.post('/v1/color', {
          ...getTuyaBasePayload(),
          h: c.h,
          s_percent: c.s,
          v_percent: c.v,
        });
      }
      setTuyaErrorBoth('');
    } catch (err: any) {
      const data = err?.response?.data;
      const detail = typeof data === 'string'
        ? data
        : data?.detail || data?.message || err?.message || `Ошибка управления Tuya (${err?.response?.status ?? 'network'})`;
      setTuyaErrorBoth(String(detail));
    } finally {
      tuyaFlushInFlightRef.current = false;
      // If something new came while request was in flight, flush again (single-flight queue).
      if (Object.keys(tuyaPendingRef.current).length > 0 && !tuyaFlushTimerRef.current) {
        tuyaFlushTimerRef.current = setTimeout(() => {
          void flushTuyaPending();
        }, 120);
      }
    }
  }, [canSendToTuya, getTuyaBasePayload, setTuyaErrorBoth]);

  const queueTuyaLiveUpdate = useCallback(
    (patch: { brightness?: number; kelvin?: number; color?: TuyaColorPending }) => {
      const now = Date.now();
      const prev = tuyaPendingRef.current;
      let next = { ...prev, ...patch };

      // white-mode and colour-mode are mutually exclusive on many Tuya bulbs.
      if (patch.kelvin !== undefined) {
        tuyaModeRef.current = 'white';
        tuyaWhiteLockRef.current = true;
        tuyaSuppressColorUntilRef.current = now + 1600;
        next = {
          brightness: patch.brightness ?? prev.brightness,
          kelvin: patch.kelvin,
        };
      } else if (patch.color !== undefined) {
        if (tuyaWhiteLockRef.current) return;
        tuyaModeRef.current = 'colour';
        tuyaSuppressColorUntilRef.current = 0;
        next = {
          color: patch.color,
        };
      } else if (tuyaModeRef.current === 'white') {
        delete next.color;
      } else if (tuyaModeRef.current === 'colour') {
        delete next.kelvin;
      }

      if (tuyaWhiteLockRef.current || tuyaSuppressColorUntilRef.current > now) delete next.color;
      tuyaPendingRef.current = next;
      if (tuyaFlushInFlightRef.current) return;
      if (tuyaFlushTimerRef.current) return;
      tuyaFlushTimerRef.current = setTimeout(() => {
        void flushTuyaPending();
      }, 120);
    },
    [flushTuyaPending],
  );

  useEffect(() => {
    return () => {
      if (tuyaFlushTimerRef.current) clearTimeout(tuyaFlushTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // При смене устройства/настроек не тянем старую ошибку.
    setTuyaError('');
  }, [device.deviceId, settings]);

  useEffect(() => {
    const isOutlet = device.type.toLowerCase() === 'outlet';
    const tuyaEnabled = !!(localSettings?.tuya?.enabled || settings?.tuya?.enabled);
    const canPoll = !scenarioDraft && isOutlet && tuyaEnabled;
    if (!canPoll) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await tuyaApi.post('/v1/status', getTuyaBasePayload());
        if (cancelled) return;
        setTuyaEnergy(parseTuyaEnergyStats(data?.raw));
      } catch {
        // silent: outlet still can be switched from backend status toggle.
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [device.type, localSettings, settings, scenarioDraft, getTuyaBasePayload]);

  // Отправляем изменения настроек на сервер с задержкой
  useEffect(() => {
    const settingsStr = JSON.stringify(settings);
    const localStr = JSON.stringify(localSettings);
    
    if (settingsStr !== localStr && Object.keys(localSettings).length > 0) {
      const timer = setTimeout(() => {
        onSettingsChange?.(device.deviceId, localSettings);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [localSettings, settings, device.deviceId, onSettingsChange]);

  const handleLocalChange = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStatus = e.target.checked ? DeviceStatus.Active : DeviceStatus.Inactive;
    onToggle(device.deviceId, newStatus);
  };

  const getIcon = () => {
    const type = device.type.toLowerCase();
    const iconSize = size === 'large' ? 'large' : size === 'small' ? 'small' : 'medium';
    const iconColor = isActive ? '#F08B5C' : 'rgba(255, 255, 255, 0.5)';
    
    switch (type) {
      case 'light':
        return isDeskLamp(device)
          ? <DeskLampIcon fontSize={iconSize} sx={{ color: iconColor }} />
          : <LightbulbIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'thermostat': return <ThermostatIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'kettle': return <CoffeeIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'switch':
        return isBreakerSwitch(device)
          ? <PowerSettingsNewIcon fontSize={iconSize} sx={{ color: iconColor }} />
          : <SwitchLeverIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'outlet': return <OutletIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'vacuum': return <CleaningServicesIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'curtain': return <CurtainsIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'lock': return isActive ? <LockIcon fontSize={iconSize} sx={{ color: '#FF6B6B' }} /> : <LockOpenIcon fontSize={iconSize} sx={{ color: '#4ECDC4' }} />;
      case 'window': return <WindowIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'camera':
      case 'ipc':
      case 'sp':
        return <VideocamIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'sensor': return <SensorsIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'humidifier': return <OpacityIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'ventilation': return <AirIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      default: return <PowerSettingsNewIcon fontSize={iconSize} sx={{ color: iconColor }} />;
    }
  };

  // Единая сетка высот: small / medium / large
  const sizeHeights = { small: 168, medium: 248, large: 320 };
  const minCardHeight = sizeHeights[size];
  const cardHeight = size === 'large' ? '100%' : `${minCardHeight}px`;
  const isLarge = size === 'large';

  const selectMenuPaperSx = alphaGlass
    ? { background: 'rgba(22, 26, 48, 0.98)', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: '1px solid rgba(255, 255, 255, 0.2)' }
    : { background: 'rgba(30, 30, 30, 0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.2)' };

  const cardBg = alphaGlass
    ? isActive && isLarge
      ? 'linear-gradient(135deg, rgba(240, 139, 92, 0.32) 0%, rgba(255, 255, 255, 0.14) 100%)'
      : 'rgba(255, 255, 255, 0.14)'
    : isActive && isLarge
      ? 'linear-gradient(135deg, rgba(240, 139, 92, 0.18) 0%, rgba(255, 255, 255, 0.1) 100%)'
      : 'rgba(255, 255, 255, 0.1)';

  const cardBlur = alphaGlass
    ? { backdropFilter: 'none', WebkitBackdropFilter: 'none' }
    : {
        backdropFilter: reducedBlur ? 'blur(8px)' : 'blur(36px)',
        WebkitBackdropFilter: reducedBlur ? 'blur(8px)' : 'blur(36px)',
      };

  return (
      <Card
      sx={{
        width: '100%',
        height: cardHeight,
        minHeight: minCardHeight,
        display: 'flex',
        flexDirection: 'column',
        background: cardBg,
        ...cardBlur,
        border: isActive
          ? '1px solid rgba(240, 139, 92, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: isActive
          ? '0 4px 14px 0 rgba(240, 139, 92, 0.2)'
          : '0 4px 14px 0 rgba(0, 0, 0, 0.24)',
        borderRadius: 4,
        // При скроллинге hover/transform может давать подлагивания, поэтому для списков (reducedBlur) делаем анимацию легче.
        transition: reducedBlur ? 'border-color 0.25s ease' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease',
        opacity: device.status === 'offline' ? 0.5 : 1,
        '&:hover': {
          boxShadow: reducedBlur || isLarge ? undefined : '0 6px 18px 0 rgba(240, 139, 92, 0.24)',
          transform: reducedBlur || isLarge ? 'none' : 'translateY(-4px)',
          border: '1px solid rgba(240, 139, 92, 0.5)',
        },
        cursor: compact && onOpenDetails ? 'pointer' : 'default',
      }}
      onClick={(e) => {
        if (!compact || !onOpenDetails) return;
        // Dialogs are rendered via portal; React synthetic click may bubble to this handler
        // even when user clicks inside the dialog. Ignore anything outside the card DOM.
        if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
        if (isInteractiveElement(e.target)) return;
        onOpenDetails(device);
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: isLarge ? 4 : 2.5, overflow: 'hidden', minHeight: 0 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
          sx={{ minWidth: 0, flexWrap: 'wrap', rowGap: 1, columnGap: 2 }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flex: '1 1 240px',
            minWidth: 0,
          }}>
            {getIcon()}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography 
                variant={isLarge ? "h5" : "h6"} 
                sx={{ 
                  fontWeight: 600,
                  color: '#FFFFFF',
                  mb: 0.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                }}
              >
                {device.name}
              </Typography>
            </Box>
          </Box>
          
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              marginLeft: 'auto',
              maxWidth: '100%',
            }}
          >
            {!hideAuxControls && canViewStatistics && (
              <Tooltip title="Статистика">
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); setOpenStats(true); }}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <BarChartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {!hideAuxControls && canManageSchedule && device.type.toLowerCase() !== 'sensor' && (
              <Tooltip title="Расписание">
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); setOpenSchedule(true); }}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <AccessTimeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {!['sensor', 'window', 'curtain'].includes(device.type.toLowerCase()) && (
              <Switch
                checked={isActive}
                onChange={handleToggle}
                onClick={(e) => e.stopPropagation()}
                disabled={device.status === 'offline' || isReadOnly}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#F08B5C',
                    '& + .MuiSwitch-track': {
                      backgroundColor: '#F08B5C',
                    },
                  },
                }}
              />
            )}
          </Box>
        </Box>

        {!!tuyaError && isLight && !onFrontError && !scenarioDraft && (
          <Alert
            severity="error"
            sx={{
              mb: 1,
              py: 0.5,
              alignItems: 'center',
              position: 'relative',
              zIndex: 2,
              '& .MuiAlert-message': { fontSize: 12, lineHeight: 1.35 },
            }}
          >
            {tuyaError}
          </Alert>
        )}
        {/* Дополнительные настройки */}
        {compact && device.type.toLowerCase() === 'light' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block' }}>
              Яркость: {localSettings.brightness ?? 100}%
            </Typography>
            {showLightCct && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mt: 0.4 }}>
                Теплота света: {localSettings.colorTempKelvin ?? 4200}K
              </Typography>
            )}
            {showLightRgb && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mt: 0.4 }}>
                Цвет RGB: H {Math.round(Number(localSettings.colorHue ?? 0))}° · S {Math.round(Number(localSettings.colorSat ?? 100))}%
              </Typography>
            )}
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'outlet' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              {`Мощность: ${outletEnergyView.powerW.toFixed(1)} Вт`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
              {`Напряжение: ${outletEnergyView.voltageV.toFixed(1)} В`}
              {' • '}
              {`Ток: ${outletEnergyView.currentA.toFixed(3)} А`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
              {`Энергия: ${outletEnergyView.energyKwh.toFixed(3)} кВт·ч`}
            </Typography>
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'sensor' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            {(() => {
              const kind = sensorKindOf(device, settings);
              if (kind === 'climate') {
                return (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
                      Температура: {settings.currentTemp ?? settings.temp ?? '—'}°C
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
                      Влажность: {settings.humidity ?? '—'}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
                      CO₂: {settings.co2 ?? settings.coPpm ?? settings.co ?? '—'} ppm
                    </Typography>
                  </>
                );
              }
              if (kind === 'power') {
                return (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
                      Мощность: {(pickNumber(settings, ['powerW', 'power', 'activePower']) ?? 0).toFixed(1)} Вт
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
                      Энергия: {(pickNumber(settings, ['energyKwh', 'energy', 'totalKwh']) ?? 0).toFixed(3)} кВт·ч
                    </Typography>
                  </>
                );
              }
              if (kind === 'water') {
                return (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
                      Расход воды: {(pickNumber(settings, ['waterM3', 'volumeM3', 'totalM3']) ?? 0).toFixed(3)} м³
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
                      Поток: {(pickNumber(settings, ['flowLpm', 'flowRate', 'flow']) ?? 0).toFixed(2)}
                    </Typography>
                  </>
                );
              }
              if (kind === 'gas') {
                return (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
                      Расход газа: {(pickNumber(settings, ['gasM3', 'volumeM3', 'totalM3']) ?? 0).toFixed(3)} м³
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
                      Поток: {(pickNumber(settings, ['flowM3h', 'flowRate', 'flow']) ?? 0).toFixed(3)} м³/ч
                    </Typography>
                  </>
                );
              }
              return null;
            })()}
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'window' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              Состояние: {localSettings.mode === 'opened' ? 'Открыто' : localSettings.mode === 'tilted' ? 'Проветривание' : 'Закрыто'}
            </Typography>
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'curtain' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              Состояние: {isActive ? 'Открыты' : 'Закрыты'}
            </Typography>
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'humidifier' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              Влажность: {settings.humidity ?? localSettings.humidity ?? '—'}%
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
              Цель: {localSettings.targetHumidity ?? 50}%
            </Typography>
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'ventilation' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              CO₂: {settings.co2 ?? settings.coPpm ?? localSettings.co2 ?? '—'} ppm
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
              Диапазон: {localSettings.co2Min ?? 800}–{localSettings.co2Max ?? 1200} ppm
            </Typography>
          </Box>
        )}
        {compact && device.type.toLowerCase() === 'thermostat' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block' }}>
              Целевая: {localSettings.targetTemp ?? 22}°C
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', display: 'block', mt: 0.35 }}>
              Текущая: {Number.isFinite(currentTempDisplay) ? currentTempDisplay : 21}°C
            </Typography>
          </Box>
        )}

        {!compact && (
        <>
            {device.type.toLowerCase() === 'light' && (
          <Box mt={2}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}>
              Яркость: {localSettings.brightness ?? 100}%
            </Typography>
            <Slider 
              value={localSettings.brightness ?? 100} 
              onChange={(_, val) => {
                const brightness = Math.max(1, Math.min(100, Math.round(Number(val))));
                handleLocalChange('brightness', brightness);
                if (isTuyaLight) {
                  if (showLightRgb && tuyaModeRef.current === 'colour') {
                    queueTuyaLiveUpdate({
                      color: {
                        h: Math.round(Number(localSettings.colorHue ?? 0)),
                        s: Math.round(Number(localSettings.colorSat ?? 100)),
                        v: brightness,
                      },
                    });
                  } else {
                    queueTuyaLiveUpdate({ brightness });
                  }
                }
              }} 
              min={1} 
              max={100} 
              disabled={isReadOnly || device.status === 'offline'}
              size="small"
              sx={{
                color: '#F08B5C',
                '& .MuiSlider-thumb': {
                  boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)',
                },
              }}
            />
            {showLightCct && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Теплота света: {localSettings.colorTempKelvin ?? 4200}K
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <Slider
                  value={localSettings.colorTempKelvin ?? 4200}
                  onChange={(_, val) => {
                    const kelvin = Number(val);
                    handleLocalChange('colorTempKelvin', kelvin);
                    if (isTuyaLight) {
                      tuyaModeRef.current = 'white';
                      tuyaWhiteLockRef.current = true;
                      // Hard reset stale color queue before applying warmth.
                      tuyaPendingRef.current = { kelvin };
                      queueTuyaLiveUpdate({ kelvin });
                    }
                  }}
                  min={2700}
                  max={6500}
                  step={50}
                  disabled={isReadOnly || device.status === 'offline'}
                  valueLabelDisplay="auto"
                  size="small"
                  sx={{
                    color: '#F08B5C',
                    '& .MuiSlider-thumb': {
                      boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)',
                    },
                  }}
                />
              </Box>
            </Box>
            )}
            {showLightRgb && (
            <Box sx={{ mt: showLightCct ? 1.5 : 0.5 }}>
              <FormControlLabel
                sx={{
                  m: 0,
                  width: '100%',
                  borderRadius: 1,
                  px: 0.25,
                  py: 0.25,
                  cursor: (isReadOnly || device.status === 'offline') ? 'default' : 'pointer',
                  '&:hover': {
                    backgroundColor: (isReadOnly || device.status === 'offline') ? 'transparent' : 'rgba(255,255,255,0.06)',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isReadOnly || device.status === 'offline') return;
                  const nextExpanded = settingsExpanded !== 'lightRgb';
                  setSettingsExpanded(nextExpanded ? 'lightRgb' : null);
                  // Для RGB-only ламп раскрытие RGB-блока сразу фиксирует режим в colour.
                  if (nextExpanded && isTuyaLight && !showLightCct) {
                    tuyaModeRef.current = 'colour';
                    tuyaWhiteLockRef.current = false;
                    tuyaSuppressColorUntilRef.current = 0;
                    const v = Math.max(1, Math.min(100, Math.round(Number(localSettings.brightness ?? 100))));
                    queueTuyaLiveUpdate({
                      color: {
                        h: Math.round(Number(localSettings.colorHue ?? 0)),
                        s: Math.round(Number(localSettings.colorSat ?? 100)),
                        v,
                      },
                    });
                  }
                }}
                control={
                  <Checkbox
                    checked={settingsExpanded === 'lightRgb'}
                    onChange={() => { /* toggle handled by row click */ }}
                    disabled={isReadOnly || device.status === 'offline'}
                    sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#7E57C2' }, p: 0.5, mr: 0.25 }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Цвет (RGB): оттенок {Math.round(Number(localSettings.colorHue ?? 0))}° · насыщ. {Math.round(Number(localSettings.colorSat ?? 100))}%
                  </Typography>
                }
              />
              <Collapse in={settingsExpanded === 'lightRgb'} unmountOnExit>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 0.5 }}>Оттенок (0–360°)</Typography>
                  <Slider
                    value={Number(localSettings.colorHue ?? 0)}
                    onChange={(_, val) => {
                      const h = Math.round(Number(val));
                      handleLocalChange('colorHue', h);
                      if (isTuyaLight) {
                        tuyaModeRef.current = 'colour';
                        tuyaWhiteLockRef.current = false;
                        const v = Math.max(1, Math.min(100, Math.round(Number(localSettings.brightness ?? 100))));
                        queueTuyaLiveUpdate({
                          color: {
                            h,
                            s: Math.round(Number(localSettings.colorSat ?? 100)),
                            v,
                          },
                        });
                      }
                    }}
                    min={0}
                    max={360}
                    step={1}
                    disabled={isReadOnly || device.status === 'offline'}
                    valueLabelDisplay="auto"
                    size="small"
                    sx={{
                      color: '#7E57C2',
                      '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(126, 87, 194, 0.55)' },
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 0.5 }}>Насыщенность</Typography>
                  <Slider
                    value={Number(localSettings.colorSat ?? 100)}
                    onChange={(_, val) => {
                      const s = Math.round(Math.max(0, Math.min(100, Number(val))));
                      handleLocalChange('colorSat', s);
                      if (isTuyaLight) {
                        tuyaModeRef.current = 'colour';
                        tuyaWhiteLockRef.current = false;
                        const v = Math.max(1, Math.min(100, Math.round(Number(localSettings.brightness ?? 100))));
                        queueTuyaLiveUpdate({
                          color: {
                            h: Math.round(Number(localSettings.colorHue ?? 0)),
                            s,
                            v,
                          },
                        });
                      }
                    }}
                    min={0}
                    max={100}
                    disabled={isReadOnly || device.status === 'offline'}
                    valueLabelDisplay="auto"
                    size="small"
                    sx={{
                      color: '#5C6BC0',
                      '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(92, 107, 192, 0.5)' },
                    }}
                  />
                </Box>
              </Box>
              </Collapse>
            </Box>
            )}

          </Box>
            )}

            {device.type.toLowerCase() === 'thermostat' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.75 }}>
              {localSettings.useTempRange
                ? `Диапазон: ${localSettings.minTemp ?? 18}–${localSettings.maxTemp ?? 24}°C`
                : `Целевая: ${localSettings.targetTemp ?? 22}°C`}
              {isActive && ` • Текущая: ${Number.isFinite(currentTempDisplay) ? currentTempDisplay : 21}°C`}
            </Typography>
            <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!localSettings.useTempRange}
                      onChange={(_, checked) => handleLocalChange('useTempRange', checked)}
                      disabled={isReadOnly || device.status === 'offline'}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>По диапазону (мин–макс)</Typography>}
                />
                {localSettings.useTempRange ? (
                  <>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                      <Slider size="small" value={localSettings.minTemp ?? 18} min={14} max={28} step={1}
                        onChange={(_, v) => handleLocalChange('minTemp', v as number)} valueLabelDisplay="auto"
                        disabled={isReadOnly || device.status === 'offline'}
                        sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                      <Slider size="small" value={localSettings.maxTemp ?? 24} min={16} max={30} step={1}
                        onChange={(_, v) => handleLocalChange('maxTemp', v as number)} valueLabelDisplay="auto"
                        disabled={isReadOnly || device.status === 'offline'}
                        sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5, display: 'block' }}>Целевая °C</Typography>
                    <Slider value={localSettings.targetTemp ?? 22} onChange={(_, val) => handleLocalChange('targetTemp', val)} min={16} max={30} step={0.5}
                      disabled={isReadOnly || device.status === 'offline'} valueLabelDisplay="auto" size="small"
                      sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                  </>
                )}
                {supportsIonization && (
                  <FormControlLabel
                    sx={{ mt: 0.5 }}
                    control={
                      <Checkbox
                        checked={!!localSettings.ionization}
                        onChange={(_, checked) => handleLocalChange('ionization', checked)}
                        disabled={isReadOnly || device.status === 'offline'}
                        sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#4ECDC4' } }}
                      />
                    }
                    label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>Ионизация</Typography>}
                  />
                )}
            </Box>
          </Box>
        )}

        {device.type.toLowerCase() === 'kettle' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}>
              Нагреть до: {localSettings.targetTemp ?? 100}°C
            </Typography>
            <Slider 
              value={localSettings.targetTemp ?? 100} 
              onChange={(_, val) => handleLocalChange('targetTemp', val)} 
              min={40} 
              max={100} 
              step={5}
              marks
              disabled={isReadOnly || device.status === 'offline'}
              valueLabelDisplay="auto"
              size="small"
              sx={{
                color: '#F08B5C',
                '& .MuiSlider-thumb': {
                  boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mt: 1 }}>
              {isActive 
                ? `Статус: Кипячение... • Текущая: ${settings.currentTemp ?? 20}°C`
                : `Статус: Ожидание • Текущая: ${settings.currentTemp ?? 20}°C`
              }
            </Typography>
          </Box>
        )}

        {device.type.toLowerCase() === 'window' && (
          <Box mt={2}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.75 }}>
              Состояние: {localSettings.mode === 'opened' ? 'Открыто' : localSettings.mode === 'tilted' ? 'Проветривание' : 'Закрыто'}
            </Typography>
            <FormControl fullWidth size="small" disabled={isReadOnly || device.status === 'offline'}>
              <InputLabel id={`window-mode-label-${device.deviceId}`} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Режим
              </InputLabel>
              <Select
                id={`window-mode-select-${device.deviceId}`}
                labelId={`window-mode-label-${device.deviceId}`}
                value={localSettings.mode || 'closed'}
                onChange={(e) => {
                  const newMode = e.target.value as string;
                  handleLocalChange('mode', newMode);
                  onSettingsChange?.(device.deviceId, { ...localSettings, mode: newMode });
                  if (newMode === 'closed') {
                    onToggle(device.deviceId, DeviceStatus.Inactive);
                  } else {
                    onToggle(device.deviceId, DeviceStatus.Active);
                  }
                }}
                label="Режим"
                sx={{
                  color: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: selectMenuPaperSx,
                  },
                }}
              >
                <MenuItem value="closed">Закрыто</MenuItem>
                <MenuItem value="tilted">Проветривание</MenuItem>
                <MenuItem value="opened">Открыто</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {device.type.toLowerCase() === 'curtain' && (
          <Box mt={2}>
            <FormControl fullWidth size="small" disabled={isReadOnly || device.status === 'offline'}>
              <InputLabel id={`curtain-mode-label-${device.deviceId}`} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Шторы
              </InputLabel>
              <Select
                id={`curtain-mode-select-${device.deviceId}`}
                labelId={`curtain-mode-label-${device.deviceId}`}
                value={isActive ? 'opened' : 'closed'}
                onChange={(e) => {
                  const v = e.target.value as string;
                  onToggle(device.deviceId, v === 'opened' ? DeviceStatus.Active : DeviceStatus.Inactive);
                  handleLocalChange('mode', v);
                }}
                label="Шторы"
                sx={{
                  color: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: selectMenuPaperSx,
                  },
                }}
              >
                <MenuItem value="closed">Закрыты</MenuItem>
                <MenuItem value="opened">Открыты</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {device.type.toLowerCase() === 'humidifier' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.75 }}>
              {localSettings.useHumidityRange
                ? `Диапазон: ${localSettings.minHumidity ?? 30}–${localSettings.maxHumidity ?? 60}%`
                : `Цель: ${localSettings.targetHumidity ?? 50}%`}
              {isActive && ` • Текущая: ${settings.humidity ?? localSettings.humidity ?? 45}%`}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!localSettings.useHumidityRange}
                    onChange={(_, checked) => handleLocalChange('useHumidityRange', checked)}
                    disabled={isReadOnly || device.status === 'offline'}
                    sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                  />
                }
                label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>По диапазону</Typography>}
              />
              {localSettings.useHumidityRange ? (
                <>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                    <Slider size="small" value={localSettings.minHumidity ?? 30} min={20} max={70} step={5}
                      onChange={(_, v) => handleLocalChange('minHumidity', v as number)} valueLabelDisplay="auto"
                      disabled={isReadOnly || device.status === 'offline'}
                      sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                    <Slider size="small" value={localSettings.maxHumidity ?? 60} min={30} max={85} step={5}
                      onChange={(_, v) => handleLocalChange('maxHumidity', v as number)} valueLabelDisplay="auto"
                      disabled={isReadOnly || device.status === 'offline'}
                      sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                  </Box>
                </>
              ) : (
                <Slider size="small" value={localSettings.targetHumidity ?? 50} min={30} max={80} step={5}
                  onChange={(_, v) => handleLocalChange('targetHumidity', v as number)} valueLabelDisplay="auto"
                  disabled={isReadOnly || device.status === 'offline'}
                  sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' }, mt: 0.5 }} />
              )}
            </Box>
          </Box>
        )}

        {device.type.toLowerCase() === 'ventilation' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.75 }}>
              CO₂ диапазон: {localSettings.co2Min ?? 800}–{localSettings.co2Max ?? 1200} ppm
              {' • '}Текущий: {settings.co2 ?? settings.coPpm ?? localSettings.co2 ?? '—'} ppm
            </Typography>
            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!localSettings.useCo2Range}
                    onChange={(_, checked) => handleLocalChange('useCo2Range', checked)}
                    disabled={isReadOnly || device.status === 'offline'}
                    sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#F08B5C' } }}
                  />
                }
                label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>По диапазону</Typography>}
              />
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                <Slider size="small" value={localSettings.co2Min ?? 600} min={400} max={1500} step={100}
                  onChange={(_, v) => handleLocalChange('co2Min', v as number)} valueLabelDisplay="auto"
                  disabled={isReadOnly || device.status === 'offline' || !localSettings.useCo2Range}
                  sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                <Slider size="small" value={localSettings.co2Max ?? 1200} min={800} max={2000} step={100}
                  onChange={(_, v) => handleLocalChange('co2Max', v as number)} valueLabelDisplay="auto"
                  disabled={isReadOnly || device.status === 'offline' || !localSettings.useCo2Range}
                  sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
              </Box>
            </Box>
          </Box>
        )}

        {device.type.toLowerCase() === 'lock' && (
          <Box mt={2}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: isActive ? '#FF6B6B' : '#4ECDC4',
                fontWeight: 500,
              }}
            >
              {isActive ? 'Дверь заблокирована' : 'Дверь открыта'}
            </Typography>
          </Box>
        )}

        {device.type.toLowerCase() === 'outlet' && (
          <Box mt={2}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              Напряжение: {outletEnergyView.voltageV.toFixed(1)} В
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              Ток: {outletEnergyView.currentA.toFixed(3)} А
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              Мощность: {outletEnergyView.powerW.toFixed(1)} Вт
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              Энергия: {outletEnergyView.energyKwh.toFixed(3)} кВт·ч
            </Typography>
          </Box>
        )}

        {device.type.toLowerCase() === 'sensor' && (
          <Box mt={2}>
            {(() => {
              const kind = sensorKindOf(device, settings);
              if (kind === 'climate') {
                const co2 = settings.co2 ?? settings.coPpm ?? settings.co ?? '—';
                return (
                  <>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Температура: {settings.currentTemp ?? settings.temp ?? 24}°C
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Влажность: {settings.humidity ?? 40}%
                    </Typography>
                    <Tooltip title="Частей на миллион — концентрация CO₂. Норма до 1000 ppm; выше — желательно проветривание.">
                      <Typography
                        variant="body2"
                        sx={{
                          color: Number(co2) > 1000 ? '#FF6B6B' : 'rgba(255, 255, 255, 0.7)',
                          cursor: 'help',
                        }}
                      >
                        CO₂: {co2} ppm
                      </Typography>
                    </Tooltip>
                  </>
                );
              }
              if (kind === 'power') {
                return (
                  <>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Мощность: {(pickNumber(settings, ['powerW', 'power', 'activePower']) ?? 0).toFixed(1)} Вт
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Энергия: {(pickNumber(settings, ['energyKwh', 'energy', 'totalKwh']) ?? 0).toFixed(3)} кВт·ч
                    </Typography>
                  </>
                );
              }
              if (kind === 'water') {
                return (
                  <>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Расход воды: {(pickNumber(settings, ['waterM3', 'volumeM3', 'totalM3']) ?? 0).toFixed(3)} м³
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Поток: {(pickNumber(settings, ['flowLpm', 'flowRate', 'flow']) ?? 0).toFixed(2)}
                    </Typography>
                  </>
                );
              }
              return (
                <>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Расход газа: {(pickNumber(settings, ['gasM3', 'volumeM3', 'totalM3']) ?? 0).toFixed(3)} м³
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Поток: {(pickNumber(settings, ['flowM3h', 'flowRate', 'flow']) ?? 0).toFixed(3)} м³/ч
                  </Typography>
                </>
              );
            })()}
          </Box>
        )}
        </>
        )}
      </CardContent>
      
      {!hideAuxControls && device.type.toLowerCase() !== 'sensor' && openSchedule && (
        <ScheduleDialog 
          open={openSchedule} 
          onClose={() => setOpenSchedule(false)} 
          deviceId={device.deviceId} 
          deviceName={device.name}
          deviceType={device.type}
          skipRequest={isGlobalAdmin}
        />
      )}
      {!hideAuxControls && openStats && (
        <SensorStatsDialog 
          open={openStats} 
          onClose={() => setOpenStats(false)} 
          deviceId={device.deviceId} 
          deviceName={device.name}
          deviceType={device.type}
          skipRequest={isGlobalAdmin}
        />
      )}
    </Card>
  );
};

// Мемоизация карточки: при скролле/обновлениях не должны перерисовываться все устройства,
// иначе первый элемент в строке заметно дергается.
export const GlassDeviceCard = React.memo(GlassDeviceCardInner);

