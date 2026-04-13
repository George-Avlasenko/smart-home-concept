import React, { useEffect, useState, useMemo } from 'react';
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
  Grid,
  Stack
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

export interface SensorReadingRow {
  readingId: number;
  deviceId: number;
  readingType: string;
  value: number;
  unit?: string;
  recordedAt: string;
}

export interface SensorStatsDialogProps {
  open: boolean;
  onClose: () => void;
  deviceId: number;
  deviceName: string;
  deviceType?: string;
  skipRequest?: boolean;
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

const readingTypeLabel: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность',
  co2: 'CO₂',
};

const parseServerDate = (value?: string): Date => {
  if (!value) return new Date(NaN);
  // Backend may send UTC timestamps without timezone suffix. Treat them as UTC.
  const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
};

export const SensorStatsDialog: React.FC<SensorStatsDialogProps> = ({
  open,
  onClose,
  deviceId,
  deviceName,
  deviceType = '',
  skipRequest = false,
}) => {
  const isSensor = deviceType.toLowerCase() === 'sensor';
  const sensorPeriodLabelId = `sensor-period-label-${deviceId}`;
  const sensorPeriodSelectId = `sensor-period-select-${deviceId}`;
  const statsPeriodLabelId = `stats-period-label-${deviceId}`;
  const statsPeriodSelectId = `stats-period-select-${deviceId}`;
  const [statistics, setStatistics] = useState<DeviceStatistics | null>(null);
  const [sensorReadings, setSensorReadings] = useState<SensorReadingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [days, setDays] = useState(1);
  const [readingsLimit] = useState(2000);
  const [snapshotKey, setSnapshotKey] = useState(0);

  const accessDeniedMessage = 'Статистику устройства видят только владельцы и жильцы этого дома. Так мы сохраняем вашу приватность и комфорт.';

  useEffect(() => {
    if (open && deviceId) {
      if (skipRequest) {
        setAccessDenied(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (isSensor) fetchSensorReadings();
      else fetchStatistics();
    }
  }, [open, deviceId, days, isSensor, skipRequest]);

  const fetchSensorReadings = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const response = await api.get<SensorReadingRow[]>(`/sensorreadings/device/${deviceId}?limit=${readingsLimit}&days=${days}`);
      setSensorReadings(Array.isArray(response.data) ? response.data : []);
      setSnapshotKey((k) => k + 1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setError(null);
      } else {
        const d = err.response?.data;
        const msg = (typeof d === 'string' ? d : null) ?? d?.detail ?? d?.message ?? d?.title;
        setError(msg || 'Не удалось загрузить показания датчика');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const response = await api.get<DeviceStatistics>(`/devicestatistics/device/${deviceId}?days=${days}`);
      setStatistics(response.data);
      setSnapshotKey((k) => k + 1);
    } catch (err: any) {
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

  // Для датчика: плоский список → точки по времени, затем бакеты по 60 сек (усреднение), чтобы график без пульса
  const sensorChartData = useMemo(() => {
    if (!isSensor || !sensorReadings.length) return [];
    const byTime = new Map<number, { time: string; timeSort: number; temp?: number; humidity?: number; co2?: number }>();
    sensorReadings.forEach((r) => {
      const t = parseServerDate(r.recordedAt).getTime();
      if (!byTime.has(t)) {
        byTime.set(t, {
          time: parseServerDate(r.recordedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
          timeSort: t,
        });
      }
      const v = Number(r.value);
      const row = byTime.get(t)!;
      const type = (r.readingType || '').toLowerCase();
      if (type === 'temperature') row.temp = v;
      else if (type === 'humidity') row.humidity = v;
      else if (type === 'co2') row.co2 = v;
    });
    const points = Array.from(byTime.values()).sort((a, b) => a.timeSort - b.timeSort);
    if (points.length === 0) return [];
    const bucketSec = 60;
    const bucketMs = bucketSec * 1000;
    const byBucket = new Map<number, { sumT: number; sumH: number; sumC: number; countT: number; countH: number; countC: number; timeSort: number }>();
    points.forEach((p) => {
      const bucket = Math.floor(p.timeSort / bucketMs) * bucketMs;
      const rec = byBucket.get(bucket);
      const sumT = (rec?.sumT ?? 0) + (p.temp ?? 0);
      const sumH = (rec?.sumH ?? 0) + (p.humidity ?? 0);
      const sumC = (rec?.sumC ?? 0) + (p.co2 ?? 0);
      const countT = (rec?.countT ?? 0) + (p.temp != null ? 1 : 0);
      const countH = (rec?.countH ?? 0) + (p.humidity != null ? 1 : 0);
      const countC = (rec?.countC ?? 0) + (p.co2 != null ? 1 : 0);
      byBucket.set(bucket, { sumT, sumH, sumC, countT, countH, countC, timeSort: bucket });
    });
    return Array.from(byBucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, v]) => ({
        time: new Date(bucket).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        temp: v.countT > 0 ? Math.round((v.sumT / v.countT) * 10) / 10 : undefined,
        humidity: v.countH > 0 ? Math.round((v.sumH / v.countH) * 10) / 10 : undefined,
        co2: v.countC > 0 ? Math.round(v.sumC / v.countC) : undefined,
      }));
  }, [isSensor, sensorReadings]);

  const sensorChartBlock = useMemo(() => (
    <Box key={snapshotKey} sx={{ width: '100%', height: 360, outline: 'none', '& .recharts-wrapper': { outline: 'none' }, '& svg': { outline: 'none' }, '& [tabindex]': { outline: 'none' }, '& *:focus': { outline: 'none' } }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sensorChartData} margin={{ top: 8, right: 50, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
          <XAxis dataKey="time" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.7)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} labelStyle={{ color: 'rgba(255,255,255,0.9)' }} formatter={(value: number) => [value, '']} labelFormatter={(label) => label} />
          <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.9)' }} />
          <Line yAxisId="left" type="monotone" dataKey="temp" name="Температура °C" stroke="#F08B5C" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="left" type="monotone" dataKey="humidity" name="Влажность %" stroke="#64B5F6" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="right" type="monotone" dataKey="co2" name="CO₂ ppm" stroke="#81C784" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  ), [sensorChartData, snapshotKey]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
        '& .MuiTableHead .MuiTableCell-root': {
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: 600,
          zIndex: 3,
        },
        '& .MuiTableCell-stickyHeader': {
          background: 'rgba(255, 255, 255, 0.12)',
          zIndex: 3,
        },
        '& .MuiTableContainer-root': {
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <DialogTitle>Статистика: {deviceName}</DialogTitle>
      <DialogContent sx={{ pt: 3, overflow: 'visible' }}>
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
        ) : isSensor ? (
          <Box>
            <Box mb={2} pt={2} display="flex" justifyContent="space-between" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }} variant="outlined">
                <InputLabel id={sensorPeriodLabelId} sx={{ color: 'rgba(255,255,255,0.7)' }}>Период</InputLabel>
                <Select
                  id={sensorPeriodSelectId}
                  value={days}
                  labelId={sensorPeriodLabelId}
                  label="Период"
                  onChange={(e) => setDays(Number(e.target.value))}
                  sx={{ color: 'rgba(255,255,255,0.9)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }}
                >
                  <MenuItem value={1}>1 день</MenuItem>
                  <MenuItem value={7}>7 дней</MenuItem>
                  <MenuItem value={30}>30 дней</MenuItem>
                  <MenuItem value={90}>90 дней</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {sensorChartData.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Показаний за выбранный период нет. Данные пишутся при работе эмулятора.
              </Typography>
            ) : (
              sensorChartBlock
            )}
          </Box>
        ) : !statistics ? (
          <Typography color="text.secondary">Нет данных для отображения</Typography>
        ) : (
          <Box>
            <Box mb={2} pt={2} display="flex" justifyContent="space-between" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }} variant="outlined">
                <InputLabel id={statsPeriodLabelId}>Период</InputLabel>
                <Select
                  id={statsPeriodSelectId}
                  value={days}
                  labelId={statsPeriodLabelId}
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

            <Stack direction="row" spacing={2} sx={{ px: 2, py: 1, mb: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.08)' }}>
              <Typography variant="caption" sx={{ flex: 2, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Дата/Время</Typography>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Статус</Typography>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Длительность</Typography>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Причина</Typography>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Пользователь</Typography>
            </Stack>
            <TableContainer component={Paper} sx={{ maxHeight: 400, bgcolor: 'transparent' }}>
              <Table size="small">
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
                        <TableCell>{parseServerDate(event.timestamp).toLocaleString('ru-RU')}</TableCell>
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
        <Button onClick={isSensor ? fetchSensorReadings : fetchStatistics} color="primary">Обновить</Button>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};
