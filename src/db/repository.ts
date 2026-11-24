import type {
  Backup,
  DoseEvent,
  Medication,
  MedicationForm,
  NotificationMapEntry,
  Profile,
  Schedule,
  Settings,
} from '@/types';
import { DEFAULT_PROFILE_ID, getDb } from '@/db/database';
import {
  DEFAULT_SETTINGS,
  defaultSchedule,
  DEFAULT_LOW_STOCK_DAYS,
  MED_COLORS,
} from '@/constants/schedule';
import { makeId } from '@/lib/id';
import { dateKey } from '@/lib/date';

type MedicationRow = {
  id: string;
  profile_id: string;
  name: string;
  dosage: string;
  form: string;
  unit: string;
  dose: number;
  notes: string;
  color: string;
  schedule_json: string;
  stock: number;
  low_stock_days: number;
  stock_notified_date: string | null;
  created_at: number;
  updated_at: number;
  archived: number;
};

type EventRow = {
  id: string;
  medication_id: string;
  profile_id: string;
  scheduled_at: string;
  status: string;
  taken_at: number;
  dose: number;
};

type ProfileRow = {
  id: string;
  name: string;
  color: string;
  created_at: number;
};

function parseSchedule(json: string): Schedule {
  try {
    const parsed = JSON.parse(json) as Partial<Schedule>;
    return {
      ...defaultSchedule(),
      ...parsed,
      times: Array.isArray(parsed.times) ? parsed.times : ['08:00'],
      weekdays: Array.isArray(parsed.weekdays) ? parsed.weekdays : [1, 2, 3, 4, 5, 6, 7],
    };
  } catch {
    return defaultSchedule();
  }
}

function rowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    dosage: row.dosage,
    form: row.form as MedicationForm,
    unit: row.unit,
    dose: row.dose,
    notes: row.notes,
    color: row.color,
    schedule: parseSchedule(row.schedule_json),
    stock: row.stock,
    lowStockDays: row.low_stock_days,
    stockNotifiedDate: row.stock_notified_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived === 1,
  };
}

function rowToEvent(row: EventRow): DoseEvent {
  return {
    id: row.id,
    medicationId: row.medication_id,
    profileId: row.profile_id,
    scheduledAt: row.scheduled_at,
    status: row.status === 'skipped' ? 'skipped' : 'taken',
    takenAt: row.taken_at,
    dose: row.dose,
  };
}

function rowToProfile(row: ProfileRow): Profile {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at };
}

export async function loadProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ProfileRow>('SELECT * FROM profiles ORDER BY created_at ASC');
  return rows.map(rowToProfile);
}

export async function insertProfile(name: string, color = MED_COLORS[0]): Promise<Profile> {
  const db = await getDb();
  const profile: Profile = { id: makeId('profile'), name, color, createdAt: Date.now() };
  await db.runAsync(
    'INSERT INTO profiles (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    profile.id,
    profile.name,
    profile.color,
    profile.createdAt
  );
  return profile;
}

export async function updateProfile(profile: Profile): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE profiles SET name = ?, color = ? WHERE id = ?',
    profile.name,
    profile.color,
    profile.id
  );
}

export async function deleteProfile(profileId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM profiles WHERE id = ?', profileId);
}

export async function loadMedications(profileId: string): Promise<Medication[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationRow>(
    'SELECT * FROM medications WHERE profile_id = ? AND archived = 0 ORDER BY created_at ASC',
    profileId
  );
  return rows.map(rowToMedication);
}

export async function loadAllMedications(): Promise<Medication[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationRow>('SELECT * FROM medications ORDER BY created_at ASC');
  return rows.map(rowToMedication);
}

export async function insertMedication(med: Medication): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO medications
      (id, profile_id, name, dosage, form, unit, dose, notes, color, schedule_json, stock,
       low_stock_days, stock_notified_date, created_at, updated_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    med.id,
    med.profileId,
    med.name,
    med.dosage,
    med.form,
    med.unit,
    med.dose,
    med.notes,
    med.color,
    JSON.stringify(med.schedule),
    med.stock,
    med.lowStockDays,
    med.stockNotifiedDate,
    med.createdAt,
    med.updatedAt,
    med.archived ? 1 : 0
  );
}

export async function updateMedication(med: Medication): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET
      name = ?, dosage = ?, form = ?, unit = ?, dose = ?, notes = ?, color = ?,
      schedule_json = ?, stock = ?, low_stock_days = ?, stock_notified_date = ?,
      updated_at = ?, archived = ?
     WHERE id = ?`,
    med.name,
    med.dosage,
    med.form,
    med.unit,
    med.dose,
    med.notes,
    med.color,
    JSON.stringify(med.schedule),
    med.stock,
    med.lowStockDays,
    med.stockNotifiedDate,
    med.updatedAt,
    med.archived ? 1 : 0,
    med.id
  );
}

export async function deleteMedication(medicationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medications WHERE id = ?', medicationId);
}

export async function logStockChange(
  medicationId: string,
  delta: number,
  reason: string
): Promise<void> {
  if (delta === 0) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO stock_log (id, medication_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    makeId('stock'),
    medicationId,
    delta,
    reason,
    Date.now()
  );
}

export async function setMedicationStock(
  medicationId: string,
  newStock: number,
  reason: string
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ stock: number }>(
    'SELECT stock FROM medications WHERE id = ?',
    medicationId
  );
  if (!row) return 0;
  const nextStock = Math.max(0, newStock);
  const delta = nextStock - row.stock;
  await db.runAsync(
    'UPDATE medications SET stock = ?, updated_at = ? WHERE id = ?',
    nextStock,
    Date.now(),
    medicationId
  );
  await logStockChange(medicationId, delta, reason);
  return nextStock;
}

export async function setStockNotifiedDate(
  medicationId: string,
  value: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE medications SET stock_notified_date = ? WHERE id = ?',
    value,
    medicationId
  );
}

export async function adjustMedicationStock(
  medicationId: string,
  delta: number,
  reason: string,
  allowNegative = false
): Promise<number> {
  const db = await getDb();
  let nextStock = 0;
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ stock: number }>(
      'SELECT stock FROM medications WHERE id = ?',
      medicationId
    );
    if (!row) return;
    nextStock = allowNegative ? row.stock + delta : Math.max(0, row.stock + delta);
    await db.runAsync(
      'UPDATE medications SET stock = ?, updated_at = ? WHERE id = ?',
      nextStock,
      Date.now(),
      medicationId
    );
    await db.runAsync(
      'INSERT INTO stock_log (id, medication_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      makeId('stock'),
      medicationId,
      nextStock - row.stock,
      reason,
      Date.now()
    );
  });
  return nextStock;
}

export async function loadEvents(
  profileId: string,
  fromIso?: string,
  toIso?: string
): Promise<DoseEvent[]> {
  const db = await getDb();
  let rows: EventRow[];
  if (fromIso && toIso) {
    rows = await db.getAllAsync<EventRow>(
      'SELECT * FROM dose_events WHERE profile_id = ? AND scheduled_at >= ? AND scheduled_at <= ? ORDER BY scheduled_at ASC',
      profileId,
      fromIso,
      toIso
    );
  } else {
    rows = await db.getAllAsync<EventRow>(
      'SELECT * FROM dose_events WHERE profile_id = ? ORDER BY scheduled_at ASC',
      profileId
    );
  }
  return rows.map(rowToEvent);
}

export async function upsertEvent(event: DoseEvent): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO dose_events (id, medication_id, profile_id, scheduled_at, status, taken_at, dose)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (medication_id, scheduled_at) DO UPDATE SET
       status = excluded.status,
       taken_at = excluded.taken_at,
       dose = excluded.dose`,
    event.id,
    event.medicationId,
    event.profileId,
    event.scheduledAt,
    event.status,
    event.takenAt,
    event.dose
  );
}

export async function deleteEvent(medicationId: string, scheduledAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM dose_events WHERE medication_id = ? AND scheduled_at = ?',
    medicationId,
    scheduledAt
  );
}

export async function findEvent(
  medicationId: string,
  scheduledAt: string
): Promise<DoseEvent | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EventRow>(
    'SELECT * FROM dose_events WHERE medication_id = ? AND scheduled_at = ?',
    medicationId,
    scheduledAt
  );
  return row ? rowToEvent(row) : null;
}

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in settings)) continue;
    try {
      (settings as unknown as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {
      // ignore broken values and keep defaults
    }
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        key,
        JSON.stringify(value)
      );
    }
  });
}

export async function loadNotificationMap(): Promise<NotificationMapEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    medication_id: string;
    scheduled_at: string;
    kind: string;
    notification_id: string;
    created_at: number;
  }>('SELECT * FROM notification_map');
  return rows.map((row) => ({
    id: row.id,
    medicationId: row.medication_id,
    scheduledAt: row.scheduled_at,
    kind: row.kind as NotificationMapEntry['kind'],
    notificationId: row.notification_id,
    createdAt: row.created_at,
  }));
}

export async function addNotificationEntries(entries: NotificationMapEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync(
        'INSERT INTO notification_map (id, medication_id, scheduled_at, kind, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        entry.id,
        entry.medicationId,
        entry.scheduledAt,
        entry.kind,
        entry.notificationId,
        entry.createdAt
      );
    }
  });
}

export async function clearNotificationMap(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notification_map');
}

export async function deleteNotificationEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM notification_map WHERE id = ?', id);
    }
  });
}

export async function exportAllData(): Promise<Backup> {
  const db = await getDb();
  const [profiles, medications, events, settings] = await Promise.all([
    loadProfiles(),
    loadAllMedications(),
    db
      .getAllAsync<EventRow>('SELECT * FROM dose_events ORDER BY scheduled_at ASC')
      .then((rows) => rows.map(rowToEvent)),
    loadSettings(),
  ]);
  return {
    format: 'tabletka-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    medications,
    events,
    settings,
  };
}

function isBackup(value: unknown): value is Backup {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<Backup>;
  return (
    data.format === 'tabletka-backup' &&
    data.version === 1 &&
    Array.isArray(data.profiles) &&
    data.profiles.length > 0 &&
    Array.isArray(data.medications) &&
    Array.isArray(data.events) &&
    Boolean(data.settings) &&
    typeof data.settings === 'object'
  );
}

export async function importAllData(value: unknown): Promise<Backup> {
  if (!isBackup(value)) {
    throw new Error('Файл не похож на резервную копию «Таблетки».');
  }
  const db = await getDb();
  const backup = value;
  const activeProfile = backup.profiles.find((p) => p.id === backup.settings.activeProfileId);
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...backup.settings,
    activeProfileId: activeProfile?.id ?? backup.profiles[0].id,
  };

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM notification_map;
      DELETE FROM stock_log;
      DELETE FROM dose_events;
      DELETE FROM medications;
      DELETE FROM settings;
      DELETE FROM profiles;
    `);

    for (const profile of backup.profiles) {
      await db.runAsync(
        'INSERT INTO profiles (id, name, color, created_at) VALUES (?, ?, ?, ?)',
        profile.id,
        profile.name,
        profile.color,
        profile.createdAt
      );
    }
    for (const med of backup.medications) {
      await db.runAsync(
        `INSERT INTO medications
          (id, profile_id, name, dosage, form, unit, dose, notes, color, schedule_json, stock,
           low_stock_days, stock_notified_date, created_at, updated_at, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        med.id,
        med.profileId,
        med.name,
        med.dosage,
        med.form,
        med.unit,
        med.dose,
        med.notes,
        med.color,
        JSON.stringify(med.schedule),
        med.stock,
        med.lowStockDays ?? DEFAULT_LOW_STOCK_DAYS,
        med.stockNotifiedDate ?? null,
        med.createdAt,
        med.updatedAt,
        med.archived ? 1 : 0
      );
    }
    for (const event of backup.events) {
      await db.runAsync(
        'INSERT OR REPLACE INTO dose_events (id, medication_id, profile_id, scheduled_at, status, taken_at, dose) VALUES (?, ?, ?, ?, ?, ?, ?)',
        event.id,
        event.medicationId,
        event.profileId,
        event.scheduledAt,
        event.status,
        event.takenAt,
        event.dose
      );
    }
    for (const [key, settingValue] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        key,
        JSON.stringify(settingValue)
      );
    }
  });

  return { ...backup, settings };
}

export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM notification_map;
      DELETE FROM stock_log;
      DELETE FROM dose_events;
      DELETE FROM medications;
      DELETE FROM settings;
      DELETE FROM profiles;
    `);
    await db.runAsync(
      'INSERT INTO profiles (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      DEFAULT_PROFILE_ID,
      'Я',
      MED_COLORS[0],
      Date.now()
    );
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        key,
        JSON.stringify(value)
      );
    }
  });
}

export async function seedDemoData(profileId: string): Promise<void> {
  const now = Date.now();
  const today = dateKey(new Date(now));
  const endDate = dateKey(new Date(now + 6 * 24 * 60 * 60 * 1000));
  const base = {
    profileId,
    notes: '',
    stockNotifiedDate: null,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };

  const demo: Medication[] = [
    {
      ...base,
      id: makeId('med'),
      name: 'Витамин D3',
      dosage: '1000 МЕ',
      form: 'tablet',
      unit: 'таб.',
      dose: 1,
      color: MED_COLORS[0],
      schedule: { ...defaultSchedule(['09:00']), type: 'daily_times' },
      stock: 20,
      lowStockDays: 3,
    },
    {
      ...base,
      id: makeId('med'),
      name: 'Амоксициллин',
      dosage: '500 мг',
      form: 'capsule',
      unit: 'капс.',
      dose: 1,
      color: MED_COLORS[4],
      schedule: {
        ...defaultSchedule(['08:00', '20:00']),
        type: 'course',
        startDate: today,
        endDate,
      },
      stock: 14,
      lowStockDays: 2,
    },
    {
      ...base,
      id: makeId('med'),
      name: 'Магний B6',
      dosage: '48 мг',
      form: 'tablet',
      unit: 'таб.',
      dose: 1,
      color: MED_COLORS[2],
      schedule: { ...defaultSchedule(['19:00']), type: 'daily_times' },
      stock: 3,
      lowStockDays: 3,
    },
  ];

  for (const med of demo) await insertMedication(med);
}
