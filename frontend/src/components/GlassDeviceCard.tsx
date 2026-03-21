import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Switch, Box, IconButton, Tooltip, Slider, FormControl, Select, MenuItem, InputLabel, Checkbox, FormControlLabel, Collapse } from '@mui/material';
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

interface GlassDeviceCardProps {
  device: Device;
  onToggle: (id: number, status: DeviceStatus) => void;
  onSettingsChange?: (id: number, settings: Record<string, any>) => void;
  size?: 'small' | 'medium' | 'large';
  /** Меньший blur для списков — быстрее скролл */
  reducedBlur?: boolean;
  /** Без backdrop-filter: только rgba (страница устройств) */
  alphaGlass?: boolean;
}

const GlassDeviceCardInner: React.FC<GlassDeviceCardProps> = ({ 
  device, 
  onToggle, 
  onSettingsChange,
  size = 'medium',
  reducedBlur = false,
  alphaGlass = true,
}) => {
  const { user } = useAuth();
  const isActive = device.status.toLowerCase() === 'active';
  const settings = device.settings || {};
  const permission = (device.currentUserPermission || 'viewer').toLowerCase();
  const isGlobalAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isReadOnly = permission === 'viewer';
  const canViewStatistics = permission === 'admin';
  const canManageSchedule = permission === 'admin' || permission === 'user';
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openStats, setOpenStats] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState<string | null>(null);
  const toggleSettings = (key: string) => setSettingsExpanded(prev => prev === key ? null : key);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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
      case 'light': return <LightbulbIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'thermostat': return <ThermostatIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'kettle': return <CoffeeIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'switch': return <PowerSettingsNewIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'outlet': return <OutletIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'vacuum': return <CleaningServicesIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'curtain': return <CurtainsIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'lock': return isActive ? <LockIcon fontSize={iconSize} sx={{ color: '#FF6B6B' }} /> : <LockOpenIcon fontSize={iconSize} sx={{ color: '#4ECDC4' }} />;
      case 'window': return <WindowIcon fontSize={iconSize} sx={{ color: iconColor }} />;
      case 'camera': return <VideocamIcon fontSize={iconSize} sx={{ color: iconColor }} />;
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
          boxShadow: reducedBlur ? undefined : '0 6px 18px 0 rgba(240, 139, 92, 0.24)',
          transform: reducedBlur ? 'none' : 'translateY(-4px)',
          border: '1px solid rgba(240, 139, 92, 0.5)',
        },
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
            {canViewStatistics && (
              <Tooltip title="Статистика">
                <IconButton 
                  size="small" 
                  onClick={() => setOpenStats(true)}
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <BarChartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canManageSchedule && device.type.toLowerCase() !== 'sensor' && (
              <Tooltip title="Расписание">
                <IconButton 
                  size="small" 
                  onClick={() => setOpenSchedule(true)}
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

        {/* Дополнительные настройки */}
        <>
            {device.type.toLowerCase() === 'light' && (
          <Box mt={2}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}>
              Яркость: {localSettings.brightness ?? 100}%
            </Typography>
            <Slider 
              value={localSettings.brightness ?? 100} 
              onChange={(_, val) => handleLocalChange('brightness', val)} 
              min={0} 
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
          </Box>
            )}

            {device.type.toLowerCase() === 'thermostat' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {localSettings.useTempRange
                  ? `Диапазон: ${localSettings.minTemp ?? 18}–${localSettings.maxTemp ?? 24}°C`
                  : `Целевая: ${localSettings.targetTemp ?? 22}°C`}
                {isActive && ` • Текущая: ${settings.currentTemp ?? 21}°C`}
              </Typography>
              <IconButton size="small" onClick={() => toggleSettings('thermostat')} sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}>
                {settingsExpanded === 'thermostat' ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={settingsExpanded === 'thermostat'} unmountOnExit>
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
              </Box>
            </Collapse>
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
            <FormControl fullWidth size="small" disabled={isReadOnly || device.status === 'offline'}>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Режим</InputLabel>
              <Select
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
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                На улице: {device.outdoorTemp != null ? `${device.outdoorTemp}°C` : '—'}
                {device.outdoorHumidity != null && ` • Влажность: ${device.outdoorHumidity}%`}
                {device.outdoorCo2 != null && ` • CO₂: ${device.outdoorCo2} ppm`}
              </Typography>
            </Box>
          </Box>
        )}

        {device.type.toLowerCase() === 'curtain' && (
          <Box mt={2}>
            <FormControl fullWidth size="small" disabled={isReadOnly || device.status === 'offline'}>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Шторы</InputLabel>
              <Select
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {localSettings.useHumidityRange
                  ? `Диапазон: ${localSettings.minHumidity ?? 30}–${localSettings.maxHumidity ?? 60}%`
                  : `Цель: ${localSettings.targetHumidity ?? 50}%`}
                {' • '}В комнате: {settings.humidity ?? 45}%
              </Typography>
              <IconButton size="small" onClick={() => toggleSettings('humidifier')} sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}>
                {settingsExpanded === 'humidifier' ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={settingsExpanded === 'humidifier'} unmountOnExit>
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
                  label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>По диапазону (мин–макс)</Typography>}
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
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 0.5 }}>Целевая влажность %</Typography>
                    <Slider size="small" value={localSettings.targetHumidity ?? 50} min={30} max={80} step={5}
                      onChange={(_, v) => handleLocalChange('targetHumidity', v as number)} valueLabelDisplay="auto"
                      disabled={isReadOnly || device.status === 'offline'}
                      sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                  </>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {device.type.toLowerCase() === 'ventilation' && (
          <Box mt={2} sx={{ overflow: 'hidden', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {localSettings.useCo2Range
                  ? `CO₂: ${localSettings.co2Min ?? 800}–${localSettings.co2Max ?? 1200} ppm`
                  : `Порог CO₂: ${localSettings.co2Threshold ?? 1000} ppm`}
              </Typography>
              <IconButton size="small" onClick={() => toggleSettings('ventilation')} sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}>
                {settingsExpanded === 'ventilation' ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={settingsExpanded === 'ventilation'} unmountOnExit>
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
                  label={<Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>По диапазону (мин–макс ppm)</Typography>}
                />
                {localSettings.useCo2Range ? (
                  <>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Мин</Typography>
                      <Slider size="small" value={localSettings.co2Min ?? 600} min={400} max={1500} step={100}
                        onChange={(_, v) => handleLocalChange('co2Min', v as number)} valueLabelDisplay="auto"
                        disabled={isReadOnly || device.status === 'offline'}
                        sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 28 }}>Макс</Typography>
                      <Slider size="small" value={localSettings.co2Max ?? 1200} min={800} max={2000} step={100}
                        onChange={(_, v) => handleLocalChange('co2Max', v as number)} valueLabelDisplay="auto"
                        disabled={isReadOnly || device.status === 'offline'}
                        sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 0.5 }}>Порог CO₂ (ppm)</Typography>
                    <Slider size="small" value={localSettings.co2Threshold ?? 1000} min={500} max={2000} step={50}
                      onChange={(_, v) => handleLocalChange('co2Threshold', v as number)} valueLabelDisplay="auto"
                      disabled={isReadOnly || device.status === 'offline'}
                      sx={{ color: '#F08B5C', '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(240, 139, 92, 0.5)' } }} />
                  </>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {device.type.toLowerCase() === 'camera' && (
          <Box
            mt={2}
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              maxHeight: 180,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Видео (подключите поток)
            </Typography>
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

        {device.type.toLowerCase() === 'sensor' && (
          <Box mt={2}>
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
                  color:
                    (settings.co2 ?? settings.coPpm ?? settings.co ?? settings.gas ?? 0) > 1000
                      ? '#FF6B6B'
                      : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'help',
                }}
              >
                CO₂: {settings.co2 ?? settings.coPpm ?? settings.co ?? settings.gas ?? '—'} ppm
              </Typography>
            </Tooltip>
          </Box>
        )}
          </>
      </CardContent>
      
      {device.type.toLowerCase() !== 'sensor' && openSchedule && (
        <ScheduleDialog 
          open={openSchedule} 
          onClose={() => setOpenSchedule(false)} 
          deviceId={device.deviceId} 
          deviceName={device.name}
          deviceType={device.type}
          skipRequest={isGlobalAdmin}
        />
      )}
      {openStats && (
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

