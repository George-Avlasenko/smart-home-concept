import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Typography,
  Box,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import { api } from '../api/client';

export interface StatusEvent {
  historyId: number;
  status: string;
  timestamp: string;
  changedByUsername?: string;
  changeReason?: string;
  durationSeconds?: number;
}

export interface DeviceStatistics {
  deviceId: number;
  deviceName: string;
  events: StatusEvent[];
  totalActiveTimeSeconds: number;
  totalInactiveTimeSeconds: number;
  totalSwitches: number;
  lastTurnedOn?: string;
  lastTurnedOff?: string;
  currentSessionDurationSeconds?: number;
}

interface SensorStatsDialogProps {
  open: boolean;
  onClose: () => void;
  deviceId: number;
  deviceName: string;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds === 0) return '-';
  return formatTimeSpan(seconds);
};

const formatTimeSpan = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const days = Math.floor(hours / 24);
  const hoursRemainder = hours % 24;
  
  if (days > 0) return `${days}д ${hoursRemainder}ч ${minutes}м`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const SensorStatsDialog: React.FC<SensorStatsDialogProps> = ({
  open,
  onClose,
  deviceId,
  deviceName
}) => {
  const [statistics, setStatistics] = useState<DeviceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [days, setDays] = useState(1);

  const accessDeniedMessage = 'Статистику устройства видят только владельцы и жильцы этого дома. Так мы сохраняем вашу приватность и комфорт.';

  useEffect(() => {
    if (open && deviceId) {
      fetchStatistics();
    }
  }, [open, deviceId, days]);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const response = await api.get<DeviceStatistics>(`/devicestatistics/device/${deviceId}?days=${days}`);
      setStatistics(response.data);
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setError(null);
      } else {
        const d = err.response?.data;
        const msg = (typeof d === 'string' ? d : null) ?? d?.detail ?? d?.message ?? d?.title;
        setError(msg || 'Не удалось загрузить статистику');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'fault': return 'error';
      case 'offline': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'ВКЛ';
      case 'inactive': return 'ВЫКЛ';
      case 'fault': return 'ОШИБКА';
      case 'offline': return 'ОФЛАЙН';
      default: return status;
    }
  };

  const getReasonLabel = (reason?: string) => {
    switch (reason) {
      case 'manual': return 'Вручную';
      case 'schedule': return 'Расписание';
      case 'system': return 'Система';
      default: return reason || '-';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        },
        '& .MuiTableHead .MuiTableCell-root': {
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: 600,
        },
        '& .MuiTableContainer-root': {
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <DialogTitle>Статистика: {deviceName}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress color="primary" />
          </Box>
        ) : accessDenied ? (
          <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, maxWidth: 360, mx: 'auto' }}>
              {accessDeniedMessage}
            </Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : !statistics ? (
          <Typography color="text.secondary">Нет данных для отображения</Typography>
        ) : (
          <Box>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Период</InputLabel>
                <Select
                  value={days}
                  label="Период"
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <MenuItem value={1}>1 день</MenuItem>
                  <MenuItem value={7}>7 дней</MenuItem>
                  <MenuItem value={30}>30 дней</MenuItem>
                  <MenuItem value={90}>90 дней</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Grid container spacing={2} mb={3}>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Всего переключений</Typography>
                    <Typography variant="h5">{statistics.totalSwitches}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Время работы</Typography>
                    <Typography variant="h5" color="success.main">
                      {formatTimeSpan(statistics.totalActiveTimeSeconds)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Время простоя</Typography>
                    <Typography variant="h5" color="text.secondary">
                      {formatTimeSpan(statistics.totalInactiveTimeSeconds)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Текущая сессия</Typography>
                    <Typography variant="h5" color="primary.main">
                      {statistics.currentSessionDurationSeconds 
                        ? formatTimeSpan(statistics.currentSessionDurationSeconds)
                        : 'Не активно'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <TableContainer component={Paper} sx={{ maxHeight: 400, bgcolor: 'transparent' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>Дата/Время</TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>Статус</TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>Длительность</TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>Причина</TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>Пользователь</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statistics.events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">Нет событий за выбранный период</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    statistics.events.map((event) => (
                      <TableRow key={event.historyId}>
                        <TableCell>{new Date(event.timestamp).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getStatusLabel(event.status)} 
                            color={getStatusColor(event.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDuration(event.durationSeconds)}</TableCell>
                        <TableCell>{getReasonLabel(event.changeReason)}</TableCell>
                        <TableCell>{event.changedByUsername || 'Система'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fetchStatistics} color="primary">Обновить</Button>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};
