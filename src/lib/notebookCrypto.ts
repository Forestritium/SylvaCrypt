/**
 * Shared notebook cryptography.
 *
 * A shared notebook is a persistent collaborative document between the two
 * participants of a 1:1 conversation.  Its content is encrypted with AES-256-GCM
 * using a key derived from the Double Ratchet root key (RK) via HKDF-SHA256.
 * Both participants independently derive the same key because the RK is shared
 * between their ratchet sessions.
 *
 *   notebookKey = HKDF(RK, salt, 'SylvaCrypt-Notebook-v1', 32)
 *
 * The encrypted blob format is base64(IV[12] || ciphertext) so the plaintext
 * never touches the server.  The relay only sees opaque ciphertext.
 */

import { hkdf, importAESKey, aesEncrypt, aesDecrypt, toBase64, fromBase64 } from '@/lib/crypto';
import type { RatchetSession } from '@/types/types';

const NOTEBOOK_INFO = 'SylvaCrypt-Notebook-v1';
const NOTEBOOK_SALT = new Uint8Array(32); // public salt; security lives in the RK

export interface EncryptedNotebook {
  encryptedContent: string; // base64(IV || ciphertext)
}

/**
 * Derive the shared notebook AES-256-GCM key from the stable session secret.
 * New sessions store the initial X25519 / X3DH shared secret explicitly so
 * both peers derive the same key even before any message is exchanged.  Older
 * sessions fall back to the current root key, which is stable once the first
 * message has been processed in both directions.
 */
export async function deriveNotebookKey(session: RatchetSession): Promise<CryptoKey> {
  const ikm = session.sharedSecret
    ? fromBase64(session.sharedSecret)
    : fromBase64(session.RK);
  const keyBytes = await hkdf(ikm, NOTEBOOK_SALT, NOTEBOOK_INFO, 32);
  return importAESKey(keyBytes);
}

/**
 * Encrypt notebook plaintext. Returns a base64-encoded IV + ciphertext blob.
 */
export async function encryptNotebookContent(key: CryptoKey, plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const { ciphertext, iv } = await aesEncrypt(key, data);
  const out = new Uint8Array(12 + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, 12);
  return toBase64(out);
}

/**
 * Decrypt a base64(IV || ciphertext) blob. Returns plaintext string.
 */
export async function decryptNotebookContent(key: CryptoKey, encoded: string): Promise<string> {
  const combined = fromBase64(encoded);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await aesDecrypt(key, ciphertext, iv);
  return new TextDecoder().decode(plain);
}
