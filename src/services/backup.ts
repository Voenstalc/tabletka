import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Backup } from '@/types';
import { dateKey } from '@/lib/date';

export async function shareBackup(backup: Backup): Promise<void> {
  const file = new File(Paths.cache, `tabletka-backup-${dateKey(new Date())}.json`);
  if (file.exists) file.delete();
  await file.write(JSON.stringify(backup, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('На этом устройстве нельзя открыть меню «Поделиться».');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Резервная копия «Таблетки»',
  });
}

export async function pickBackupFile(): Promise<unknown | null> {
  const result = await File.pickFileAsync({
    mimeTypes: ['*/*'],
  });
  if (result.canceled) return null;
  const text = await result.result.text();
  return JSON.parse(text);
}
