/**
 * AES-256-GCM + ECDH + HKDF utilities using the Web Crypto API.
 * All data encrypted locally before leaving the device.
 *
 * Key derivation:
 *   v0 = PBKDF2-SHA256 @ 310,000 iterations (legacy)
 *   v1 = Argon2id (memory-hard, GPU-resistant)
 */

import { argon2id } from 'hash-wasm';

/** Cast a Uint8Array to a plain ArrayBuffer for WebCrypto compatibility */
export function ab(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/** Derive AES-256 key from password using PBKDF2 (KDF v0 — legacy) */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', ab(new TextEncoder().encode(password)), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: 310000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

/** Derive AES-256 key from password using Argon2id (KDF v1 — memory-hard) */
export async function deriveKeyFromPasswordArgon2id(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey(
    'raw', ab(raw as Uint8Array),
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

/** Route to the correct KDF based on stored version. */
export async function deriveVaultKey(password: string, salt: Uint8Array, kdfVersion: number): Promise<CryptoKey> {
  if (kdfVersion >= 1) {
    return deriveKeyFromPasswordArgon2id(password, salt);
  }
  return deriveKeyFromPassword(password, salt);
}

/** Encrypt bytes with AES-256-GCM, prepend 12-byte IV */
export async function aesEncrypt(key: CryptoKey, data: Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer }, key, ab(data));
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/** Decrypt AES-256-GCM */
export async function aesDecrypt(key: CryptoKey, ciphertext: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer }, key, ab(ciphertext));
  return new Uint8Array(plain);
}

/** Encrypt any JSON-serialisable value; returns base64(IV + ciphertext) */
export async function encryptObject<T>(key: CryptoKey, obj: T): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const { ciphertext, iv } = await aesEncrypt(key, data);
  const out = new Uint8Array(12 + ciphertext.length);
  out.set(iv); out.set(ciphertext, 12);
  return toBase64(out);
}

/** Decrypt base64(IV + ciphertext) back to T */
export async function decryptObject<T>(key: CryptoKey, encoded: string): Promise<T> {
  const combined = fromBase64(encoded);
  const plain = await aesDecrypt(key, combined.slice(12), combined.slice(0, 12));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** SHA-256 hash */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', ab(data)));
}

/** First 8 bytes of SHA-256 formatted as hex pairs */
export async function computeFingerprint(publicKeyBase64: string): Promise<string> {
  const hash = await sha256(fromBase64(publicKeyBase64));
  return Array.from(hash.slice(0, 8)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** Generate ECDH P-256 key pair; returns base64-encoded raw pub + pkcs8 priv */
export async function generateECDHKeyPair() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  return {
    publicKey: kp.publicKey,
    privateKey: kp.privateKey,
    publicKeyBase64: toBase64(pubRaw),
    privateKeyBase64: toBase64(privPkcs8),
  };
}

export async function importECDHPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', ab(fromBase64(base64)), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

export async function importECDHPrivateKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', ab(fromBase64(base64)), { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
}

export async function ecdhDeriveBits(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256));
}

/** HKDF-SHA256: derive `outputLength` bytes */
export async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string, outputLength: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ab(ikm), 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: ab(salt), info: ab(new TextEncoder().encode(info)) },
    key, outputLength * 8
  );
  return new Uint8Array(derived);
}

/** HMAC-SHA256 */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const ck = await crypto.subtle.importKey('raw', ab(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', ck, ab(data)));
}

/** Import raw bytes as AES-GCM key */
export async function importAESKey(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', ab(bytes), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
