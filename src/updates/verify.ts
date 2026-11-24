import type { UpdateKey } from './types';

/**
 * Hash function used by the verifier. Production passes expo-crypto, tests
 * pass node:crypto; the RSA part stays free of native modules.
 */
export type HashHex = (message: string) => Promise<string>;

const BASE64URL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// DER prefix of DigestInfo for SHA-256 (RFC 8017, section 9.2).
const SHA256_DIGEST_INFO = '3031300d060960864801650304020105000420';

export function base64UrlToBytes(value: string): Uint8Array {
  const clean = value.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    const index = BASE64URL.indexOf(character);
    if (index < 0) throw new Error('invalid base64url');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      // Keep only the unread tail: without this the shift overflows 32 bits.
      buffer &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(bytes);
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const result = new Uint8Array(length);
  let current = value;
  for (let index = length - 1; index >= 0; index -= 1) {
    result[index] = Number(current & 0xffn);
    current >>= 8n;
  }
  if (current !== 0n) throw new Error('integer does not fit');
  return result;
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus <= 0n) throw new Error('invalid modulus');
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if ((power & 1n) === 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

export function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) {
    throw new Error('invalid hex');
  }
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

export function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
  return result;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

/** Minimal UTF-8 decoder: Hermes does not guarantee TextDecoder. */
export function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    index += 1;
    if (first < 0x80) {
      result += String.fromCharCode(first);
    } else if ((first & 0xe0) === 0xc0) {
      const second = bytes[index];
      index += 1;
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
    } else if ((first & 0xf0) === 0xe0) {
      const second = bytes[index];
      const third = bytes[index + 1];
      index += 2;
      result += String.fromCharCode(
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f)
      );
    } else if ((first & 0xf8) === 0xf0) {
      const second = bytes[index];
      const third = bytes[index + 1];
      const fourth = bytes[index + 2];
      index += 3;
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      result += String.fromCodePoint(codePoint);
    } else {
      throw new Error('invalid utf-8');
    }
  }
  return result;
}

export function base64UrlToText(value: string): string {
  return utf8Decode(base64UrlToBytes(value));
}

/**
 * Verifies `v1.<payload>.<signature>` (RSA PKCS#1 v1.5, SHA-256) and returns
 * the signed payload, or null when anything is wrong.
 */
export async function verifyToken(
  token: string,
  key: UpdateKey,
  hashHex: HashHex
): Promise<Record<string, unknown> | null> {
  if (typeof token !== 'string' || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) {
    return null;
  }

  try {
    const signed = `v1.${parts[1]}`;
    const modulus = BigInt(key.n);
    const exponent = BigInt(key.e);
    if (modulus <= 0n || exponent <= 0n) return null;

    const keyLength = Math.ceil(modulus.toString(2).length / 8);
    const signature = bytesToBigInt(base64UrlToBytes(parts[2]));
    if (signature >= modulus) return null;

    const message = modPow(signature, exponent, modulus);
    const encoded = bigIntToBytes(message, keyLength);

    const digest = await hashHex(signed);
    if (!/^[0-9a-f]{64}$/i.test(digest)) return null;
    const digestInfo = hexToBytes(SHA256_DIGEST_INFO + digest.toLowerCase());
    const paddingLength = keyLength - digestInfo.length - 3;
    if (paddingLength < 8) return null;

    const expected = new Uint8Array(keyLength);
    expected[1] = 0x01;
    expected.fill(0xff, 2, 2 + paddingLength);
    expected[2 + paddingLength] = 0x00;
    expected.set(digestInfo, 3 + paddingLength);
    if (!timingSafeEqual(encoded, expected)) return null;

    const payload = JSON.parse(base64UrlToText(parts[1])) as unknown;
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
