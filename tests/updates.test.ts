import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { UpdateError } from '../src/updates/errors';
import {
  resolveManifestUrl,
  validateManifestPayload,
} from '../src/updates/manifest';
import type { UpdateConfig, UpdateKey } from '../src/updates/types';
import { compareVersions, isNewer, isNewerVersion } from '../src/updates/version';
import { verifyToken } from '../src/updates/verify';

function keyFromJwk(jwk: JsonWebKey): UpdateKey {
  if (!jwk.n || !jwk.e) throw new Error('JWK without RSA parameters');
  return {
    n: `0x${Buffer.from(jwk.n, 'base64url').toString('hex')}`,
    e: Number(BigInt(`0x${Buffer.from(jwk.e, 'base64url').toString('hex')}`)),
  };
}

const first = generateKeyPairSync('rsa', { modulusLength: 2048 });
const second = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = keyFromJwk(first.publicKey.export({ format: 'jwk' }));
const otherKey = keyFromJwk(second.publicKey.export({ format: 'jwk' }));

const hashHex = async (message: string) =>
  createHash('sha256').update(message, 'utf8').digest('hex');

function tokenFor(
  payload: Record<string, unknown>,
  privateKey: typeof first.privateKey
): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signed = `v1.${body}`;
  const signature = sign('sha256', Buffer.from(signed, 'ascii'), privateKey).toString(
    'base64url'
  );
  return `${signed}.${signature}`;
}

const payload: Record<string, unknown> = {
  app: 'tabletka',
  platform: 'android',
  channel: 'stable',
  version: '0.2.1',
  version_code: 3,
  package: 'ru.tabletka.app',
  url: 'tabletka-0.2.1.apk',
  size: 123456,
  sha256: 'a'.repeat(64),
  notes: 'Что нового: исправления и обновление интерфейса.',
  published: 1760000000,
};

const config: UpdateConfig = {
  app: 'tabletka',
  package: 'ru.tabletka.app',
  manifestUrl: 'https://example.test/updates/tabletka/android/version.json',
  publicKey: key,
};

test('подписанный манифест проходит проверку RSA и UTF-8', async () => {
  const verified = await verifyToken(tokenFor(payload, first.privateKey), key, hashHex);
  assert.deepEqual(verified, payload);
});

test('подделанный payload отвергается', async () => {
  const token = tokenFor(payload, first.privateKey);
  const [version, , signature] = token.split('.');
  const fakeBody = Buffer.from(
    JSON.stringify({ ...payload, version: '9.9.9' }),
    'utf8'
  ).toString('base64url');
  assert.equal(await verifyToken(`${version}.${fakeBody}.${signature}`, key, hashHex), null);
});

test('подделанная подпись отвергается', async () => {
  const token = tokenFor(payload, first.privateKey);
  const [version, body, signature] = token.split('.');
  const broken = `${signature.slice(0, -4)}AAAA`;
  assert.equal(await verifyToken(`${version}.${body}.${broken}`, key, hashHex), null);
});

test('чужой ключ отвергается', async () => {
  const token = tokenFor(payload, first.privateKey);
  assert.equal(await verifyToken(token, otherKey, hashHex), null);
});

test('битый токен отвергается', async () => {
  assert.equal(await verifyToken('v1.only-two-parts', key, hashHex), null);
  assert.equal(await verifyToken('', key, hashHex), null);
  assert.equal(await verifyToken('v2.aaaa.bbbb', key, hashHex), null);
});

test('манифест валиден и относительная ссылка разрешается', () => {
  const manifest = validateManifestPayload(payload, config, config.manifestUrl);
  assert.equal(manifest.app, 'tabletka');
  assert.equal(manifest.versionCode, 3);
  assert.equal(
    manifest.url,
    'https://example.test/updates/tabletka/android/tabletka-0.2.1.apk'
  );
  assert.equal(manifest.sha256, 'a'.repeat(64));
});

test('манифест другого приложения, платформы или канала отвергается', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...payload, app: 'plotstory' }, 'app'],
    [{ ...payload, platform: 'desktop' }, 'platform'],
    [{ ...payload, channel: 'dev' }, 'channel'],
    [{ ...payload, package: 'org.plotstory.plotstory' }, 'package'],
    [{ ...payload, version: 'latest' }, 'version'],
    [{ ...payload, size: 0 }, 'invalid'],
    [{ ...payload, sha256: 'not-a-hash' }, 'invalid'],
    [{ ...payload, url: 'http://example.test/app.apk' }, 'invalid'],
  ];
  for (const [value, code] of cases) {
    assert.throws(
      () => validateManifestPayload(value, config, config.manifestUrl),
      (error) => error instanceof UpdateError && error.code === code
    );
  }
});

test('http разрешён только в dev-режиме', () => {
  const insecure = { ...payload, url: 'http://127.0.0.1:8099/app.apk' };
  assert.equal(
    validateManifestPayload(insecure, config, config.manifestUrl, {
      allowInsecure: true,
    }).url,
    'http://127.0.0.1:8099/app.apk'
  );
});

test('resolveManifestUrl понимает абсолютные, корневые и относительные ссылки', () => {
  const base = 'https://example.test/updates/tabletka/android/version.json';
  assert.equal(resolveManifestUrl(base, 'https://cdn.test/a.apk'), 'https://cdn.test/a.apk');
  assert.equal(resolveManifestUrl(base, '/files/a.apk'), 'https://example.test/files/a.apk');
  assert.equal(
    resolveManifestUrl(base, 'a.apk'),
    'https://example.test/updates/tabletka/android/a.apk'
  );
  assert.equal(resolveManifestUrl(base, '//cdn.test/a.apk'), 'https://cdn.test/a.apk');
});

test('сравнение версий и versionCode', () => {
  assert.equal(compareVersions('0.2.1', '0.2.0'), 1);
  assert.equal(compareVersions('0.2.0', '0.2.0'), 0);
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions('bad', '0.9.9'), 0);
  assert.equal(isNewerVersion('0.2.1', '0.2.0'), true);
  assert.equal(isNewerVersion('0.2.0', '0.2.0'), false);
  assert.equal(
    isNewer({ version: '0.1.9', versionCode: 9 }, { version: '0.2.0', versionCode: 8 }),
    true
  );
  assert.equal(
    isNewer({ version: '0.2.1' }, { version: '0.2.0', versionCode: 2 }),
    true
  );
  assert.equal(
    isNewer({ version: '0.2.0', versionCode: 2 }, { version: '0.2.1' }),
    false
  );
});
