import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemIcon, ListItemText, Switch, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { api } from '../api/client';
import type { ScenarioGroupSchedule } from '../types';
import { getSortedDaysString, ScheduleDayPicker, scheduleDaysHintCaption } from './scheduleShared';

type Props = {
  open: boolean;
  onClose: () => void;
  houseId: number;
  groupId: number;
  groupName: string;
};

function sortSchedules(list: ScenarioGroupSchedule[]): ScenarioGroupSchedule[] {
  return [...list].sort((a, b) => {
    const pa = a.time.split(':').map(Number);
    const pb = b.time.split(':').map(Number);
    const ma = (pa[0] ?? 0) * 60 + (pa[1] ?? 0);
    const mb = (pb[0] ?? 0) * 60 + (pb[1] ?? 0);
    return ma - mb;
  });
}

export const GroupScheduleDialog: React.FC<Props> = ({ open, onClose, houseId, groupId, groupName }) => {
  const [schedules, setSchedules] = useState<ScenarioGroupSchedule[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScenarioGroupSchedule | null>(null);
  const [editTime, setEditTime] = useState('08:00');
  const [editDays, setEditDays] = useState<number[]>([]);

  const basePath = `/houses/${houseId}/scenario-groups/${groupId}/schedules`;

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await api.get<ScenarioGroupSchedule[]>(basePath);
      setSchedules(sortSchedules(res.data ?? []));
    } catch {
      setSchedules([]);
    }
  }, [basePath]);

  useEffect(() => {
    if (open && groupId) {
      void fetchSchedules();
      setNewTime('08:00');
      setSelectedDays([]);
    }
  }, [open, groupId, fetchSchedules]);

  const handleToggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort((a, b) => a - b),
    );
  };

  const handleAdd = async () => {
    setBusy(true);
    try {
      await api.post(basePath, { time: newTime, daysOfWeek: selectedDays });
      setNewTime('08:00');
      setSelectedDays([]);
      await fetchSchedules();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string; detail?: string }; status?: number } };
      const d = ax.response?.data;
      const msg =
        (typeof d === 'object' && d && ('detail' in d || 'message' in d)
          ? String((d as { detail?: string }).detail || (d as { message?: string }).message)
          : null) ||
        (ax.response?.status === 403
          ? 'Нет прав на расписание группы'
          : ax.response?.status === 404
            ? 'Группа или расписание не найдены'
            : null) ||
        'Не удалось добавить расписание';
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (scheduleId: number) => {
    try {
      await api.delete(`${basePath}/${scheduleId}`);
      await fetchSchedules();
    } catch {
      window.alert('Не удалось удалить');
    }
  };

  const handleToggle = async (scheduleId: number) => {
    try {
      await api.put(`${basePath}/${scheduleId}/toggle`);
      await fetchSchedules();
    } catch {
      window.alert('Не удалось переключить');
    }
  };

  const handleEdit = (s: ScenarioGroupSchedule) => {
    setEditingSchedule(s);
    setEditTime(s.time);
    setEditDays([...s.daysOfWeek]);
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule) return;
    try {
      await api.put(`${basePath}/${editingSchedule.scheduleId}`, {
        time: editTime,
        daysOfWeek: editDays,
      });
      setEditingSchedule(null);
      await fetchSchedules();
    } catch {
      window.alert('Не удалось сохранить');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{
        zIndex: 1300,
        '& .MuiDialog-paper': {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      }}
    >
      <DialogTitle>Расписание: {groupName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
          В указанное время применяется сохранённый сценарий группы (как кнопка «Применить сценарий»).
        </Typography>

        <Box mb={3} mt={1} p={2} bgcolor="background.paper" borderRadius={2} border={1} borderColor="divider">
          <Typography variant="subtitle2" gutterBottom>
            Добавить новое правило
          </Typography>
          <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Время"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{
                width: 120,
                '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                '& input': { padding: '8.5px 14px' },
              }}
            />
            <Chip label="Сценарий группы" color="info" size="medium" variant="outlined" sx={{ height: 36, alignSelf: 'center' }} />
            <Button variant="contained" onClick={() => void handleAdd()} disabled={busy}>
              Добавить
            </Button>
          </Box>
          <Box>
            <ScheduleDayPicker selectedDays={selectedDays} onToggle={handleToggleDay} chipSize="small" />
            <Typography variant="caption" color="text.secondary">
              {scheduleDaysHintCaption(selectedDays.length)}
            </Typography>
          </Box>
        </Box>

        <List>
          {schedules.length === 0 && (
            <Typography color="text.secondary" align="center">
              Нет расписаний
            </Typography>
          )}
          {schedules.map((s) => (
            <ListItem
              key={s.scheduleId}
              secondaryAction={
                <Box display="flex" gap={0.5}>
                  <IconButton edge="end" onClick={() => handleEdit(s)} color="primary" size="small" aria-label="edit">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" onClick={() => void handleDelete(s.scheduleId)} color="error" size="small" aria-label="delete">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <ListItemIcon>
                <Switch edge="start" checked={s.isEnabled} onChange={() => void handleToggle(s.scheduleId)} size="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography fontWeight="bold">{s.time}</Typography>
                    <Chip label="Сценарий" color="info" size="small" sx={{ height: 22 }} variant="outlined" />
                  </Box>
                }
                secondary={getSortedDaysString(s.daysOfWeek) + (!s.isEnabled ? ' · выкл' : '')}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>

      <Dialog
        open={editingSchedule !== null}
        onClose={() => setEditingSchedule(null)}
        maxWidth="sm"
        disableRestoreFocus
        sx={{ zIndex: 1400, '& .MuiDialog-paper': { position: 'relative', zIndex: 1400, borderRadius: 2, minWidth: 450, maxWidth: 550 } }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" />
          Редактировать расписание
        </DialogTitle>
        <DialogContent sx={{ mt: 1, pb: 2 }}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <AccessTimeIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Время
                </Typography>
              </Box>
              <Box display="flex" gap={2} alignItems="flex-end" flexWrap="wrap">
                <TextField
                  type="time"
                  label="Время"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  sx={{
                    width: 120,
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                    '& input': { padding: '8.5px 14px' },
                  }}
                />
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={() => void handleSaveEdit()} variant="contained" sx={{ borderRadius: 1.5, height: 40 }} startIcon={<EditIcon />}>
                  Сохранить
                </Button>
              </Box>
            </Box>

            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <CalendarTodayIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>
                  Дни недели
                </Typography>
              </Box>
              <Box
                display="flex"
                gap={1}
                flexWrap="wrap"
                p={1.5}
                sx={{ bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider', width: 'fit-content' }}
              >
                <ScheduleDayPicker
                  selectedDays={editDays}
                  chipSize="medium"
                  chipSx={{ fontWeight: 600, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                  onToggle={(idx) =>
                    setEditDays((prev) =>
                      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b),
                    )
                  }
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {scheduleDaysHintCaption(editDays.length)}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1} sx={{ color: 'text.secondary' }}>
              <EventNoteIcon fontSize="small" />
              <Typography variant="caption">Действие всегда: применить сценарий группы</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditingSchedule(null)} variant="outlined">
            Отмена
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
