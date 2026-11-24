import {
  AndroidImportance,
  AndroidNotificationPriority,
  AndroidNotificationVisibility,
  IosAuthorizationStatus,
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/constants/schedule';

export const CATEGORY_DOSE = 'dose';
export const ACTION_TAKE = 'TAKE_DOSE';
export const ACTION_SNOOZE = 'SNOOZE_DOSE';
export const ACTION_SKIP = 'SKIP_DOSE';

export const CHANNELS = {
  soundVibrate: 'doses-sound-vib',
  sound: 'doses-sound',
  vibrate: 'doses-vib',
  silent: 'doses-silent',
} as const;

export function channelIdFor(settings: Settings): string {
  if (settings.soundEnabled && settings.vibrationEnabled) return CHANNELS.soundVibrate;
  if (settings.soundEnabled) return CHANNELS.sound;
  if (settings.vibrationEnabled) return CHANNELS.vibrate;
  return CHANNELS.silent;
}

export function configureNotificationHandler(
  getSettings: () => Pick<Settings, 'soundEnabled'> = () => DEFAULT_SETTINGS
): void {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: getSettings().soundEnabled,
      shouldSetBadge: false,
      priority: AndroidNotificationPriority.HIGH,
    }),
  });
}

let channelsReady = false;

export async function setupNotificationChannels(settings: Settings = DEFAULT_SETTINGS): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (channelsReady) return;

  const configurations = [
    { id: CHANNELS.soundVibrate, name: 'Напоминания со звуком и вибрацией', sound: true, vibrate: true },
    { id: CHANNELS.sound, name: 'Напоминания со звуком', sound: true, vibrate: false },
    { id: CHANNELS.vibrate, name: 'Напоминания с вибрацией', sound: false, vibrate: true },
    { id: CHANNELS.silent, name: 'Тихие напоминания', sound: false, vibrate: false },
  ];

  for (const config of configurations) {
    await setNotificationChannelAsync(config.id, {
      name: config.name,
      importance: AndroidImportance.MAX,
      sound: config.sound ? 'default' : null,
      enableVibrate: config.vibrate,
      vibrationPattern: config.vibrate ? [0, 300, 200, 300] : undefined,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  }

  channelsReady = true;
}

let categoriesReady = false;

export async function setupNotificationCategories(): Promise<void> {
  if (categoriesReady) return;
  await setNotificationCategoryAsync(CATEGORY_DOSE, [
    {
      identifier: ACTION_TAKE,
      buttonTitle: 'Принял',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Отложить',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SKIP,
      buttonTitle: 'Пропустить',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
  categoriesReady = true;
}

export async function prepareNotifications(settings: Settings): Promise<void> {
  await setupNotificationChannels(settings);
  await setupNotificationCategories();
}

export async function hasNotificationPermission(): Promise<boolean> {
  const status = await getPermissionsAsync();
  return (
    status.granted ||
    status.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    status.ios?.status === IosAuthorizationStatus.EPHEMERAL
  );
}

export async function requestNotificationPermission(settings: Settings): Promise<boolean> {
  await prepareNotifications(settings);
  const current = await getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
    current.ios?.status === IosAuthorizationStatus.EPHEMERAL
  ) {
    return true;
  }
  const requested = await requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return Boolean(
    requested.granted ||
      requested.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
      requested.ios?.status === IosAuthorizationStatus.EPHEMERAL
  );
}

export async function hasExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const status = await getExactAlarmPermissionsAsync();
  return status.granted;
}

export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const status = await requestExactAlarmPermissionsAsync();
    return status.granted;
  } catch {
    return false;
  }
}

