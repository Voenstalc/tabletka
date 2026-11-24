import { addDays, endOfDay, startOfDay } from 'date-fns';
import type { Medication, Schedule } from '@/types';
import { WEEKDAYS } from '@/constants/schedule';
import { combineDateTime, dateKey, isoWeekday, parseDateKey, pluralDays, formatDateKeyRu } from '@/lib/date';

const MAX_DOSES = 4000;

export function normalizeTime(time: string): string {
  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const hours = Math.min(23, Math.max(0, Number.isFinite(rawHours) ? rawHours : 8));
  const minutes = Math.min(59, Math.max(0, Number.isFinite(rawMinutes) ? rawMinutes : 0));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function sortTimes(times: string[]): string[] {
  return [...times].map(normalizeTime).sort();
}

export function scheduleTimes(schedule: Schedule): string[] {
  return schedule.times.map(normalizeTime);
}

export function scheduleStartDay(med: Medication): Date {
  const schedule = med.schedule;
  if (schedule.type === 'course' && schedule.startDate) {
    return startOfDay(parseDateKey(schedule.startDate));
  }
  if (schedule.type === 'every_n_hours' && schedule.startDate) {
    return parseDateKey(schedule.startDate);
  }
  return startOfDay(new Date(med.createdAt));
}

/**
 * Разворачивает расписание лекарства в конкретные моменты приёма.
 * Возвращает даты в диапазоне [from, to).
 */
export function expandMedication(med: Medication, from: Date, to: Date): Date[] {
  if (med.archived || to.getTime() <= from.getTime()) return [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const schedule = med.schedule;
  const times = scheduleTimes(schedule);
  const result: Date[] = [];
  const pushIfInRange = (date: Date) => {
    const ms = date.getTime();
    if (ms >= fromMs && ms < toMs && result.length < MAX_DOSES) result.push(date);
  };

  if (schedule.type === 'every_n_hours') {
    const intervalHours = Math.max(1, schedule.intervalHours || 8);
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const startTime = times[0] ?? '08:00';
    let cursor = combineDateTime(
      schedule.startDate || dateKey(new Date(med.createdAt)),
      startTime
    );
    if (cursor.getTime() < fromMs) {
      const steps = Math.ceil((fromMs - cursor.getTime()) / intervalMs);
      cursor = new Date(cursor.getTime() + steps * intervalMs);
    }
    while (cursor.getTime() < toMs && result.length < MAX_DOSES) {
      pushIfInRange(cursor);
      cursor = new Date(cursor.getTime() + intervalMs);
    }
    return result.sort((a, b) => a.getTime() - b.getTime());
  }

  if (schedule.type === 'course') {
    if (!schedule.endDate) return [];
    const start = startOfDay(parseDateKey(schedule.startDate || dateKey(new Date(med.createdAt))));
    const end = endOfDay(parseDateKey(schedule.endDate));
    let day = startOfDay(from);
    if (day.getTime() < start.getTime()) day = start;
    while (day.getTime() <= end.getTime() && day.getTime() < toMs && result.length < MAX_DOSES) {
      for (const time of times) {
        pushIfInRange(combineDateTime(dateKey(day), time));
      }
      day = addDays(day, 1);
    }
    return result.sort((a, b) => a.getTime() - b.getTime());
  }

  // daily_times и weekdays
  const createdDay = startOfDay(new Date(med.createdAt));
  let day = startOfDay(from);
  if (day.getTime() < createdDay.getTime()) day = createdDay;
  while (day.getTime() < toMs && result.length < MAX_DOSES) {
    const weekday = isoWeekday(day);
    const weekdayAllowed =
      schedule.type === 'daily_times' || schedule.weekdays.includes(weekday);
    if (weekdayAllowed) {
      for (const time of times) {
        pushIfInRange(combineDateTime(dateKey(day), time));
      }
    }
    day = addDays(day, 1);
  }
  // не показываем приёмы, которые были до создания лекарства
  return result
    .filter((date) => date.getTime() >= med.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function expandAll(meds: Medication[], from: Date, to: Date): Date[] {
  return meds
    .flatMap((med) => expandMedication(med, from, to))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function dosesForDay(meds: Medication[], day: Date): Date[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return expandAll(meds, from, to);
}

export function scheduledDosesLeft(med: Medication, now: number): number {
  const from = new Date(now);
  const to = endOfDay(new Date(now));
  return expandMedication(med, from, to).length;
}

export function isScheduleValid(schedule: Schedule): boolean {
  if (schedule.type === 'every_n_hours') {
    return Boolean(schedule.times[0]) && schedule.intervalHours > 0;
  }
  if (schedule.type === 'weekdays') {
    return schedule.times.length > 0 && schedule.weekdays.length > 0;
  }
  if (schedule.type === 'course') {
    if (!schedule.startDate || !schedule.endDate) return false;
    if (schedule.endDate < schedule.startDate) return false;
    return schedule.times.length > 0;
  }
  return schedule.times.length > 0;
}

export function weekdayLabel(weekdays: number[]): string {
  if (weekdays.length === 0) return '—';
  if (weekdays.length === 7) return 'каждый день';
  return WEEKDAYS.filter((day) => weekdays.includes(day.value))
    .map((day) => day.short)
    .join(', ');
}

export function scheduleSummary(med: Medication): string {
  const schedule = med.schedule;
  const times = scheduleTimes(schedule).join(', ');
  switch (schedule.type) {
    case 'daily_times':
      return `Каждый день: ${times}`;
    case 'weekdays':
      return `${weekdayLabel(schedule.weekdays)}: ${times}`;
    case 'every_n_hours':
      return `Каждые ${schedule.intervalHours} ч, начиная с ${schedule.times[0] ?? '08:00'}`;
    case 'course': {
      const range =
        schedule.startDate && schedule.endDate
          ? `${formatDateKeyRu(schedule.startDate)} — ${formatDateKeyRu(schedule.endDate)}`
          : 'даты не заданы';
      return `Курс ${range}: ${times}`;
    }
    default:
      return times;
  }
}

export function scheduleTypeLabel(type: Schedule['type']): string {
  switch (type) {
    case 'daily_times':
      return 'Каждый день';
    case 'weekdays':
      return 'По дням недели';
    case 'every_n_hours':
      return 'Каждые N часов';
    case 'course':
      return 'Курс';
  }
}

export function everyNHoursPreview(startTime: string, intervalHours: number): string[] {
  const [hours, minutes] = normalizeTime(startTime).split(':').map(Number);
  const interval = Math.max(1, intervalHours);
  const times: string[] = [];
  let totalMinutes = hours * 60 + minutes;
  const end = totalMinutes + 24 * 60;
  while (totalMinutes < end && times.length < 24) {
    const h = Math.floor((totalMinutes % (24 * 60)) / 60);
    const m = totalMinutes % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    totalMinutes += interval * 60;
  }
  return times;
}

export function daysLeftLabel(days: number | null): string {
  if (days === null) return 'нет расписания';
  if (days <= 0) return 'закончились';
  if (days < 1) return 'меньше чем на день';
  return `хватит на ${Math.floor(days)} ${pluralDays(days)}`;
}
