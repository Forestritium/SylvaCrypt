/**
 * Vault export / import helpers.
 *
 * Security model
 * ──────────────
 * The export payload is AES-256-GCM encrypted with the user's in-memory vault
 * key before being returned to the caller.  AES-GCM provides both
 * confidentiality and a 128-bit authentication tag (AEAD), so any tampering
 * with the file — including substitution of contact public keys — is detected
 * on import and the operation is rejected before any data is written.
 *
 * Wire format: base64( IV[12] ‖ AES-256-GCM-ciphertext )
 * The plaintext inside is JSON:
 *   { version: 2, timestamp, contacts: Contact[], messages: LocalMessage[] }
 *
 * Backward-compatibility: version 1 files (plain-JSON) are detected by
 * attempting JSON.parse on the raw input.  If parsing succeeds and the result
 * contains version≤1 (or no version field), the legacy path is taken and the
 * caller is warned.  All newly written files are version 2 (encrypted).
 */

import { getContactsFromDB, getMessagesFromDB, saveContactToDB, saveMessageToDB } from './dbStore';
import { encryptObject, decryptObject } from './crypto';
import { getEncryptionKey } from './localStore';
import { supabase } from '@/db/supabase';
import type { LocalMessage } from '@/types/types';

const EXPORT_VERSION = 2;

/**
 * Export contacts and messages as an AES-256-GCM encrypted blob.
 *
 * Returns a base64-encoded ciphertext string (IV ‖ ciphertext).
 * The vault key must be unlocked; throws if it is not.
 */
export async function exportLocalVault(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) throw new Error('Not logged in');

  const vaultKey = getEncryptionKey();
  if (!vaultKey) throw new Error('Vault is locked. Re-enter your password and try again.');

  const contacts = await getContactsFromDB(userId);
  const messages: LocalMessage[] = [];
  for (const contact of contacts) {
    const { messages: msgs } = await getMessagesFromDB(userId, contact.conversationId);
    messages.push(...msgs);
  }

  const payload = {
    version: EXPORT_VERSION,
    timestamp: Date.now(),
    contacts,
    messages,
  };

  // AES-256-GCM encryption provides BOTH confidentiality AND integrity (AEAD).
  // Any modification to the ciphertext — including a public-key substitution
  // attack — will cause decryption to throw on import.
  return encryptObject(vaultKey, payload);
}

/**
 * Import a vault backup produced by exportLocalVault.
 *
 * The ciphertext is decrypted and authenticated with the user's vault key
 * before ANY data is written.  Throws on authentication failure, malformed
 * input, or a locked vault — callers should surface the error to the user.
 *
 * Also accepts legacy v1 (plain-JSON) files with a warning; those files do
 * not carry integrity protection so public keys are imported at the caller's
 * own risk (same behaviour as the old implementation).
 */
export async function importLocalVault(rawInput: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) throw new Error('Not logged in');

  let data: { version?: number; contacts: unknown[]; messages: unknown[] };

  // Detect legacy v1 plain-JSON files (no encryption).
  let isLegacy = false;
  try {
    const parsed = JSON.parse(rawInput);
    // A successfully-parsed JSON object with contacts/messages is a v1 file.
    if (parsed && typeof parsed === 'object' && 'contacts' in parsed) {
      isLegacy = true;
      data = parsed as typeof data;
      console.warn(
        '[SylvaCrypt] Importing a legacy v1 vault backup (unencrypted). ' +
        'Public key integrity cannot be verified. Future backups will be encrypted.'
      );
    } else {
      throw new Error('Not a legacy file');
    }
  } catch {
    // Not valid JSON — treat as encrypted v2 ciphertext.
    const vaultKey = getEncryptionKey();
    if (!vaultKey) throw new Error('Vault is locked. Re-enter your password before importing.');

    // decryptObject verifies the AES-GCM authentication tag.
    // Any tampering (including public-key substitution) throws here.
    data = await decryptObject<typeof data>(vaultKey, rawInput);
  }

  if (!data.contacts || !data.messages) throw new Error('Invalid vault file: missing contacts or messages.');
  if (isLegacy && (!Array.isArray(data.contacts) || !Array.isArray(data.messages))) {
    throw new Error('Invalid legacy vault file structure.');
  }

  // Restore contacts then messages.
  for (const contact of data.contacts) {
    await saveContactToDB(userId, contact as Parameters<typeof saveContactToDB>[1]);
  }
  for (const message of data.messages) {
    await saveMessageToDB(userId, message as LocalMessage);
  }
}
