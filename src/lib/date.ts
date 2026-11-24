import { addDays, format, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

export const DATE_KEY = 'yyyy-MM-dd';

export function dateKey(date: Date): string {
  return format(date, DATE_KEY);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function startOfToday(now: number | Date = Date.now()): Date {
  return startOfDay(new Date(now));
}

export function addDaysToKey(key: string, days: number): string {
  return dateKey(addDays(parseDateKey(key), days));
}

export function combineDateTime(key: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = parseDateKey(key);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

export function combineDateTimeSafe(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatLongDate(date: Date): string {
  return capitalize(format(date, 'EEEE, d MMMM', { locale: ru }));
}

export function formatShortDate(date: Date): string {
  return format(date, 'd MMM', { locale: ru });
}

export function formatShortDateWithYear(date: Date): string {
  return format(date, 'd MMM yyyy', { locale: ru });
}

export function formatWeekdayShort(date: Date): string {
  return capitalize(format(date, 'EE', { locale: ru }));
}

export function formatDateKeyRu(key: string, withYear = false): string {
  const date = parseDateKey(key);
  return format(date, withYear ? 'd MMMM yyyy' : 'd MMMM', { locale: ru });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function nextDays(count: number, from: Date = new Date()): Date[] {
  const start = startOfDay(from);
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function pluralDays(value: number): string {
  const rounded = Math.abs(Math.round(value));
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

export function pluralDoses(value: number): string {
  const rounded = Math.abs(Math.round(value));
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  if (mod10 === 1 && mod100 !== 11) return 'приём';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'приёма';
  return 'приёмов';
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100).replace('.', ',');
}
