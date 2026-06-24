/**
 * BIP-39 mnemonic utilities for ShadowCrypt recovery phrases.
 * Uses @scure/bip39 for standards-compliant 12-word generation.
 */

import { generateMnemonic as scureGenerate, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export { validateMnemonic };

/** Generate a fresh 12-word BIP-39 mnemonic (128-bit entropy). */
export function generateMnemonic(): string {
  return scureGenerate(wordlist, 128);
}

/** SHA-256 hex hash of a mnemonic phrase — stored server-side for verification. */
export async function hashMnemonic(mnemonic: string): Promise<string> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Normalize user-typed mnemonic: trim, lowercase, collapse whitespace. */
export function normalizeMnemonic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Validate that a string is a valid 12-word BIP-39 phrase. */
export function isValidMnemonic(phrase: string): boolean {
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}
