import type { MedicationForm, Schedule, Settings } from '@/types';

export const WEEKDAYS = [
  { value: 1, short: 'Пн', full: 'Понедельник' },
  { value: 2, short: 'Вт', full: 'Вторник' },
  { value: 3, short: 'Ср', full: 'Среда' },
  { value: 4, short: 'Чт', full: 'Четверг' },
  { value: 5, short: 'Пт', full: 'Пятница' },
  { value: 6, short: 'Сб', full: 'Суббота' },
  { value: 7, short: 'Вс', full: 'Воскресенье' },
] as const;

export const MED_FORMS: { value: MedicationForm; label: string; unit: string }[] = [
  { value: 'tablet', label: 'Таблетки', unit: 'таб.' },
  { value: 'capsule', label: 'Капсулы', unit: 'капс.' },
  { value: 'drops', label: 'Капли', unit: 'кап.' },
  { value: 'other', label: 'Другое', unit: 'шт.' },
];

export const MED_COLORS = [
  '#2358D8',
  '#1F8A4C',
  '#B26A00',
  '#8E44AD',
  '#C0392B',
  '#0E7490',
  '#BE185D',
  '#4B5563',
];

export const DEFAULT_SETTINGS: Settings = {
  activeProfileId: 'default',
  snoozeMinutes: 15,
  repeatReminder: true,
  repeatMinutes: 15,
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
};

export const DEFAULT_LOW_STOCK_DAYS = 3;
export const LOW_STOCK_WARNING_RATIO = 4;
export const MISSED_GRACE_MINUTES = 120;
export const SNOOZE_OPTIONS = [5, 10, 15, 30];
export const REPEAT_OPTIONS = [5, 10, 15, 30];
export const INTERVAL_OPTIONS = [4, 6, 8, 12];
export const NOTIFICATION_WINDOW_DAYS = 30;
export const MAX_SCHEDULED_NOTIFICATIONS = 58;

export function defaultSchedule(times: string[] = ['08:00']): Schedule {
  return {
    type: 'daily_times',
    times,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    intervalHours: 8,
    startDate: '',
    endDate: null,
  };
}
