import { addDays, startOfDay } from 'date-fns';
import type { Medication, MedicationForm } from '@/types';
import { expandMedication } from '@/lib/schedule';
import { MED_FORMS } from '@/constants/schedule';
import { formatNumber, parseDateKey } from '@/lib/date';

/** Предохранители, чтобы расчёт не зацикливался на «бесконечном» запасе. */
const MAX_STOCK_DAYS = 3650;
const MAX_DAYS_WITHOUT_DOSES = 370;
const EPSILON = 1e-9;

export function formLabel(form: MedicationForm): string {
  return MED_FORMS.find((item) => item.value === form)?.label ?? 'Другое';
}

export function unitForForm(form: MedicationForm): string {
  return MED_FORMS.find((item) => item.value === form)?.unit ?? 'шт.';
}

type StockSimulation = {
  /**
   * Сколько дней продержится запас. Дни до первого приёма не считаются,
   * поэтому результат не зависит от времени суток.
   */
  days: number;
  /** true — закончился запас; false — закончилось расписание (курс). */
  exhausted: boolean;
};

function courseEndDay(med: Medication): Date | null {
  const schedule = med.schedule;
  if (schedule.type !== 'course' || !schedule.endDate) return null;
  return startOfDay(parseDateKey(schedule.endDate));
}

/**
 * Идёт по дням от сегодняшнего и вычитает запланированные приёмы,
 * пока запас не станет меньше дозы. Возвращает null, если приёмов больше не будет.
 */
function simulateStock(med: Medication, now: number): StockSimulation | null {
  const today = startOfDay(new Date(now));
  const courseEnd = courseEndDay(med);
  let remaining = med.stock;
  let day = today;
  let leadingEmptyDays = 0;
  let emptyDays = 0;
  let started = false;

  for (let index = 0; index < MAX_STOCK_DAYS; index += 1) {
    if (courseEnd && day.getTime() > courseEnd.getTime()) {
      return { days: Math.max(0, index - leadingEmptyDays), exhausted: false };
    }

    const from = index === 0 ? new Date(now) : day;
    const to = addDays(day, 1);
    const doses = expandMedication(med, from, to).length;

    if (doses === 0) {
      emptyDays += 1;
      if (!started) leadingEmptyDays += 1;
      if (emptyDays > MAX_DAYS_WITHOUT_DOSES) return null;
    } else {
      emptyDays = 0;
      started = true;
      for (let i = 0; i < doses; i += 1) {
        if (remaining + EPSILON < med.dose) {
          return { days: Math.max(0, index - leadingEmptyDays), exhausted: true };
        }
        remaining -= med.dose;
      }
    }

    day = to;
  }

  return { days: MAX_STOCK_DAYS, exhausted: false };
}

/**
 * Сколько дней хватит запаса при текущем расписании.
 * null — приёмов больше не будет (нет расписания или курс завершён).
 */
export function daysOfStockLeft(med: Medication, now: number = Date.now()): number | null {
  if (med.archived) return null;
  if (med.stock <= 0) return 0;
  if (med.schedule.type === 'course' && !med.schedule.endDate) return null;
  if (med.schedule.type !== 'every_n_hours' && med.schedule.times.length === 0) return null;

  const simulation = simulateStock(med, now);
  if (!simulation) return null;
  if (simulation.days > 0) return simulation.days;
  return simulation.exhausted ? 0 : null;
}

export function isLowStock(med: Medication, now: number = Date.now()): boolean {
  if (med.archived) return false;
  const left = daysOfStockLeft(med, now);
  if (left === null) return false;
  return left <= med.lowStockDays;
}

export function isOutOfStock(med: Medication): boolean {
  return med.stock <= 0;
}

export function stockBarRatio(med: Medication, now: number = Date.now()): number {
  const left = daysOfStockLeft(med, now);
  if (left === null) return 1;
  const full = Math.max(1, med.lowStockDays * 4);
  return Math.max(0, Math.min(1, left / full));
}

export function lowStockMeds(meds: Medication[], now: number = Date.now()): Medication[] {
  return meds.filter((med) => isLowStock(med, now));
}

export function stockUnitsLabel(med: Medication): string {
  const unit = med.unit || 'шт.';
  return `${formatNumber(Math.max(0, med.stock))} ${unit}`;
}
