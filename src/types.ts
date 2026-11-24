export type Profile = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export type MedicationForm = 'tablet' | 'capsule' | 'drops' | 'other';

export type ScheduleType = 'daily_times' | 'weekdays' | 'every_n_hours' | 'course';

export type Schedule = {
  type: ScheduleType;
  /** Время приёмов в формате HH:mm. Для every_n_hours первое значение — время старта. */
  times: string[];
  /** Дни недели по ISO: 1 = Пн ... 7 = Вс. */
  weekdays: number[];
  intervalHours: number;
  /** YYYY-MM-DD. Для курса — начало, для every_n_hours — якорь отсчёта. */
  startDate: string;
  /** YYYY-MM-DD. Только для курса. */
  endDate: string | null;
};

export type Medication = {
  id: string;
  profileId: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  unit: string;
  /** Сколько единиц за один приём. */
  dose: number;
  notes: string;
  color: string;
  schedule: Schedule;
  stock: number;
  lowStockDays: number;
  /** Дата (YYYY-MM-DD), когда уже показывали предупреждение о низком остатке. */
  stockNotifiedDate: string | null;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
};

export type DoseEventStatus = 'taken' | 'skipped';

export type DoseEvent = {
  id: string;
  medicationId: string;
  profileId: string;
  /** ISO-строка момента, когда доза была запланирована. */
  scheduledAt: string;
  status: DoseEventStatus;
  takenAt: number;
  dose: number;
};

export type DoseStatus = 'planned' | 'taken' | 'skipped' | 'missed';

export type DoseItem = {
  key: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  unit: string;
  dose: number;
  color: string;
  scheduledAt: Date;
  status: DoseStatus;
  event: DoseEvent | null;
};

export type Settings = {
  activeProfileId: string;
  snoozeMinutes: number;
  repeatReminder: boolean;
  repeatMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
};

export type NotificationMapEntry = {
  id: string;
  medicationId: string;
  scheduledAt: string;
  kind: 'main' | 'repeat' | 'snooze' | 'low-stock';
  notificationId: string;
  createdAt: number;
};

export type Backup = {
  format: 'tabletka-backup';
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  medications: Medication[];
  events: DoseEvent[];
  settings: Settings;
};
