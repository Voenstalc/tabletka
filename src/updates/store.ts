import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { fetchManifest } from './client';
import { UPDATE_CHECK_INTERVAL_MS } from './config';
import { cleanupDownloads, downloadApk } from './download';
import { UpdateError } from './errors';
import { installApk, openInstallSettings } from './install';
import { readPersistedState, writePersistedState } from './state';
import type { UpdateManifest, UpdateStatus } from './types';
import { isNewer, isNewerVersion } from './version';

type CheckOptions = {
  silent?: boolean;
};

type UpdateState = {
  status: UpdateStatus;
  checking: boolean;
  manifest: UpdateManifest | null;
  progress: number;
  error: string | null;
  lastCheck: number;
  downloadedVersion: string | null;
  downloadedUri: string | null;
  currentVersion: string;
  currentVersionCode: number | null;

  start: () => Promise<void>;
  check: (options?: CheckOptions) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  installAgain: () => Promise<void>;
  openInstallSettings: () => Promise<void>;
  clearError: () => void;
};

function currentVersion(): string {
  return Application.nativeApplicationVersion ?? '0.0.0';
}

function currentVersionCode(): number | null {
  const value = Number(Application.nativeBuildVersion);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function isSupported(): boolean {
  return (
    Platform.OS === 'android' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

function userMessage(error: unknown): string {
  if (error instanceof UpdateError) return error.message;
  if (__DEV__ && error instanceof Error) return error.message;
  return 'Не удалось выполнить обновление. Попробуйте ещё раз.';
}

function persist(lastCheck: number, downloadedVersion?: string | null, downloadedUri?: string | null): void {
  writePersistedState({
    lastCheck,
    downloadedVersion: downloadedVersion ?? undefined,
    downloadedUri: downloadedUri ?? undefined,
  });
}

let started = false;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: Platform.OS === 'android' ? 'idle' : 'unsupported',
  checking: false,
  manifest: null,
  progress: 0,
  error: null,
  lastCheck: 0,
  downloadedVersion: null,
  downloadedUri: null,
  currentVersion: currentVersion(),
  currentVersionCode: currentVersionCode(),

  start: async () => {
    if (started) return;
    started = true;

    const version = currentVersion();
    const versionCode = currentVersionCode();
    if (!isSupported()) {
      set({ status: 'unsupported', currentVersion: version, currentVersionCode: versionCode });
      return;
    }

    const persisted = readPersistedState();
    set({
      currentVersion: version,
      currentVersionCode: versionCode,
      lastCheck: persisted.lastCheck,
      downloadedVersion: persisted.downloadedVersion ?? null,
      downloadedUri: persisted.downloadedUri ?? null,
    });
    cleanupDownloads(version, persisted.downloadedUri);

    if (persisted.downloadedUri && persisted.downloadedVersion) {
      const file = new File(persisted.downloadedUri);
      if (file.exists && isNewerVersion(persisted.downloadedVersion, version)) {
        set({ status: 'ready' });
      } else {
        try {
          if (file.exists) file.delete();
        } catch {
          // A stale file is not fatal; cleanup will retry next launch.
        }
        persist(persisted.lastCheck, null, null);
        set({ downloadedVersion: null, downloadedUri: null });
      }
    }

    if (Date.now() - persisted.lastCheck > UPDATE_CHECK_INTERVAL_MS) {
      void get().check({ silent: true });
    }
  },

  check: async (options = {}) => {
    const silent = Boolean(options.silent);
    const state = get();
    if (
      state.checking ||
      state.status === 'downloading' ||
      state.status === 'installing'
    ) {
      return;
    }
    if (
      silent &&
      state.lastCheck > 0 &&
      Date.now() - state.lastCheck < UPDATE_CHECK_INTERVAL_MS
    ) {
      return;
    }
    if (!isSupported()) {
      set({ status: 'unsupported' });
      return;
    }

    set({ checking: true, error: null });
    if (!silent) set({ status: 'checking' });

    try {
      const manifest = await fetchManifest();
      const version = currentVersion();
      const versionCode = currentVersionCode();
      const now = Date.now();
      const newer = isNewer(manifest, { version, versionCode });
      const downloadedVersion = get().downloadedVersion;
      const downloadedReady =
        newer &&
        Boolean(downloadedVersion) &&
        !isNewerVersion(manifest.version, downloadedVersion) &&
        isNewerVersion(downloadedVersion, version);

      set({
        checking: false,
        manifest: newer ? manifest : null,
        status: newer ? (downloadedReady ? 'ready' : 'available') : 'current',
        progress: downloadedReady ? 1 : 0,
        lastCheck: now,
        currentVersion: version,
        currentVersionCode: versionCode,
      });
      persist(now, get().downloadedVersion, get().downloadedUri);
    } catch (error) {
      if (__DEV__ && silent) console.warn('update: silent check failed', error);
      const now = Date.now();
      const previous = get();
      const keepStatus =
        silent && (previous.status === 'available' || previous.status === 'ready');
      set({
        checking: false,
        error: userMessage(error),
        status: keepStatus ? previous.status : 'error',
        lastCheck: now,
      });
      persist(now, previous.downloadedVersion, previous.downloadedUri);
    }
  },

  downloadAndInstall: async () => {
    const state = get();
    if (state.status === 'downloading' || state.status === 'installing') return;

    let manifest = state.manifest;
    if (!manifest) {
      await get().check();
      manifest = get().manifest;
    }
    if (!manifest) return;

    set({ status: 'downloading', progress: 0, error: null });

    try {
      const file = await downloadApk(manifest, (value) => {
        const rounded = Math.round(value * 1000) / 1000;
        if (rounded !== get().progress) set({ progress: rounded });
      });

      set({
        status: 'ready',
        progress: 1,
        downloadedVersion: manifest.version,
        downloadedUri: file.uri,
      });
      persist(get().lastCheck, manifest.version, file.uri);

      set({ status: 'installing' });
      await installApk(file);
      // The installer returned: either the user cancelled or the update was
      // installed and this process is about to be replaced.
      set({ status: 'ready' });
    } catch (error) {
      const downloaded = Boolean(get().downloadedUri);
      if (__DEV__) console.warn('update: download/install failed', error);
      set({
        status: downloaded ? 'ready' : 'error',
        error: userMessage(error),
        progress: downloaded ? 1 : 0,
      });
    }
  },

  installAgain: async () => {
    if (get().status === 'installing' || get().status === 'downloading') return;
    const uri = get().downloadedUri;
    if (!uri) {
      await get().downloadAndInstall();
      return;
    }

    const file = new File(uri);
    if (!file.exists) {
      set({ downloadedUri: null, downloadedVersion: null });
      persist(get().lastCheck, null, null);
      await get().downloadAndInstall();
      return;
    }

    set({ status: 'installing', error: null });
    try {
      await installApk(file);
      set({ status: 'ready' });
    } catch (error) {
      set({ status: 'ready', error: userMessage(error) });
    }
  },

  openInstallSettings: async () => {
    try {
      await openInstallSettings();
    } catch (error) {
      set({ error: userMessage(error) });
    }
  },

  clearError: () => set({ error: null }),
}));
