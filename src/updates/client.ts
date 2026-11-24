import * as Crypto from 'expo-crypto';
import {
  MANIFEST_FETCH_TIMEOUT_MS,
  MAX_MANIFEST_BYTES,
  UPDATE_CONFIG,
} from './config';
import { UpdateError } from './errors';
import { validateManifestPayload } from './manifest';
import type { UpdateManifest } from './types';
import { verifyToken } from './verify';

async function hashHex(message: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
}

function parseToken(body: string): string {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new UpdateError('invalid', 'Сервер обновлений вернул некорректный ответ.');
  }
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const token = (data as { token?: unknown }).token;
    if (typeof token === 'string') return token;
  }
  throw new UpdateError('invalid', 'В манифесте обновлений нет подписи.');
}

/** Fetches, verifies and validates the signed manifest. */
export async function fetchManifest(
  timeoutMs = MANIFEST_FETCH_TIMEOUT_MS
): Promise<UpdateManifest> {
  const manifestUrl = UPDATE_CONFIG.manifestUrl;
  if (!manifestUrl) {
    throw new UpdateError('invalid', 'Адрес сервера обновлений не настроен.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(manifestUrl, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) console.warn('update: fetch manifest failed', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UpdateError(
        'network',
        'Сервер обновлений не ответил вовремя. Проверьте интернет.'
      );
    }
    throw new UpdateError(
      'network',
      'Не удалось проверить обновления. Проверьте подключение к интернету.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new UpdateError(
      'network',
      `Сервер обновлений ответил ошибкой ${response.status}.`
    );
  }

  const announced = Number(response.headers.get('content-length') ?? 0);
  if (announced > MAX_MANIFEST_BYTES) {
    throw new UpdateError('invalid', 'Манифест обновления слишком большой.');
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new UpdateError('network', 'Не удалось прочитать ответ сервера обновлений.');
  }
  if (!body || body.length > MAX_MANIFEST_BYTES) {
    throw new UpdateError('invalid', 'Манифест обновления пустой или слишком большой.');
  }

  const token = parseToken(body);
  const payload = await verifyToken(token, UPDATE_CONFIG.publicKey, hashHex);
  if (!payload) {
    throw new UpdateError(
      'signature',
      'Подпись обновления неверна. Установка отменена.'
    );
  }

  return validateManifestPayload(payload, UPDATE_CONFIG, manifestUrl, {
    allowInsecure: __DEV__,
  });
}
