import React from 'react';
import { Box, Chip, SxProps, Theme } from '@mui/material';

/** Как в .NET DayOfWeek: 0=Вс, 1=Пн … 6=Сб */
export const SCHEDULE_DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const SCHEDULE_DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const;

/** Алиас для старых фрагментов / HMR: в ScheduleDialog раньше была локальная константа `dayIndices`. */
export const dayIndices: readonly number[] = SCHEDULE_DAY_INDICES;

export function dayNameForIndex(idx: number): string {
  return idx === 0 ? SCHEDULE_DAY_NAMES[6] : SCHEDULE_DAY_NAMES[idx - 1];
}

export function getSortedDaysString(days: number[]): string {
  if (days.length === 7) return 'Каждый день';
  if (days.length === 0) return 'Однократно';
  const sorted = [...days].sort((a, b) => {
    const aVal = a === 0 ? 7 : a;
    const bVal = b === 0 ? 7 : b;
    return aVal - bVal;
  });
  return sorted.map((d) => SCHEDULE_DAY_NAMES[d === 0 ? 6 : d - 1]).join(', ');
}

export function scheduleDaysHintCaption(selectedCount: number): string {
  if (selectedCount === 0) return 'Однократное расписание (выполнится один раз в указанное время)';
  return `${selectedCount} ${selectedCount === 1 ? 'день' : 'дней'} выбрано`;
}

type ScheduleDayPickerProps = {
  selectedDays: number[];
  onToggle: (dayIndex: number) => void;
  chipSize?: 'small' | 'medium';
  chipSx?: SxProps<Theme>;
};

export function ScheduleDayPicker({ selectedDays, onToggle, chipSize = 'small', chipSx }: ScheduleDayPickerProps) {
  return (
    <Box display="flex" gap={chipSize === 'small' ? 0.5 : 1} flexWrap="wrap" alignItems="center" mb={0.5}>
      {dayIndices.map((idx) => (
        <Chip
          key={idx}
          label={dayNameForIndex(idx)}
          onClick={() => onToggle(idx)}
          color={selectedDays.includes(idx) ? 'primary' : 'default'}
          variant={selectedDays.includes(idx) ? 'filled' : 'outlined'}
          size={chipSize}
          clickable
          sx={chipSx}
        />
      ))}
    </Box>
  );
}
