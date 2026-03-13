import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    List, ListItem, ListItemText, IconButton, Typography, 
    Box, TextField, FormControl, InputLabel, Select, MenuItem, 
    Checkbox, ListItemIcon, Chip, Switch 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { api } from '../api/client';

interface Schedule {
    id: number;
    deviceId: number;
    time: string;
    daysOfWeek: number[];
    actionOn: boolean;
    action?: string; // Для устройств с несколькими действиями (окна: "closed", "tilted", "opened")
    isEnabled: boolean;
}

interface ScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    deviceId: number;
    deviceName: string;
    deviceType: string;
}

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']; // Индексы: 1=Пн, 2=Вт, ..., 6=Сб, 0=Вс

export const ScheduleDialog = ({ open, onClose, deviceId, deviceName, deviceType }: ScheduleDialogProps) => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [newTime, setNewTime] = useState('08:00');
    // Инициализируем действие в зависимости от типа устройства
    const getDefaultAction = () => {
        if (!deviceType) return 'on';
        if (deviceType.toLowerCase() === 'window') return 'closed';
        return 'on';
    };
    const [newAction, setNewAction] = useState(() => getDefaultAction());
    const [selectedDays, setSelectedDays] = useState<number[]>([]); // По умолчанию пусто - однократное расписание
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [editTime, setEditTime] = useState('08:00');
    const [editAction, setEditAction] = useState(() => {
        if (deviceType?.toLowerCase() === 'window') return 'closed';
        return 'on';
    });
    const [editDays, setEditDays] = useState<number[]>([]);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        if (open && deviceId) {
            setAccessDenied(false);
            fetchSchedules();
            setNewTime('08:00');
            setNewAction(getDefaultAction());
            setSelectedDays([]);
        }
    }, [open, deviceId, deviceType]);

    const fetchSchedules = async () => {
        try {
            setAccessDenied(false);
            const res = await api.get<Schedule[]>(`/schedules/device/${deviceId}`);
            const sorted = [...res.data].sort((a, b) => {
                const timeA = a.time.split(':').map(Number);
                const timeB = b.time.split(':').map(Number);
                const minutesA = timeA[0] * 60 + timeA[1];
                const minutesB = timeB[0] * 60 + timeB[1];
                return minutesA - minutesB;
            });
            setSchedules(sorted);
        } catch (err: any) {
            if (err.response?.status === 403) setAccessDenied(true);
            else console.error(err);
        }
    };

    const handleAdd = async () => {
        // Пустой массив дней означает однократное выполнение сегодня
        try {
            const isWindow = deviceType.toLowerCase() === 'window';
            await api.post('/schedules', {
                deviceId,
                time: newTime,
                daysOfWeek: selectedDays,
                action: isWindow ? newAction : undefined,
                actionOn: isWindow ? undefined : (newAction === 'on')
            });
            // Сброс формы после добавления
            setNewTime('08:00');
            setNewAction('on');
            setSelectedDays([]); // По умолчанию пусто - однократное расписание
            fetchSchedules();
        } catch (err) {
            console.error(err);
            alert('Ошибка при добавлении расписания');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/schedules/${id}`);
            fetchSchedules();
        } catch (err) { console.error(err); }
    };

    const handleToggleDay = (dayIndex: number) => {
        setSelectedDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(d => d !== dayIndex) 
                : [...prev, dayIndex].sort()
        );
    };

    const handleToggleEnabled = async (id: number) => {
         try {
            await api.put(`/schedules/${id}/toggle`);
            setSchedules(prev => prev.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
        } catch (err) { 
            console.error(err);
            alert('Ошибка при изменении статуса расписания');
        }
    };

    const handleToggleAction = async (id: number) => {
        try {
            const schedule = schedules.find(s => s.id === id);
            if (!schedule) return;
            
            await api.put(`/schedules/${id}`, {
                actionOn: !schedule.actionOn
            });
            fetchSchedules();
        } catch (err) {
            console.error(err);
            alert('Ошибка при изменении действия');
        }
    };

    // Получить доступные действия для типа устройства
    const getAvailableActions = () => {
        if (!deviceType) {
            return [
                { value: 'on', label: 'Включить' },
                { value: 'off', label: 'Выключить' }
            ];
        }
        const type = deviceType.toLowerCase();
        if (type === 'window') {
            return [
                { value: 'closed', label: 'Закрыто' },
                { value: 'tilted', label: 'Проветривание' },
                { value: 'opened', label: 'Открыто' }
            ];
        }
        // Для остальных устройств: вкл/выкл
        return [
            { value: 'on', label: 'Включить' },
            { value: 'off', label: 'Выключить' }
        ];
    };

    const getActionLabel = (action: string | boolean | undefined) => {
        if (typeof action === 'boolean') {
            return action ? 'ВКЛ' : 'ВЫКЛ';
        }
        if (typeof action === 'string') {
            const actions = getAvailableActions();
            const found = actions.find(a => a.value === action);
            return found ? found.label.toUpperCase() : action.toUpperCase();
        }
        return 'ВКЛ';
    };

    const handleEdit = (schedule: Schedule) => {
        setEditingSchedule(schedule);
        setEditTime(schedule.time);
        // Правильно определяем действие: сначала проверяем action, потом actionOn
        let action = schedule.action;
        if (!action) {
            // Если action нет, используем actionOn для обратной совместимости
            action = schedule.actionOn ? 'on' : 'off';
        }
        // Если это окно и действие не соответствует доступным, используем первое доступное
        if (deviceType?.toLowerCase() === 'window') {
            const availableActions = getAvailableActions();
            if (!availableActions.find(a => a.value === action)) {
                action = availableActions[0]?.value || 'closed';
            }
        }
        setEditAction(action);
        setEditDays([...schedule.daysOfWeek]);
    };

    const handleSaveEdit = async () => {
        if (!editingSchedule) return;
        // Пустой массив дней означает однократное выполнение сегодня
        try {
            const isWindow = deviceType.toLowerCase() === 'window';
            await api.put(`/schedules/${editingSchedule.id}`, {
                time: editTime,
                daysOfWeek: editDays,
                action: isWindow ? editAction : undefined,
                actionOn: isWindow ? undefined : (editAction === 'on')
            });
            setEditingSchedule(null);
            fetchSchedules();
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении изменений');
        }
    };

    const dayIndices = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order

    const getSortedDaysString = (days: number[]) => {
        if (days.length === 7) return "Каждый день";
        if (days.length === 0) return "Однократно";
        
        // Sort: 1-6 then 0 (Mon-Sun)
        const sorted = [...days].sort((a, b) => {
            const aVal = a === 0 ? 7 : a;
            const bVal = b === 0 ? 7 : b;
            return aVal - bVal;
        });
        
        // Маппинг: 1=Пн->DAYS[0], 2=Вт->DAYS[1], ..., 6=Сб->DAYS[5], 0=Вс->DAYS[6]
        return sorted.map(d => DAYS[d === 0 ? 6 : d - 1]).join(', ');
    };

    const accessDeniedMessage = 'Расписание устройства видят только владельцы и жильцы этого дома. Так мы сохраняем вашу приватность и комфорт.';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            sx={{
                zIndex: 1300,
                '& .MuiDialog-paper': {
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                },
            }}
        >
            <DialogTitle>Расписание: {deviceName}</DialogTitle>
            <DialogContent>
                {accessDenied ? (
                    <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, maxWidth: 360, mx: 'auto' }}>
                            {accessDeniedMessage}
                        </Typography>
                    </Box>
                ) : (
                <>
                <Box mb={3} mt={1} p={2} bgcolor="background.paper" borderRadius={2} border={1} borderColor="divider">
                    <Typography variant="subtitle2" gutterBottom>Добавить новое правило</Typography>
                    <Box display="flex" gap={2} mb={2}>
                        <TextField
                            label="Время"
                            type="time"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                            sx={{
                                width: 120,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5
                                },
                                '& input': {
                                    padding: '8.5px 14px'
                                }
                            }}
                        />
                        <FormControl size="small" sx={{ width: 140 }}>
                            <InputLabel id="action-select-label">Действие</InputLabel>
                            <Select
                                labelId="action-select-label"
                                value={newAction}
                                label="Действие"
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setNewAction(value);
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        style: {
                                            maxHeight: 300
                                        }
                                    }
                                }}
                                sx={{
                                    borderRadius: 1.5
                                }}
                            >
                                {getAvailableActions().map(action => (
                                    <MenuItem key={action.value} value={action.value}>
                                        {action.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" onClick={handleAdd}>Добавить</Button>
                    </Box>
                    <Box>
                        <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center" mb={0.5}>
                        {dayIndices.map((idx) => (
                            <Chip 
                                key={idx}
                                label={DAYS[idx === 0 ? 6 : idx - 1]}
                                onClick={() => handleToggleDay(idx)}
                                color={selectedDays.includes(idx) ? "primary" : "default"}
                                variant={selectedDays.includes(idx) ? "filled" : "outlined"}
                                size="small"
                                clickable
                            />
                        ))}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            {selectedDays.length === 0 
                                ? 'Однократное расписание (выполнится один раз в указанное время)' 
                                : `${selectedDays.length} ${selectedDays.length === 1 ? 'день' : 'дней'} выбрано`}
                        </Typography>
                    </Box>
                </Box>

                <List>
                    {schedules.length === 0 && <Typography color="text.secondary" align="center">Нет активных расписаний</Typography>}
                    {schedules.map(s => (
                        <ListItem key={s.id} secondaryAction={
                            <Box display="flex" gap={0.5}>
                                <IconButton edge="end" onClick={() => handleEdit(s)} color="primary" size="small">
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton edge="end" onClick={() => handleDelete(s.id)} color="error" size="small">
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        }>
                            <ListItemIcon>
                                <Switch 
                                    edge="start" 
                                    checked={s.isEnabled} 
                                    onChange={() => handleToggleEnabled(s.id)} 
                                    size="small"
                                />
                            </ListItemIcon>
                                <ListItemText 
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography fontWeight="bold">{s.time}</Typography>
                                            <Chip 
                                                label={getActionLabel(s.action || s.actionOn)} 
                                                color={(s.action || s.actionOn === true) ? "success" : "default"}
                                                size="small" 
                                                sx={{ height: 20 }} 
                                            />
                                        </Box>
                                    }
                                    secondary={getSortedDaysString(s.daysOfWeek)}
                                />
                        </ListItem>
                    ))}
                </List>
                </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>

            {/* Диалог редактирования */}
            <Dialog 
                open={editingSchedule !== null} 
                onClose={() => setEditingSchedule(null)} 
                maxWidth="sm"
                hideBackdrop={false}
                disableRestoreFocus={true}
                sx={{ zIndex: 1400, '& .MuiDialog-paper': { position: 'relative', zIndex: 1400, borderRadius: 2, minWidth: 450, maxWidth: 550 } }}
            >
                <DialogTitle sx={{ pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon color="primary" />
                    Редактировать расписание
                </DialogTitle>
                <DialogContent sx={{ mt: 1, pb: 2 }}>
                    <Box display="flex" flexDirection="column" gap={2}>
                        {/* Время и Действие в одной строке */}
                        <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                                <AccessTimeIcon fontSize="small" color="primary" />
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Время и действие
                                </Typography>
                            </Box>
                            <Box display="flex" gap={2} alignItems="flex-end">
                                <TextField
                                    type="time"
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    size="small"
                                    sx={{
                                        width: 120,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 1.5
                                        },
                                        '& input': {
                                            padding: '8.5px 14px'
                                        }
                                    }}
                                />
                                <FormControl size="small" sx={{ width: 140 }}>
                                    <InputLabel id="edit-action-select-label">Действие</InputLabel>
                                    <Select
                                        labelId="edit-action-select-label"
                                        value={editAction}
                                        label="Действие"
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setEditAction(value);
                                        }}
                                        MenuProps={{
                                            disablePortal: true,
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300
                                                }
                                            }
                                        }}
                                        sx={{
                                            borderRadius: 1.5
                                        }}
                                    >
                                        {getAvailableActions().map(action => (
                                            <MenuItem key={action.value} value={action.value}>
                                                {action.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Box sx={{ flexGrow: 1 }} />
                                <Button 
                                    onClick={handleSaveEdit} 
                                    variant="contained"
                                    sx={{ borderRadius: 1.5, height: '40px' }}
                                    startIcon={<EditIcon />}
                                >
                                    Сохранить
                                </Button>
                            </Box>
                        </Box>

                        {/* Дни недели */}
                        <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                                <CalendarTodayIcon fontSize="small" color="primary" />
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Дни недели
                                </Typography>
                            </Box>
                            <Box display="flex" gap={2} alignItems="center">
                                <Box 
                                    display="flex" 
                                    gap={1} 
                                    flexWrap="wrap"
                                    p={1.5}
                                    sx={{ bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider', width: 'fit-content' }}
                                >
                                    {dayIndices.map((idx) => (
                                        <Chip 
                                            key={idx}
                                            label={DAYS[idx === 0 ? 6 : idx - 1]}
                                            onClick={() => {
                                                setEditDays(prev => 
                                                    prev.includes(idx) 
                                                        ? prev.filter(d => d !== idx) 
                                                        : [...prev, idx].sort()
                                                );
                                            }}
                                            color={editDays.includes(idx) ? "primary" : "default"}
                                            variant={editDays.includes(idx) ? "filled" : "outlined"}
                                            size="medium"
                                            clickable
                                            sx={{ fontWeight: editDays.includes(idx) ? 600 : 400, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                                        />
                                    ))}
                                </Box>
                                <Box sx={{ flexGrow: 1 }} />
                                <Button 
                                    onClick={() => setEditingSchedule(null)}
                                    variant="outlined"
                                    size="small"
                                    sx={{ borderRadius: 1.5 }}
                                >
                                    Отмена
                                </Button>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                {editDays.length === 0 ? 'Однократно (только сегодня)' : `${editDays.length} ${editDays.length === 1 ? 'день' : 'дней'} выбрано`}
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};



