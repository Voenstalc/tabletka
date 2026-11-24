import { Directory, File, Paths } from 'expo-file-system';
import { UPDATE_CONFIG, UPDATES_DIR_NAME } from './config';
import { UpdateError } from './errors';
import type { DownloadProgressCallback, UpdateManifest } from './types';
import { isNewerVersion } from './version';

const RESERVE_BYTES = 10 * 1024 * 1024;
const APK_EXTENSION = '.apk';
const PART_SUFFIX = '.part';

export function updatesDirectory(): Directory {
  return new Directory(Paths.document, UPDATES_DIR_NAME);
}

export function ensureUpdatesDirectory(): Directory {
  const directory = updatesDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export function apkFileName(app: string, version: string): string {
  const safeVersion = version.replace(/[^0-9A-Za-z._-]+/g, '_');
  return `${app}-${safeVersion}${APK_EXTENSION}`;
}

function safeDelete(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // A locked/corrupt file is not worth failing the update over.
  }
}

async function matches(file: File, manifest: UpdateManifest): Promise<boolean> {
  try {
    if (!file.exists || file.size !== manifest.size) return false;
    const digest = (await file.digest('SHA-256')).toLowerCase();
    return digest === manifest.sha256;
  } catch {
    return false;
  }
}

/**
 * Downloads the APK into the app's files dir, checks size and SHA-256, and
 * only then moves it into its final name. The `.part` file is always removed
 * on failure; the server does not support Range, so a retry starts over.
 */
export async function downloadApk(
  manifest: UpdateManifest,
  onProgress?: DownloadProgressCallback
): Promise<File> {
  const directory = ensureUpdatesDirectory();
  const target = new File(directory, apkFileName(manifest.app, manifest.version));

  if (target.exists) {
    if (await matches(target, manifest)) return target;
    safeDelete(target);
  }

  const available = Paths.availableDiskSpace;
  if (available > 0 && available < manifest.size + RESERVE_BYTES) {
    throw new UpdateError(
      'storage',
      'Недостаточно свободного места для обновления. Освободите память и повторите.'
    );
  }

  const temp = new File(directory, `${target.name}${PART_SUFFIX}`);
  safeDelete(temp);

  try {
    const task = File.createDownloadTask(manifest.url, temp, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : manifest.size;
        if (total > 0 && onProgress) {
          onProgress(Math.max(0, Math.min(1, bytesWritten / total)));
        }
      },
    });
    const downloaded = await task.downloadAsync();
    const file = downloaded ?? temp;
    if (!file.exists) {
      throw new UpdateError('download', 'Скачанный файл обновления не найден.');
    }
    if (file.size !== manifest.size) {
      throw new UpdateError(
        'hash',
        'Размер скачанного обновления не совпал. Файл удалён, попробуйте ещё раз.'
      );
    }
    const digest = (await file.digest('SHA-256')).toLowerCase();
    if (digest !== manifest.sha256) {
      throw new UpdateError(
        'hash',
        'Контрольная сумма обновления не совпала. Файл удалён, попробуйте ещё раз.'
      );
    }

    safeDelete(target);
    await file.move(target);
    return target;
  } catch (error) {
    safeDelete(temp);
    if (error instanceof UpdateError) throw error;
    if (__DEV__) console.warn('update: download failed', error);
    throw new UpdateError(
      'download',
      'Не удалось скачать обновление. Проверьте интернет и свободное место.'
    );
  }
}

/**
 * Removes `.part` files and APKs that are not newer than the installed
 * version. `keepUri` is the ready-to-install APK, which must survive.
 */
export function cleanupDownloads(currentVersion: string, keepUri?: string): void {
  const directory = updatesDirectory();
  if (!directory.exists) return;

  let entries: (File | Directory)[];
  try {
    entries = directory.list();
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (entry.name.endsWith(PART_SUFFIX)) {
      safeDelete(entry);
      continue;
    }
    if (!entry.name.startsWith(`${UPDATE_CONFIG.app}-`)) continue;
    if (!entry.name.endsWith(APK_EXTENSION)) continue;
    if (keepUri && entry.uri === keepUri) continue;

    const version = entry.name.slice(
      `${UPDATE_CONFIG.app}-`.length,
      -APK_EXTENSION.length
    );
    if (!isNewerVersion(version, currentVersion)) safeDelete(entry);
  }
}
