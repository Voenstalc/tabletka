import { addDays, startOfDay } from 'date-fns';
import type { DoseEvent, DoseItem, DoseStatus, Medication } from '@/types';
import { MISSED_GRACE_MINUTES } from '@/constants/schedule';
import { dateKey } from '@/lib/date';
import { expandAll } from '@/lib/schedule';

export function doseKey(medicationId: string, scheduledAt: Date | string): string {
  const iso = typeof scheduledAt === 'string' ? scheduledAt : scheduledAt.toISOString();
  return `${medicationId}|${iso}`;
}

export function eventKey(event: DoseEvent): string {
  return doseKey(event.medicationId, event.scheduledAt);
}

export function resolveStatus(
  scheduledAt: Date,
  event: DoseEvent | null | undefined,
  now: number
): DoseStatus {
  if (event) return event.status;
  if (scheduledAt.getTime() + MISSED_GRACE_MINUTES * 60 * 1000 < now) return 'missed';
  return 'planned';
}

export function buildDoseItems(
  meds: Medication[],
  events: DoseEvent[],
  from: Date,
  to: Date,
  now: number = Date.now()
): DoseItem[] {
  const eventMap = new Map<string, DoseEvent>();
  for (const event of events) eventMap.set(eventKey(event), event);

  const items: DoseItem[] = [];
  for (const med of meds) {
    for (const scheduledAt of expandAll([med], from, to)) {
      const key = doseKey(med.id, scheduledAt);
      const event = eventMap.get(key) ?? null;
      items.push({
        key,
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        unit: med.unit,
        dose: med.dose,
        color: med.color,
        scheduledAt,
        status: resolveStatus(scheduledAt, event, now),
        event,
      });
    }
  }
  return items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export function buildDayItems(
  meds: Medication[],
  events: DoseEvent[],
  day: Date,
  now: number = Date.now()
): DoseItem[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return buildDoseItems(meds, events, from, to, now);
}

export type StatsBreakdown = {
  taken: number;
  skipped: number;
  missed: number;
  planned: number;
  due: number;
  adherence: number | null;
};

export type DayStats = StatsBreakdown & {
  dateKey: string;
  date: Date;
};

export type MedStats = StatsBreakdown & {
  medicationId: string;
  name: string;
  color: string;
};

export type PeriodStats = StatsBreakdown & {
  days: DayStats[];
  byMed: MedStats[];
};

function emptyBreakdown(): StatsBreakdown {
  return { taken: 0, skipped: 0, missed: 0, planned: 0, due: 0, adherence: null };
}

export function addToBreakdown(target: StatsBreakdown, item: DoseItem): void {
  if (item.status === 'taken') target.taken += 1;
  else if (item.status === 'skipped') target.skipped += 1;
  else if (item.status === 'missed') target.missed += 1;
  else target.planned += 1;
  target.due = target.taken + target.skipped + target.missed;
  target.adherence = target.due > 0 ? Math.round((target.taken / target.due) * 100) : null;
}

export function buildPeriodStats(
  meds: Medication[],
  events: DoseEvent[],
  from: Date,
  to: Date,
  now: number = Date.now()
): PeriodStats {
  const total: PeriodStats = { ...emptyBreakdown(), days: [], byMed: [] };
  const medMap = new Map<string, MedStats>();
  const start = startOfDay(from);
  const end = startOfDay(to);

  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const items = buildDayItems(meds, events, cursor, now);
    const day: DayStats = { ...emptyBreakdown(), dateKey: dateKey(cursor), date: new Date(cursor) };
    for (const item of items) {
      addToBreakdown(day, item);
      addToBreakdown(total, item);
      let medStats = medMap.get(item.medicationId);
      if (!medStats) {
        medStats = {
          ...emptyBreakdown(),
          medicationId: item.medicationId,
          name: item.medicationName,
          color: item.color,
        };
        medMap.set(item.medicationId, medStats);
      }
      addToBreakdown(medStats, item);
    }
    total.days.push(day);
    cursor = addDays(cursor, 1);
  }

  total.byMed = Array.from(medMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return total;
}

export function periodRange(days: number, now: number = Date.now()): { from: Date; to: Date } {
  const today = startOfDay(new Date(now));
  return { from: addDays(today, -(days - 1)), to: new Date(now) };
}

export type GroupedDoses = {
  missed: DoseItem[];
  due: DoseItem[];
  upcoming: DoseItem[];
  done: DoseItem[];
};

export function groupDoses(items: DoseItem[], now: number = Date.now()): GroupedDoses {
  const groups: GroupedDoses = { missed: [], due: [], upcoming: [], done: [] };
  for (const item of items) {
    if (item.status === 'missed') groups.missed.push(item);
    else if (item.status === 'taken' || item.status === 'skipped') groups.done.push(item);
    else if (item.scheduledAt.getTime() <= now) groups.due.push(item);
    else groups.upcoming.push(item);
  }
  groups.missed.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  groups.due.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  groups.upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  groups.done.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  return groups;
}

export function statusLabel(status: DoseStatus): string {
  switch (status) {
    case 'taken':
      return 'Принято';
    case 'skipped':
      return 'Пропущено';
    case 'missed':
      return 'Пропущено';
    default:
      return 'Запланировано';
  }
}

export function statusColor(status: DoseStatus): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'taken':
      return 'success';
    case 'skipped':
      return 'warning';
    case 'missed':
      return 'danger';
    default:
      return 'muted';
  }
}
