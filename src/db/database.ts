import * as SQLite from 'expo-sqlite';
import { DEFAULT_SETTINGS } from '@/constants/schedule';

const DATABASE_NAME = 'tabletka.db';
const DATABASE_VERSION = 1;
export const DEFAULT_PROFILE_ID = 'default';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT NOT NULL DEFAULT '',
        form TEXT NOT NULL DEFAULT 'tablet',
        unit TEXT NOT NULL DEFAULT 'таб.',
        dose REAL NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#2358D8',
        schedule_json TEXT NOT NULL,
        stock REAL NOT NULL DEFAULT 0,
        low_stock_days INTEGER NOT NULL DEFAULT 3,
        stock_notified_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dose_events (
        id TEXT PRIMARY KEY NOT NULL,
        medication_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL,
        taken_at INTEGER NOT NULL,
        dose REAL NOT NULL,
        UNIQUE (medication_id, scheduled_at),
        FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stock_log (
        id TEXT PRIMARY KEY NOT NULL,
        medication_id TEXT NOT NULL,
        delta REAL NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notification_map (
        id TEXT PRIMARY KEY NOT NULL,
        medication_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        notification_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_medications_profile ON medications (profile_id);
      CREATE INDEX IF NOT EXISTS idx_events_profile_scheduled ON dose_events (profile_id, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_events_medication ON dose_events (medication_id, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_slot ON notification_map (medication_id, scheduled_at);
    `);
    version = 1;
  }

  if (version < DATABASE_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }

  const profileCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM profiles'
  );
  if ((profileCount?.count ?? 0) === 0) {
    await db.runAsync(
      'INSERT INTO profiles (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      DEFAULT_PROFILE_ID,
      'Я',
      '#2358D8',
      Date.now()
    );
  }

  const settingsCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM settings'
  );
  if ((settingsCount?.count ?? 0) === 0) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        key,
        JSON.stringify(value)
      );
    }
  }
}
