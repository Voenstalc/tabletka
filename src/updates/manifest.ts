import { UpdateError } from './errors';
import type { UpdateConfig, UpdateManifest } from './types';
import { parseVersion } from './version';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type ValidateOptions = {
  /** Local dev servers are http; shipped builds only accept https. */
  allowInsecure?: boolean;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/**
 * Resolves a manifest URL without relying on the partial URL implementation
 * of React Native.
 */
export function resolveManifestUrl(base: string, value: string): string {
  const raw = value.trim();
  if (!raw) throw new UpdateError('invalid', 'В манифесте нет ссылки на файл.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;

  const origin = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)/i.exec(base)?.[1];
  if (!origin) {
    throw new UpdateError('invalid', 'Некорректный адрес сервера обновлений.');
  }
  if (raw.startsWith('//')) {
    const protocol = /^([a-z][a-z0-9+.-]*:)/i.exec(base)?.[1] ?? 'https:';
    return protocol + raw;
  }
  if (raw.startsWith('/')) return origin + raw;

  const slash = base.lastIndexOf('/');
  if (slash < 0) {
    throw new UpdateError('invalid', 'Некорректный адрес сервера обновлений.');
  }
  return base.slice(0, slash + 1) + raw;
}

/**
 * Validates the signed payload. Never trust a field the publisher did not
 * sign: this function is the single gate between "signed JSON" and an APK.
 */
export function validateManifestPayload(
  payload: Record<string, unknown>,
  config: UpdateConfig,
  manifestUrl: string,
  options: ValidateOptions = {}
): UpdateManifest {
  const app = text(payload.app);
  if (app !== config.app) {
    throw new UpdateError('app', 'Манифест обновления для другого приложения.');
  }

  const platform = text(payload.platform);
  if (platform !== 'android') {
    throw new UpdateError('platform', 'Манифест обновления для другой платформы.');
  }

  const channel = text(payload.channel).toLowerCase();
  if (channel !== 'stable') {
    throw new UpdateError(
      'channel',
      'Обновление отклонено: это не стабильная сборка.'
    );
  }

  const pkg = text(payload.package);
  if (pkg && pkg !== config.package) {
    throw new UpdateError('package', 'Манифест обновления для другого пакета.');
  }

  const version = text(payload.version);
  if (!parseVersion(version)) {
    throw new UpdateError('version', 'В манифесте обновления некорректная версия.');
  }

  let versionCode: number | undefined;
  if (payload.version_code !== undefined && payload.version_code !== null) {
    const code = integer(payload.version_code);
    if (code === null || code < 0) {
      throw new UpdateError('version', 'В манифесте обновления некорректный version_code.');
    }
    versionCode = code;
  }

  const rawUrl = text(payload.url);
  const url = resolveManifestUrl(manifestUrl, rawUrl);
  const secure = /^https:\/\//i.test(url);
  const insecure = /^http:\/\//i.test(url);
  if (!secure && !(options.allowInsecure && insecure)) {
    throw new UpdateError('invalid', 'Ссылка на обновление должна быть HTTPS.');
  }

  const size = integer(payload.size);
  if (size === null || size <= 0) {
    throw new UpdateError('invalid', 'В манифесте обновления некорректный размер.');
  }

  const sha256 = text(payload.sha256).toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) {
    throw new UpdateError('invalid', 'В манифесте обновления некорректный SHA-256.');
  }

  const notes = payload.notes === undefined ? '' : text(payload.notes);
  const published = integer(payload.published) ?? 0;

  return {
    app,
    platform: 'android',
    channel: 'stable',
    version,
    ...(versionCode === undefined ? {} : { versionCode }),
    ...(pkg ? { package: pkg } : {}),
    url,
    size,
    sha256,
    notes,
    published,
  };
}
