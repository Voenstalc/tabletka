import test from 'node:test';
import assert from 'node:assert/strict';
import type { DoseEvent, Medication, Schedule } from '../src/types';
import { defaultSchedule } from '../src/constants/schedule';
import {
  everyNHoursPreview,
  expandMedication,
  isScheduleValid,
  scheduleSummary,
} from '../src/lib/schedule';
import { buildDayItems, buildPeriodStats, resolveStatus } from '../src/lib/stats';
import { daysOfStockLeft, isLowStock } from '../src/lib/stock';
import { dateKey } from '../src/lib/date';

function makeMed(overrides: Partial<Medication> = {}, schedule: Partial<Schedule> = {}): Medication {
  const createdAt = new Date('2026-01-01T00:00:00').getTime();
  return {
    id: 'med-1',
    profileId: 'default',
    name: 'Тестовое лекарство',
    dosage: '100 мг',
    form: 'tablet',
    unit: 'таб.',
    dose: 1,
    notes: '',
    color: '#2358D8',
    stock: 10,
    lowStockDays: 3,
    stockNotifiedDate: null,
    createdAt,
    updatedAt: createdAt,
    archived: false,
    ...overrides,
    schedule: { ...defaultSchedule(['08:00']), ...schedule },
  };
}

function at(value: string): Date {
  return new Date(value);
}

test('ежедневное расписание разворачивается на каждый день', () => {
  const med = makeMed({}, { type: 'daily_times', times: ['08:00', '20:00'] });
  const doses = expandMedication(med, at('2026-01-05T00:00:00'), at('2026-01-07T00:00:00'));
  assert.equal(doses.length, 4);
  assert.deepEqual(
    doses.map((dose) => `${dateKey(dose)} ${dose.getHours()}:${dose.getMinutes()}`),
    ['2026-01-05 8:0', '2026-01-05 20:0', '2026-01-06 8:0', '2026-01-06 20:0']
  );
});

test('не создаёт приёмы раньше момента создания лекарства', () => {
  const createdAt = at('2026-01-05T10:00:00').getTime();
  const med = makeMed({ createdAt }, { type: 'daily_times', times: ['08:00', '20:00'] });
  const doses = expandMedication(med, at('2026-01-05T00:00:00'), at('2026-01-06T00:00:00'));
  assert.equal(doses.length, 1);
  assert.equal(doses[0].getHours(), 20);
});

test('расписание по дням недели учитывает выбранные дни', () => {
  // 5 января 2026 — понедельник
  const med = makeMed(
    {},
    { type: 'weekdays', weekdays: [1, 3, 5], times: ['09:00'] }
  );
  const doses = expandMedication(med, at('2026-01-05T00:00:00'), at('2026-01-12T00:00:00'));
  assert.deepEqual(
    doses.map((dose) => dateKey(dose)),
    ['2026-01-05', '2026-01-07', '2026-01-09']
  );
});

test('интервал каждые 8 часов продолжается через полночь', () => {
  const med = makeMed(
    {},
    { type: 'every_n_hours', times: ['08:00'], intervalHours: 8, startDate: '2026-01-05' }
  );
  const doses = expandMedication(med, at('2026-01-05T00:00:00'), at('2026-01-07T00:00:00'));
  assert.deepEqual(
    doses.map((dose) => `${dateKey(dose)} ${String(dose.getHours()).padStart(2, '0')}:00`),
    [
      '2026-01-05 08:00',
      '2026-01-05 16:00',
      '2026-01-06 00:00',
      '2026-01-06 08:00',
      '2026-01-06 16:00',
    ]
  );
});

test('интервал начинается с указанного момента, если запрос позже', () => {
  const med = makeMed(
    {},
    { type: 'every_n_hours', times: ['08:00'], intervalHours: 8, startDate: '2026-01-05' }
  );
  const doses = expandMedication(med, at('2026-01-05T09:00:00'), at('2026-01-05T20:00:00'));
  assert.equal(doses.length, 1);
  assert.equal(doses[0].getHours(), 16);
});

test('курс ограничен датой начала и конца', () => {
  const med = makeMed(
    {},
    {
      type: 'course',
      times: ['08:00', '20:00'],
      startDate: '2026-01-05',
      endDate: '2026-01-07',
    }
  );
  const doses = expandMedication(med, at('2026-01-01T00:00:00'), at('2026-01-10T00:00:00'));
  assert.equal(doses.length, 6);
  assert.equal(dateKey(doses[0]), '2026-01-05');
  assert.equal(dateKey(doses[doses.length - 1]), '2026-01-07');
});

test('валидация расписаний', () => {
  assert.equal(isScheduleValid({ ...defaultSchedule([]) }), false);
  assert.equal(isScheduleValid({ ...defaultSchedule(['08:00']) }), true);
  assert.equal(
    isScheduleValid({ ...defaultSchedule(['08:00']), type: 'weekdays', weekdays: [] }),
    false
  );
  assert.equal(
    isScheduleValid({
      ...defaultSchedule(['08:00']),
      type: 'course',
      startDate: '2026-01-05',
      endDate: '2026-01-04',
    }),
    false
  );
});

test('предпросмотр расписания каждые 6 часов', () => {
  assert.deepEqual(everyNHoursPreview('08:00', 6).slice(0, 4), ['08:00', '14:00', '20:00', '02:00']);
});

test('остаток считается в днях по суточной дозе', () => {
  const now = at('2026-01-10T12:00:00').getTime();
  const med = makeMed(
    { stock: 2, lowStockDays: 3, createdAt: at('2025-12-01T00:00:00').getTime() },
    { type: 'daily_times', times: ['20:00'] }
  );
  const left = daysOfStockLeft(med, now);
  assert.ok(left !== null && Math.abs(left - 2) < 0.01);
  assert.equal(isLowStock(med, now), true);

  const full = { ...med, stock: 10 };
  assert.equal(isLowStock(full, now), false);
});

test('остаток не зависит от времени суток', () => {
  const med = makeMed({ stock: 10 }, { type: 'daily_times', times: ['08:00'] });
  const before = daysOfStockLeft(med, at('2026-01-10T07:00:00').getTime());
  const after = daysOfStockLeft(med, at('2026-01-10T09:00:00').getTime());
  const night = daysOfStockLeft(med, at('2026-01-10T23:30:00').getTime());
  assert.equal(before, 10);
  assert.equal(after, 10);
  assert.equal(night, 10);
});

test('два приёма в день считаются по фактическому расходу', () => {
  const med = makeMed({ stock: 14 }, { type: 'daily_times', times: ['08:00', '20:00'] });
  assert.equal(daysOfStockLeft(med, at('2026-01-10T07:00:00').getTime()), 7);
  assert.equal(daysOfStockLeft(med, at('2026-01-10T12:00:00').getTime()), 7);
  assert.equal(daysOfStockLeft(med, at('2026-01-10T21:00:00').getTime()), 7);
});

test('для курса запас ограничен концом курса', () => {
  const med = makeMed(
    { stock: 20 },
    { type: 'course', times: ['08:00', '20:00'], startDate: '2026-01-10', endDate: '2026-01-12' }
  );
  assert.equal(daysOfStockLeft(med, at('2026-01-10T07:00:00').getTime()), 3);
  assert.equal(daysOfStockLeft(med, at('2026-01-10T09:00:00').getTime()), 3);
  // курс уже закончился — расписания больше нет
  assert.equal(daysOfStockLeft(med, at('2026-01-12T21:00:00').getTime()), null);
});

test('будущий курс не завышает остаток', () => {
  const med = makeMed(
    { stock: 20 },
    { type: 'course', times: ['08:00', '20:00'], startDate: '2026-01-13', endDate: '2026-01-20' }
  );
  // 8 дней приёма по 2 таблетки: курса хватает целиком
  assert.equal(daysOfStockLeft(med, at('2026-01-10T12:00:00').getTime()), 8);
});

test('расписание по дням недели учитывает пропуски', () => {
  // 5 января 2026 — понедельник
  const med = makeMed(
    { stock: 3 },
    { type: 'weekdays', weekdays: [1, 3, 5], times: ['09:00'] }
  );
  assert.equal(daysOfStockLeft(med, at('2026-01-05T00:00:00').getTime()), 7);
});

test('интервал каждые N часов расходует запас по факту', () => {
  const med = makeMed(
    { stock: 10 },
    { type: 'every_n_hours', times: ['08:00'], intervalHours: 8, startDate: '2026-01-10' }
  );
  assert.equal(daysOfStockLeft(med, at('2026-01-10T09:00:00').getTime()), 4);
});

test('лекарство, добавленное после сегодняшнего приёма, не теряет день', () => {
  const createdAt = at('2026-01-10T12:00:00').getTime();
  const med = makeMed({ stock: 5, createdAt }, { type: 'daily_times', times: ['08:00'] });
  assert.equal(daysOfStockLeft(med, createdAt), 5);
});

test('архивное лекарство не имеет прогноза остатка', () => {
  const med = makeMed({ stock: 10, archived: true });
  assert.equal(daysOfStockLeft(med, at('2026-01-10T12:00:00').getTime()), null);
  assert.equal(isLowStock(med, at('2026-01-10T12:00:00').getTime()), false);
});

test('статистика считает принятые и пропущенные приёмы', () => {
  const now = at('2026-01-10T12:00:00').getTime();
  const med = makeMed(
    { createdAt: at('2026-01-07T00:00:00').getTime() },
    { type: 'daily_times', times: ['08:00'] }
  );
  const scheduled = at('2026-01-08T08:00:00');
  const event: DoseEvent = {
    id: 'event-1',
    medicationId: med.id,
    profileId: med.profileId,
    scheduledAt: scheduled.toISOString(),
    status: 'taken',
    takenAt: scheduled.getTime() + 60_000,
    dose: 1,
  };
  const stats = buildPeriodStats(
    [med],
    [event],
    at('2026-01-08T00:00:00'),
    at('2026-01-10T12:00:00'),
    now
  );
  assert.equal(stats.taken, 1);
  assert.equal(stats.missed, 2);
  assert.equal(stats.due, 3);
  assert.equal(stats.adherence, 33);
});

test('статус дозы переходит в пропущенный после льготного времени', () => {
  const scheduled = at('2026-01-10T08:00:00');
  const now = at('2026-01-10T12:00:00').getTime();
  assert.equal(resolveStatus(scheduled, null, now), 'missed');
  assert.equal(
    resolveStatus(scheduled, null, at('2026-01-10T09:00:00').getTime()),
    'planned'
  );
});

test('текстовое описание расписания', () => {
  const med = makeMed({}, { type: 'weekdays', weekdays: [1, 2, 3, 4, 5], times: ['08:00'] });
  assert.equal(scheduleSummary(med), 'Пн, Вт, Ср, Чт, Пт: 08:00');
});

test('день строит элементы приёмов с учётом событий', () => {
  const now = at('2026-01-10T12:00:00').getTime();
  const med = makeMed(
    { createdAt: at('2026-01-01T00:00:00').getTime() },
    { type: 'daily_times', times: ['08:00', '20:00'] }
  );
  const scheduled = at('2026-01-10T08:00:00');
  const event: DoseEvent = {
    id: 'event-2',
    medicationId: med.id,
    profileId: med.profileId,
    scheduledAt: scheduled.toISOString(),
    status: 'skipped',
    takenAt: scheduled.getTime() + 60_000,
    dose: 1,
  };
  const items = buildDayItems([med], [event], at('2026-01-10T00:00:00'), now);
  assert.equal(items.length, 2);
  assert.equal(items[0].status, 'skipped');
  assert.equal(items[1].status, 'planned');
});
