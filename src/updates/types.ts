export type UpdateKey = {
  /** RSA modulus as a hex string (0x...). */
  n: string;
  /** RSA public exponent. */
  e: number;
};

export type UpdateConfig = {
  /** Application id inside the signed manifest. */
  app: string;
  /** Android package name. */
  package: string;
  /** Stable URL of version.json. */
  manifestUrl: string;
  /** Public key that signs update manifests for this app. */
  publicKey: UpdateKey;
};

export type UpdateManifest = {
  app: string;
  platform: 'android';
  channel: 'stable';
  version: string;
  versionCode?: number;
  package?: string;
  url: string;
  size: number;
  sha256: string;
  notes: string;
  published: number;
};

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'
  | 'unsupported';

export type DownloadProgressCallback = (value: number) => void;
