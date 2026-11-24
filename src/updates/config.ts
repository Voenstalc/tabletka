import type { UpdateConfig } from './types';

// The update showcase lives on the project VPS; GitHub holds only source code.
const PRODUCTION_MANIFEST =
  'https://48.102.177.243:8443/updates/tabletka/android/version.json';

// Only for local end-to-end tests. A shipped build must always use the
// production URL, so the override is ignored outside __DEV__.
const devOverride = __DEV__ ? process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL : '';

export const UPDATE_CONFIG: UpdateConfig = {
  app: 'tabletka',
  package: 'ru.tabletka.app',
  manifestUrl: (devOverride || PRODUCTION_MANIFEST).trim(),
  publicKey: {
    n: '0xc1dba35fe0acf6ec77da5ff1767a8275c0f93165afe410b8a65684472f73a85912018f5829b54c8cabdb28d7397b95094c8957bc874f8d6ba217edc7f8f9d0b693bb1ff6ad7b82fe2c6fa9ff24f2f30ee6276bee6c23771328d79313c2d966884f39ea9e04812f439b723e5763d851b5c5ee5ceda7aba41d7664c2522203682c4fae7b0a7da7178dcb079245fd852b0d8e47f85623dece4e4f612df9e4bea06e8d4b5bc430a8e47291487e7773576566e332f876b379022ce478688affb7be8191011c231f616ae24a58c6dd043e42f1d133437ba741c84f6005dd1078640634ad050c799818edad4a7fee749b18682c5ddc9c8ce4cd6fa68963de4eea19555b',
    e: 65537,
  },
};

/** Background checks are silent and run at most once per day. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const UPDATES_DIR_NAME = 'updates';
export const UPDATE_STATE_FILE = 'update-state.json';
export const MANIFEST_FETCH_TIMEOUT_MS = 15_000;
export const MAX_MANIFEST_BYTES = 1024 * 1024;
