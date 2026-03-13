import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Switch, Box, IconButton, Tooltip, Slider, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import { ScheduleDialog } from './ScheduleDialog';
import { SensorStatsDialog } from './SensorStatsDialog';

interface GlassDeviceCardProps {
  device: Device;
  onToggle: (id: number, status: DeviceStatus) => void;
  onSettingsChange?: (id: number, settings: Record<string, any>) => void;
  size?: 'small' | 'medium' | 'large';
  /** Меньший blur для списков — быстрее скролл */
  reducedBlur?: boolean;
}

export const GlassDeviceCard: React.FC<GlassDeviceCardProps> = ({ 
  device, 
  onToggle, 
  onSettingsChange,
  size = 'medium',
  reducedBlur = false,
}) => {
  const isActive = device.status.toLowerCase() === 'active';
  const settings = device.settings || {};
  const permission = (device.currentUserPermission || 'viewer').toLowerCase();
  const isReadOnly = permission === 'viewer';
  const canViewStatistics = permission === 'admin';
  const canManageSchedule = permission === 'admin' || permission === 'user';
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openStats, setOpenStats] = useState(false);

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
      default: return <PowerSettingsNewIcon fontSize={iconSize} sx={{ color: iconColor }} />;
    }
  };

  // Единая сетка высот: small / medium / large
  const sizeHeights = { small: 168, medium: 248, large: 320 };
  const minCardHeight = sizeHeights[size];
  const cardHeight = size === 'large' ? '100%' : `${minCardHeight}px`;
  const isLarge = size === 'large';

  return (
    <Card
      sx={{
        width: '100%',
        height: cardHeight,
        minHeight: minCardHeight,
        display: 'flex',
        flexDirection: 'column',
        background: isActive && isLarge
          ? 'linear-gradient(135deg, rgba(240, 139, 92, 0.18) 0%, rgba(255, 255, 255, 0.1) 100%)'
          : 'rgba(255, 255, 255, 0.1)',
        backdropFilter: reducedBlur ? 'blur(8px)' : 'blur(20px)',
        WebkitBackdropFilter: reducedBlur ? 'blur(8px)' : 'blur(20px)',
        border: isActive
          ? '1px solid rgba(240, 139, 92, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: isActive
          ? '0 8px 32px 0 rgba(240, 139, 92, 0.25)'
          : '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        borderRadius: 4,
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease',
        opacity: device.status === 'offline' ? 0.5 : 1,
        '&:hover': {
          boxShadow: '0 12px 40px 0 rgba(240, 139, 92, 0.35)',
          transform: 'translateY(-4px)',
          border: '1px solid rgba(240, 139, 92, 0.5)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: isLarge ? 4 : 2.5, overflow: 'hidden', minHeight: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2} sx={{ minWidth: 0 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flexGrow: 1,
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
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {device.name}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {device.manufacturer || 'Generic'} • {device.type}
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
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
            {canManageSchedule && (
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
            {device.type.toLowerCase() !== 'sensor' && device.type.toLowerCase() !== 'window' && (
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
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}>
              Целевая температура: {localSettings.targetTemp ?? 22}°C
            </Typography>
            <Slider 
              value={localSettings.targetTemp ?? 22} 
              onChange={(_, val) => handleLocalChange('targetTemp', val)} 
              min={16} 
              max={30} 
              step={0.5}
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
            {isActive && (
              <Box display="flex" justifyContent="space-between" mt={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Текущая: {settings.currentTemp ?? 21}°C
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Влажность: {settings.humidity ?? 45}%
                </Typography>
              </Box>
            )}
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
                  const newMode = e.target.value;
                  handleLocalChange('mode', newMode);
                  // Обновляем статус в зависимости от режима
                  if (newMode === 'closed') {
                    onToggle(device.deviceId, DeviceStatus.Inactive);
                  } else {
                    onToggle(device.deviceId, DeviceStatus.Active);
                  }
                }}
                label="Режим"
                sx={{
                  color: '#FFFFFF',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      background: 'rgba(30, 30, 30, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    },
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
              Температура: {settings.temp ?? 24}°C
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Влажность: {settings.humidity ?? 40}%
            </Typography>
            {(settings.coPpm != null || settings.co != null || settings.gas != null) && (
              <Typography variant="body2" sx={{ color: settings.coPpm > 50 || settings.co > 50 ? '#FF6B6B' : 'rgba(255, 255, 255, 0.7)' }}>
                Угарный газ (CO): {settings.coPpm ?? settings.co ?? settings.gas ?? 0} ppm
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
      
      <ScheduleDialog 
        open={openSchedule} 
        onClose={() => setOpenSchedule(false)} 
        deviceId={device.deviceId} 
        deviceName={device.name}
        deviceType={device.type}
      />
      <SensorStatsDialog 
        open={openStats} 
        onClose={() => setOpenStats(false)} 
        deviceId={device.deviceId} 
        deviceName={device.name}
      />
    </Card>
  );
};

