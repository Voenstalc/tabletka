import { File, Paths } from 'expo-file-system';
import { UPDATE_STATE_FILE } from './config';

export type PersistedUpdateState = {
  lastCheck: number;
  downloadedVersion?: string;
  downloadedUri?: string;
};

const EMPTY: PersistedUpdateState = { lastCheck: 0 };

export function readPersistedState(): PersistedUpdateState {
  try {
    const file = new File(Paths.document, UPDATE_STATE_FILE);
    if (!file.exists) return { ...EMPTY };
    const parsed = JSON.parse(file.textSync()) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    const data = parsed as Record<string, unknown>;
    const lastCheck =
      typeof data.lastCheck === 'number' && Number.isFinite(data.lastCheck)
        ? data.lastCheck
        : 0;
    const downloadedVersion =
      typeof data.downloadedVersion === 'string' ? data.downloadedVersion : undefined;
    const downloadedUri =
      typeof data.downloadedUri === 'string' ? data.downloadedUri : undefined;
    return { lastCheck, downloadedVersion, downloadedUri };
  } catch {
    return { ...EMPTY };
  }
}

export function writePersistedState(value: PersistedUpdateState): void {
  try {
    const file = new File(Paths.document, UPDATE_STATE_FILE);
    if (!file.exists) file.create();
    file.writeSync(JSON.stringify(value));
  } catch {
    // Losing the throttle state is harmless: the next launch checks again.
  }
}
