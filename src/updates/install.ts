import { File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { UPDATE_CONFIG } from './config';
import { UpdateError } from './errors';

const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Hands the downloaded APK to the system installer.
 *
 * expo-file-system already provides a FileProvider and `contentUri`, so this
 * mirrors plotstory's InstallApkActivity: ACTION_VIEW, APK MIME type, and a
 * read grant. Without the MIME type Android opens a chooser instead of the
 * installer.
 */
export async function installApk(file: File): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new UpdateError('unsupported', 'Установка обновлений доступна только на Android.');
  }
  if (!file.exists) {
    throw new UpdateError('install', 'Скачанный файл обновления не найден.');
  }

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch (error) {
    if (__DEV__) console.warn('update: installer failed', error);
    throw new UpdateError(
      'install',
      'Не удалось открыть установщик. Разрешите установку из этого приложения в настройках Android.'
    );
  }
}

/** Opens the per-app "install unknown apps" screen. */
export async function openInstallSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new UpdateError('unsupported', 'Настройки установки доступны только на Android.');
  }
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
      { data: `package:${UPDATE_CONFIG.package}` }
    );
  } catch (error) {
    if (__DEV__) console.warn('update: open install settings failed', error);
    throw new UpdateError(
      'install',
      'Не удалось открыть настройки установки. Найдите разрешение в настройках Android вручную.'
    );
  }
}
