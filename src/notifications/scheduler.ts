import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, addMinutes } from 'date-fns';
import type { Medication, NotificationMapEntry, Settings } from '@/types';
import { MAX_SCHEDULED_NOTIFICATIONS, NOTIFICATION_WINDOW_DAYS } from '@/constants/schedule';
import { expandMedication } from '@/lib/schedule';
import { formatNumber, formatTime, dateKey } from '@/lib/date';
import { makeId } from '@/lib/id';
import {
  addNotificationEntries,
  clearNotificationMap,
  deleteNotificationEntries,
  loadNotificationMap,
  setStockNotifiedDate,
} from '@/db/repository';
import {
  CATEGORY_DOSE,
  channelIdFor,
  prepareNotifications,
} from '@/notifications/setup';
import { isLowStock } from '@/lib/stock';

type PlannedDose = { med: Medication; date: Date };

let lastRescheduleAt = 0;

export function shouldRescheduleNotifications(): boolean {
  return Date.now() - lastRescheduleAt > 12 * 60 * 60 * 1000;
}

function dateTrigger(date: Date, channelId: string): Notifications.DateTriggerInput {
  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
  };
  if (Platform.OS === 'android') trigger.channelId = channelId;
  return trigger;
}

function doseContent(
  med: Medication,
  scheduledAt: Date,
  settings: Settings,
  repeat = false
): Notifications.NotificationContentInput {
  const doseLabel = `${formatNumber(med.dose)} ${med.unit}`;
  return {
    title: repeat ? `Напоминание: ${med.name}` : `Пора принять ${med.name}`,
    body: `${doseLabel}${med.dosage ? ` · ${med.dosage}` : ''} — ${formatTime(scheduledAt)}`,
    sound: settings.soundEnabled ? 'default' : false,
    categoryIdentifier: CATEGORY_DOSE,
    color: med.color,
    priority: Notifications.AndroidNotificationPriority.HIGH,
    vibrate: settings.vibrationEnabled ? [0, 300, 200, 300] : [],
    data: {
      type: 'dose',
      medicationId: med.id,
      scheduledAt: scheduledAt.toISOString(),
      repeat,
    },
  };
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore native errors when notifications are unavailable
  }
  await clearNotificationMap();
}

export async function cancelDoseNotifications(
  medicationId: string,
  scheduledAt: string
): Promise<void> {
  const map = await loadNotificationMap();
  const entries = map.filter(
    (entry) =>
      entry.medicationId === medicationId &&
      entry.scheduledAt === scheduledAt &&
      entry.kind !== 'low-stock'
  );
  await Promise.all(
    entries.map((entry) =>
      Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch(() => undefined)
    )
  );
  await deleteNotificationEntries(entries.map((entry) => entry.id));
}

export async function cancelLowStockNotifications(medicationId: string): Promise<void> {
  const map = await loadNotificationMap();
  const entries = map.filter(
    (entry) => entry.medicationId === medicationId && entry.kind === 'low-stock'
  );
  await Promise.all(
    entries.map((entry) =>
      Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch(() => undefined)
    )
  );
  await deleteNotificationEntries(entries.map((entry) => entry.id));
}

/**
 * Пересоздаёт все запланированные уведомления на 30 дней вперёд.
 * Вызывается при запуске приложения, изменении лекарств/настроек и в фоне.
 */
export async function rescheduleAllNotifications(
  meds: Medication[],
  settings: Settings,
  now: number = Date.now()
): Promise<void> {
  await cancelAllNotifications();
  lastRescheduleAt = Date.now();
  if (!settings.notificationsEnabled) return;

  try {
    await prepareNotifications(settings);
  } catch {
    // notifications can be unavailable in some builds/platforms
  }

  const from = new Date(now + 1500);
  const to = addDays(new Date(now), NOTIFICATION_WINDOW_DAYS);
  const planned: PlannedDose[] = [];
  for (const med of meds) {
    for (const date of expandMedication(med, from, to)) {
      planned.push({ med, date });
    }
  }
  planned.sort((a, b) => a.date.getTime() - b.date.getTime());

  const repeatCutoff = addDays(new Date(now), 3).getTime();
  const entries: NotificationMapEntry[] = [];
  let budget = MAX_SCHEDULED_NOTIFICATIONS;

  for (const { med, date } of planned) {
    if (budget <= 0) break;
    if (date.getTime() <= now) continue;

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: doseContent(med, date, settings),
        trigger: dateTrigger(date, channelIdFor(settings)),
      });
      entries.push({
        id: makeId('notif'),
        medicationId: med.id,
        scheduledAt: date.toISOString(),
        kind: 'main',
        notificationId,
        createdAt: Date.now(),
      });
      budget -= 1;
    } catch {
      continue;
    }

    if (settings.repeatReminder && date.getTime() <= repeatCutoff && budget > 0) {
      const repeatDate = addMinutes(date, settings.repeatMinutes);
      try {
        const repeatId = await Notifications.scheduleNotificationAsync({
          content: doseContent(med, date, settings, true),
          trigger: dateTrigger(repeatDate, channelIdFor(settings)),
        });
        entries.push({
          id: makeId('notif'),
          medicationId: med.id,
          scheduledAt: date.toISOString(),
          kind: 'repeat',
          notificationId: repeatId,
          createdAt: Date.now(),
        });
        budget -= 1;
      } catch {
        // ignore single notification failures
      }
    }
  }

  await addNotificationEntries(entries);
  lastRescheduleAt = Date.now();
}

export async function scheduleSnooze(
  med: Medication,
  scheduledAt: string,
  settings: Settings
): Promise<void> {
  await cancelDoseNotifications(med.id, scheduledAt);
  if (!settings.notificationsEnabled) return;
  const fireDate = new Date(Date.now() + Math.max(1, settings.snoozeMinutes) * 60 * 1000);
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        ...doseContent(med, fireDate, settings),
        title: `Отложено: ${med.name}`,
      },
      trigger: dateTrigger(fireDate, channelIdFor(settings)),
    });
    await addNotificationEntries([
      {
        id: makeId('notif'),
        medicationId: med.id,
        scheduledAt,
        kind: 'snooze',
        notificationId,
        createdAt: Date.now(),
      },
    ]);
  } catch {
    // ignore
  }
}

/**
 * Показывает предупреждения о низком остатке не чаще одного раза в день
 * для каждого лекарства. Возвращает id лекарств, по которым показали уведомление.
 */
export async function notifyLowStock(
  meds: Medication[],
  settings: Settings,
  now: number = Date.now()
): Promise<string[]> {
  if (!settings.notificationsEnabled) return [];
  const today = dateKey(new Date(now));
  const notified: string[] = [];
  for (const med of meds) {
    if (!isLowStock(med, now)) continue;
    if (med.stockNotifiedDate === today) continue;
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title:
            med.stock <= 0 ? 'Таблетки закончились' : 'Заканчиваются таблетки',
          body: `${med.name}: осталось ${formatNumber(Math.max(0, med.stock))} ${med.unit}. Пора пополнить запас.`,
          sound: settings.soundEnabled ? 'default' : false,
          color: med.color,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type: 'low-stock', medicationId: med.id },
        },
        trigger: dateTrigger(new Date(now + 1000), channelIdFor(settings)),
      });
      await addNotificationEntries([
        {
          id: makeId('notif'),
          medicationId: med.id,
          scheduledAt: new Date(now).toISOString(),
          kind: 'low-stock',
          notificationId,
          createdAt: now,
        },
      ]);
      await setStockNotifiedDate(med.id, today);
      notified.push(med.id);
    } catch {
      // ignore
    }
  }
  return notified;
}

export async function scheduleTestNotification(settings: Settings): Promise<void> {
  await prepareNotifications(settings);
  const fireDate = new Date(Date.now() + 5000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Таблетка на связи',
      body: 'Это тестовое напоминание. Всё работает.',
      sound: settings.soundEnabled ? 'default' : false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'test' },
    },
    trigger: dateTrigger(fireDate, channelIdFor(settings)),
  });
}