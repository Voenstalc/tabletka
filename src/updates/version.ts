export type VersionParts = [number, number, number];

/** Parses "0.2.1", tolerating suffixes like "0.2.1-beta". */
export function parseVersion(value: unknown): VersionParts | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: unknown, right: unknown): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function isNewerVersion(remote: unknown, current: unknown): boolean {
  return compareVersions(remote, current) > 0;
}

export type Versioned = {
  version: string;
  versionCode?: number | null;
};

/**
 * Android versionCode is authoritative when both sides have it; otherwise
 * fall back to semantic version (plotstory manifests carry no version_code).
 */
export function isNewer(remote: Versioned, current: Versioned): boolean {
  const remoteCode = Number(remote.versionCode);
  const currentCode = Number(current.versionCode);
  if (
    remote.versionCode !== undefined &&
    remote.versionCode !== null &&
    current.versionCode !== undefined &&
    current.versionCode !== null &&
    Number.isFinite(remoteCode) &&
    Number.isFinite(currentCode)
  ) {
    return remoteCode > currentCode;
  }
  return isNewerVersion(remote.version, current.version);
}
