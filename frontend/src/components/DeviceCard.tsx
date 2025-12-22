import React, { useState, useEffect } from 'react';
import { DeviceStatus } from '../types';
import type { Device } from '../types';
import { Card, CardContent, Typography, Switch, Box, Chip, Slider, Button, ButtonGroup, ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip } from '@mui/material';

// Icons
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'; // Switch
import ThermostatIcon from '@mui/icons-material/Thermostat';
import VideocamIcon from '@mui/icons-material/Videocam';
import CoffeeIcon from '@mui/icons-material/Coffee'; // Kettle
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SensorsIcon from '@mui/icons-material/Sensors';
import OutletIcon from '@mui/icons-material/Power'; // Outlet
import WindowIcon from '@mui/icons-material/Window'; // Window
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'; // Vacuum
import CurtainsIcon from '@mui/icons-material/Curtains'; // Curtains
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import { ScheduleDialog } from './ScheduleDialog';
import { SensorStatsDialog } from './SensorStatsDialog';

interface DeviceCardProps {
  device: Device;
  onToggle: (id: number, status: DeviceStatus) => void;
  onSettingsChange?: (id: number, settings: Record<string, any>) => void;
}

export const DeviceCard = ({ device, onToggle, onSettingsChange }: DeviceCardProps) => {
  const isActive = device.status.toLowerCase() === 'active';
  const settings = device.settings || {};
  const permission = (device.currentUserPermission || 'viewer').toLowerCase();
  const isReadOnly = permission === 'viewer';
  const canViewStatistics = permission === 'admin'; // Только владелец и совладелец
  const canManageSchedule = permission === 'admin' || permission === 'user'; // Владелец, совладелец и пользователь с разрешением "управление"
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openStats, setOpenStats] = useState(false);

  useEffect(() => {
      setLocalSettings(prev => ({ ...prev, ...settings }));
  }, [settings]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
              onSettingsChange?.(device.deviceId, localSettings);
          }
      }, 500);
      return () => clearTimeout(timer);
  }, [localSettings, device.deviceId]);

  const handleLocalChange = (key: string, value: any) => {
      setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStatus = e.target.checked ? DeviceStatus.Active : DeviceStatus.Inactive;
    onToggle(device.deviceId, newStatus);
  };

  const getIcon = () => {
    const type = device.type.toLowerCase();
    switch (type) {
      case 'light': return <LightbulbIcon fontSize="large" color={isActive ? 'warning' : 'disabled'} />;
      case 'thermostat': return <ThermostatIcon fontSize="large" color={isActive ? 'error' : 'disabled'} />;
      case 'kettle': return <CoffeeIcon fontSize="large" color={isActive ? 'warning' : 'disabled'} />;
      case 'switch': return <PowerSettingsNewIcon fontSize="large" color={isActive ? 'success' : 'disabled'} />;
      case 'outlet': return <OutletIcon fontSize="large" color={isActive ? 'success' : 'disabled'} />;
      case 'vacuum': return <CleaningServicesIcon fontSize="large" color={isActive ? 'primary' : 'disabled'} />;
      case 'curtain': return <CurtainsIcon fontSize="large" color={isActive ? 'primary' : 'disabled'} />;
      case 'lock': return isActive ? <LockIcon fontSize="large" color="error" /> : <LockOpenIcon fontSize="large" color="success" />;
      case 'window': return <WindowIcon fontSize="large" color={isActive ? 'primary' : 'action'} />;
      case 'camera': return <VideocamIcon fontSize="large" color={isActive ? 'primary' : 'disabled'} />;
      case 'sensor': return <SensorsIcon fontSize="large" color="action" />;
      default: return <PowerSettingsNewIcon fontSize="large" color={isActive ? 'primary' : 'disabled'} />;
    }
  };

  const renderControls = () => {
      const disabled = isReadOnly;
      
      switch (device.type.toLowerCase()) {
          case 'light':
              return (
                  <Box mt={2}>
                      <Typography variant="caption">Яркость</Typography>
                      <Slider 
                          value={localSettings.brightness ?? 100} 
                          onChange={(_, val) => handleLocalChange('brightness', val)} 
                          min={0} max={100} 
                          disabled={disabled}
                          size="small"
                          valueLabelDisplay="off"
                      />
                  </Box>
              );
          case 'thermostat':
              return (
                  <Box mt={2}>
                      <Typography variant="caption">Целевая температура: {localSettings.targetTemp ?? 22}°C</Typography>
                      <Slider 
                          value={localSettings.targetTemp ?? 22} 
                          onChange={(_, val) => handleLocalChange('targetTemp', val)} 
                          min={16} max={30} step={0.5}
                          disabled={disabled}
                          valueLabelDisplay="auto"
                          size="small"
                      />
                      {isActive && (
                          <Box display="flex" justifyContent="space-between" mt={1}>
                            <Typography variant="caption" color="text.secondary">Текущая: {settings.currentTemp ?? 21}°C</Typography>
                            <Typography variant="caption" color="text.secondary">Влажность: {settings.humidity ?? 45}%</Typography>
                          </Box>
                      )}
                  </Box>
              );
          case 'kettle':
              return (
                  <Box mt={2}>
                      <Typography variant="caption">Нагреть до: {localSettings.targetTemp ?? 100}°C</Typography>
                      <Slider 
                          value={localSettings.targetTemp ?? 100} 
                          onChange={(_, val) => handleLocalChange('targetTemp', val)} 
                          min={40} max={100} step={5}
                          marks
                          disabled={disabled}
                          valueLabelDisplay="auto"
                          size="small"
                      />
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          {isActive 
                              ? `Статус: Кипячение... • Текущая: ${settings.currentTemp ?? 20}°C`
                              : `Статус: Ожидание • Текущая: ${settings.currentTemp ?? 20}°C`
                          }
                      </Typography>
                  </Box>
              );
          case 'lock':
               return (
                   <Box mt={2}>
                       <Typography variant="body2" color={isActive ? "error" : "success"} fontWeight="medium">
                           {isActive ? 'Дверь заблокирована' : 'Дверь открыта'}
                       </Typography>
                   </Box>
               );
          case 'camera':
              return (
                  <Box mt={2}>
                      <Box 
                          sx={{ 
                              width: '100%', 
                              height: 100, 
                              bgcolor: isActive ? '#000' : '#e0e0e0', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: isActive ? '#fff' : '#9e9e9e',
                              borderRadius: 1,
                              mb: 1,
                              fontSize: '0.75rem'
                          }}
                      >
                          {isActive ? 'LIVE VIEW' : 'OFFLINE'}
                      </Box>
                      <Button 
                          variant="contained" 
                          size="small" 
                          fullWidth 
                          color="error"
                          disabled={!isActive || disabled}
                      >
                          Сигнал
                      </Button>
                  </Box>
              );
          case 'sensor':
              return (
                  <Box mt={2}>
                      <Typography variant="body2">Температура: {settings.temp ?? 24}°C</Typography>
                      <Typography variant="body2">Влажность: {settings.humidity ?? 40}%</Typography>
                  </Box>
              );
          case 'window':
               const mode = localSettings.mode || 'closed';
               return (
                   <Box mt={2}>
                        <FormControl fullWidth size="small">
                            <Select
                                value={mode}
                                onChange={(e) => {
                                    const newMode = e.target.value;
                                    handleLocalChange('mode', newMode);
                                    onToggle(device.deviceId, newMode === 'closed' ? DeviceStatus.Inactive : DeviceStatus.Active);
                                }}
                                disabled={disabled}
                                displayEmpty
                                inputProps={{ 'aria-label': 'Window mode' }}
                            >
                                <MenuItem value="closed">Закрыто</MenuItem>
                                <MenuItem value="tilted">Проветривание</MenuItem>
                                <MenuItem value="opened">Открыто</MenuItem>
                            </Select>
                        </FormControl>
                   </Box>
               );
          default:
              return null;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: device.status === 'offline' ? 0.6 : 1 }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          {getIcon()}
          <Box display="flex" alignItems="center" gap={1}>
              {canViewStatistics && (
                  <Tooltip title="Статистика">
                      <IconButton size="small" onClick={() => setOpenStats(true)}>
                          <BarChartIcon fontSize="small" />
                      </IconButton>
                  </Tooltip>
              )}
              {canManageSchedule && (
                  <Tooltip title="Настроить расписание">
                      <IconButton size="small" onClick={() => setOpenSchedule(true)}>
                          <AccessTimeIcon fontSize="small" />
                      </IconButton>
                  </Tooltip>
              )}
              {device.type.toLowerCase() !== 'sensor' && (
          <Chip 
                    label={isActive ? 'ON' : 'OFF'} 
                    color={isActive ? 'success' : 'default'} 
            size="small" 
                    variant="outlined"
                    sx={{ borderColor: 'transparent', backgroundColor: isActive ? 'rgba(46, 125, 50, 0.1)' : 'rgba(0, 0, 0, 0.08)' }}
          />
              )}
          </Box>
        </Box>
        
        <Typography variant="h6" noWrap title={device.name} sx={{ fontSize: '1rem', fontWeight: 600 }}>
          {device.name}
        </Typography>
        
        <Typography variant="caption" color="text.secondary" gutterBottom display="block" sx={{ mb: 2 }}>
            {device.manufacturer || 'Generic'} • {device.type}
        </Typography>
        
        {renderControls()}
          
        {device.type.toLowerCase() !== 'sensor' && device.type.toLowerCase() !== 'window' && (
            <Box display="flex" justifyContent="flex-end" mt={2} pt={1} borderTop="1px solid #f0f0f0">
          <Switch
            checked={isActive}
            onChange={handleToggle}
                    disabled={device.status === 'offline' || isReadOnly}
                    color={device.type.toLowerCase() === 'lock' ? 'error' : 'primary'}
          />
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
