import { addDays, startOfDay } from 'date-fns';
import { create } from 'zustand';
import type {
  Backup,
  DoseEvent,
  Medication,
  Profile,
  Settings,
} from '@/types';
import {
  adjustMedicationStock,
  deleteAllData,
  deleteEvent,
  deleteMedication as deleteMedicationRow,
  deleteProfile as deleteProfileRow,
  exportAllData,
  importAllData,
  insertMedication,
  insertProfile,
  loadEvents,
  loadMedications,
  loadProfiles,
  loadSettings,
  logStockChange,
  saveSettings,
  seedDemoData,
  setMedicationStock,
  setStockNotifiedDate,
  updateMedication,
  updateProfile,
  upsertEvent,
} from '@/db/repository';
import { makeId } from '@/lib/id';
import { dateKey } from '@/lib/date';
import {
  cancelAllNotifications,
  cancelDoseNotifications,
  cancelLowStockNotifications,
  notifyLowStock,
  rescheduleAllNotifications,
  scheduleSnooze,
} from '@/notifications/scheduler';
import {
  hasNotificationPermission,
  prepareNotifications,
} from '@/notifications/setup';
import { registerBackgroundRefresh } from '@/notifications/background';

const HISTORY_DAYS = 120;

export type MedicationInput = Pick<
  Medication,
  | 'name'
  | 'dosage'
  | 'form'
  | 'unit'
  | 'dose'
  | 'notes'
  | 'color'
  | 'schedule'
  | 'stock'
  | 'lowStockDays'
>;

type AppState = {
  ready: boolean;
  initializing: boolean;
  error: string | null;
  now: number;
  profiles: Profile[];
  activeProfile: Profile | null;
  meds: Medication[];
  events: DoseEvent[];
  settings: Settings;
  notificationPermission: boolean;

  init: () => Promise<void>;
  tick: () => void;
  refresh: () => Promise<void>;
  refreshPermission: () => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  addProfile: (name: string) => Promise<void>;
  renameProfile: (profileId: string, name: string) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
  saveMedication: (input: MedicationInput, existingId?: string) => Promise<string>;
  deleteMedication: (medicationId: string) => Promise<void>;
  takeDose: (medicationId: string, scheduledAt: string) => Promise<void>;
  skipDose: (medicationId: string, scheduledAt: string) => Promise<void>;
  undoDose: (medicationId: string, scheduledAt: string) => Promise<void>;
  snoozeDose: (medicationId: string, scheduledAt: string) => Promise<void>;
  replenish: (medicationId: string, amount: number) => Promise<void>;
  setStock: (medicationId: string, value: number) => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  seedDemo: () => Promise<void>;
  exportBackup: () => Promise<Backup>;
  importBackup: (data: unknown) => Promise<void>;
  resetAllData: () => Promise<void>;
};

async function loadSnapshot(profileId: string): Promise<{ meds: Medication[]; events: DoseEvent[] }> {
  const from = startOfDay(addDays(new Date(), -HISTORY_DAYS)).toISOString();
  const to = addDays(new Date(), 2).toISOString();
  const [meds, events] = await Promise.all([
    loadMedications(profileId),
    loadEvents(profileId, from, to),
  ]);
  return { meds, events };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Не удалось запустить приложение. Попробуйте перезапустить.';
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  initializing: false,
  error: null,
  now: Date.now(),
  profiles: [],
  activeProfile: null,
  meds: [],
  events: [],
  settings: {
    activeProfileId: 'default',
    snoozeMinutes: 15,
    repeatReminder: true,
    repeatMinutes: 15,
    soundEnabled: true,
    vibrationEnabled: true,
    notificationsEnabled: true,
  },
  notificationPermission: false,

  init: async () => {
    if (get().ready || get().initializing) return;
    set({ initializing: true, error: null });
    try {
      let profiles = await loadProfiles();
      const settings = await loadSettings();
      let active = profiles.find((profile) => profile.id === settings.activeProfileId);
      if (!active && profiles.length === 0) {
        const created = await insertProfile('Я');
        profiles = [created];
        active = created;
      }
      if (!active) active = profiles[0];
      if (settings.activeProfileId !== active.id) {
        settings.activeProfileId = active.id;
        await saveSettings(settings);
      }
      const { meds, events } = await loadSnapshot(active.id);
      const permission = await hasNotificationPermission();

      set({
        ready: true,
        initializing: false,
        profiles,
        activeProfile: active,
        settings,
        meds,
        events,
        notificationPermission: permission,
        now: Date.now(),
      });

      await prepareNotifications(settings).catch(() => undefined);
      await rescheduleAllNotifications(meds, settings).catch(() => undefined);
      await registerBackgroundRefresh();
    } catch (error) {
      set({ error: errorMessage(error), initializing: false, ready: false });
    }
  },

  tick: () => set({ now: Date.now() }),

  refresh: async () => {
    const active = get().activeProfile;
    if (!active) return;
    const [profiles, settings, snapshot] = await Promise.all([
      loadProfiles(),
      loadSettings(),
      loadSnapshot(active.id),
    ]);
    const current = profiles.find((profile) => profile.id === settings.activeProfileId) ?? active;
    set({
      profiles,
      settings,
      activeProfile: current,
      meds: snapshot.meds,
      events: snapshot.events,
      now: Date.now(),
    });
  },

  refreshPermission: async () => {
    set({ notificationPermission: await hasNotificationPermission() });
  },

  switchProfile: async (profileId) => {
    const profiles = await loadProfiles();
    const active = profiles.find((profile) => profile.id === profileId) ?? profiles[0];
    if (!active) return;
    const settings = { ...get().settings, activeProfileId: active.id };
    await saveSettings(settings);
    const { meds, events } = await loadSnapshot(active.id);
    set({ profiles, activeProfile: active, settings, meds, events, now: Date.now() });
    await rescheduleAllNotifications(meds, settings).catch(() => undefined);
  },

  addProfile: async (name) => {
    const profile = await insertProfile(name.trim() || 'Профиль');
    const settings = { ...get().settings, activeProfileId: profile.id };
    await saveSettings(settings);
    const profiles = await loadProfiles();
    const { meds, events } = await loadSnapshot(profile.id);
    set({ profiles, activeProfile: profile, settings, meds, events });
    await rescheduleAllNotifications(meds, settings).catch(() => undefined);
  },

  renameProfile: async (profileId, name) => {
    const profile = get().profiles.find((item) => item.id === profileId);
    if (!profile) return;
    const next = { ...profile, name: name.trim() || profile.name };
    await updateProfile(next);
    const profiles = await loadProfiles();
    set({
      profiles,
      activeProfile: get().activeProfile?.id === profileId ? next : get().activeProfile,
    });
  },

  removeProfile: async (profileId) => {
    const profiles = get().profiles;
    if (profiles.length <= 1) {
      throw new Error('Нельзя удалить единственный профиль.');
    }
    await deleteProfileRow(profileId);
    let nextProfiles = await loadProfiles();
    let settings = get().settings;
    if (settings.activeProfileId === profileId) {
      settings = { ...settings, activeProfileId: nextProfiles[0].id };
      await saveSettings(settings);
    }
    const active =
      nextProfiles.find((profile) => profile.id === settings.activeProfileId) ?? nextProfiles[0];
    const { meds, events } = await loadSnapshot(active.id);
    set({ profiles: nextProfiles, activeProfile: active, settings, meds, events });
    await rescheduleAllNotifications(meds, settings).catch(() => undefined);
  },

  saveMedication: async (input, existingId) => {
    const active = get().activeProfile;
    if (!active) throw new Error('Профиль не выбран.');
    const now = Date.now();
    if (existingId) {
      const existing = get().meds.find((med) => med.id === existingId);
      if (!existing) throw new Error('Лекарство не найдено.');
      const nextStock = Math.max(0, input.stock);
      const updated: Medication = {
        ...existing,
        ...input,
        stock: nextStock,
        stockNotifiedDate:
          nextStock > existing.stock ? null : existing.stockNotifiedDate,
        updatedAt: now,
      };
      await updateMedication(updated);
      await logStockChange(existing.id, nextStock - existing.stock, 'Ручная правка остатка');
      const snapshot = await loadSnapshot(active.id);
      set({ meds: snapshot.meds, events: snapshot.events });
      await rescheduleAllNotifications(snapshot.meds, get().settings).catch(() => undefined);
      return existing.id;
    }

    const med: Medication = {
      id: makeId('med'),
      profileId: active.id,
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      form: input.form,
      unit: input.unit,
      dose: input.dose,
      notes: input.notes.trim(),
      color: input.color,
      schedule: input.schedule,
      stock: Math.max(0, input.stock),
      lowStockDays: input.lowStockDays,
      stockNotifiedDate: null,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    await insertMedication(med);
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
    await rescheduleAllNotifications(snapshot.meds, get().settings).catch(() => undefined);
    return med.id;
  },

  deleteMedication: async (medicationId) => {
    await deleteMedicationRow(medicationId);
    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
    await rescheduleAllNotifications(snapshot.meds, get().settings).catch(() => undefined);
  },

  takeDose: async (medicationId, scheduledAt) => {
    const med = get().meds.find((item) => item.id === medicationId);
    if (!med) return;
    const already = get().events.find(
      (event) => event.medicationId === medicationId && event.scheduledAt === scheduledAt
    );
    if (already?.status === 'taken') return;

    const event: DoseEvent = {
      id: makeId('dose'),
      medicationId,
      profileId: med.profileId,
      scheduledAt,
      status: 'taken',
      takenAt: Date.now(),
      dose: med.dose,
    };
    await upsertEvent(event);
    await adjustMedicationStock(medicationId, -med.dose, 'Приём дозы', true);
    await cancelDoseNotifications(medicationId, scheduledAt);

    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });

    const notified = await notifyLowStock(snapshot.meds, get().settings).catch(
      (): string[] => []
    );
    if (notified.length > 0) {
      const today = dateKey(new Date());
      set({
        meds: get().meds.map((item) =>
          notified.includes(item.id) ? { ...item, stockNotifiedDate: today } : item
        ),
      });
    }
  },

  skipDose: async (medicationId, scheduledAt) => {
    const med = get().meds.find((item) => item.id === medicationId);
    if (!med) return;
    const existing = get().events.find(
      (event) => event.medicationId === medicationId && event.scheduledAt === scheduledAt
    );
    if (existing?.status === 'taken') {
      await adjustMedicationStock(medicationId, existing.dose, 'Изменение отметки приёма');
    }
    const event: DoseEvent = {
      id: makeId('dose'),
      medicationId,
      profileId: med.profileId,
      scheduledAt,
      status: 'skipped',
      takenAt: Date.now(),
      dose: med.dose,
    };
    await upsertEvent(event);
    await cancelDoseNotifications(medicationId, scheduledAt);
    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
  },

  undoDose: async (medicationId, scheduledAt) => {
    const event = get().events.find(
      (item) => item.medicationId === medicationId && item.scheduledAt === scheduledAt
    );
    if (!event) return;
    await deleteEvent(medicationId, scheduledAt);
    if (event.status === 'taken') {
      await adjustMedicationStock(medicationId, event.dose, 'Отмена приёма');
    }
    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
    await rescheduleAllNotifications(snapshot.meds, get().settings).catch(() => undefined);
  },

  snoozeDose: async (medicationId, scheduledAt) => {
    const med = get().meds.find((item) => item.id === medicationId);
    if (!med) return;
    await scheduleSnooze(med, scheduledAt, get().settings);
  },

  replenish: async (medicationId, amount) => {
    if (amount <= 0) return;
    await adjustMedicationStock(medicationId, amount, 'Пополнение запаса');
    await setStockNotifiedDate(medicationId, null);
    await cancelLowStockNotifications(medicationId);
    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
  },

  setStock: async (medicationId, value) => {
    await setMedicationStock(medicationId, Math.max(0, value), 'Ручная правка остатка');
    await setStockNotifiedDate(medicationId, null);
    await cancelLowStockNotifications(medicationId);
    const active = get().activeProfile;
    if (!active) return;
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
  },

  updateSettings: async (partial) => {
    const settings: Settings = { ...get().settings, ...partial };
    await saveSettings(settings);
    set({ settings });
    await prepareNotifications(settings).catch(() => undefined);
    await rescheduleAllNotifications(get().meds, settings).catch(() => undefined);
    set({ notificationPermission: await hasNotificationPermission() });
  },

  seedDemo: async () => {
    const active = get().activeProfile;
    if (!active) return;
    await seedDemoData(active.id);
    const snapshot = await loadSnapshot(active.id);
    set({ meds: snapshot.meds, events: snapshot.events });
    await rescheduleAllNotifications(snapshot.meds, get().settings).catch(() => undefined);
  },

  exportBackup: async () => exportAllData(),

  importBackup: async (data) => {
    await importAllData(data);
    await cancelAllNotifications();
    const profiles = await loadProfiles();
    const settings = await loadSettings();
    const active =
      profiles.find((profile) => profile.id === settings.activeProfileId) ?? profiles[0];
    const snapshot = await loadSnapshot(active.id);
    set({
      profiles,
      activeProfile: active,
      settings,
      meds: snapshot.meds,
      events: snapshot.events,
      now: Date.now(),
    });
    await rescheduleAllNotifications(snapshot.meds, settings).catch(() => undefined);
    set({ notificationPermission: await hasNotificationPermission() });
  },

  resetAllData: async () => {
    await cancelAllNotifications();
    await deleteAllData();
    const profiles = await loadProfiles();
    const settings = await loadSettings();
    const active = profiles[0];
    const snapshot = await loadSnapshot(active.id);
    set({
      profiles,
      activeProfile: active,
      settings,
      meds: snapshot.meds,
      events: snapshot.events,
      now: Date.now(),
    });
  },
}));
