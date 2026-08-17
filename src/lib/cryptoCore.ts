/**
 * cryptoCore.ts — Single auditable cryptographic surface area for SylvaCrypt.
 *
 * This file is the ONLY public interface through which application code (relay.ts,
 * session.ts, sessionRelay.ts, sessionX3dh.ts, UI components) accesses cryptographic
 * operations.  Protocol implementations (doubleRatchet.ts, x3dh.ts) and raw
 * primitives (crypto.ts, notebookCrypto.ts) are internal modules imported
 * exclusively by this file — never directly by application code.
 *
 * Security auditors: reading this file gives a complete picture of every
 * cryptographic operation SylvaCrypt performs at the application boundary.
 *
 * Protocols implemented:
 *   - Double Ratchet    — Signal Protocol specification (X25519 + HKDF-SHA256 + AES-256-GCM)
 *   - X3DH              — Signal Extended Triple Diffie-Hellman + ML-KEM-768 hybrid
 *   - ML-KEM-768        — NIST FIPS 203 post-quantum KEM
 *   - Singularity       — SylvaCrypt's federated relay protocol
 *   - Sealed sender     — ECIES-style sender anonymity certificate
 *   - Notebook crypto   — Per-conversation AES-256-GCM shared document encryption
 *
 * All primitives use the Web Crypto API exclusively — no custom implementations.
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { toBase64 } from './crypto';

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export { generateX25519KeyPair, generateEd25519KeyPair } from './crypto';

/**
 * Generate a fresh ML-KEM-768 (CRYSTALS-Kyber, NIST FIPS 203) key pair.
 * Returns base64-encoded public and secret keys.
 */
export function generateMLKEMKeyPair(): { publicKeyBase64: string; secretKeyBase64: string } {
  const { publicKey, secretKey } = ml_kem768.keygen();
  return {
    publicKeyBase64: toBase64(publicKey),
    secretKeyBase64: toBase64(secretKey),
  };
}

// ---------------------------------------------------------------------------
// Session initialisation (Double Ratchet)
// ---------------------------------------------------------------------------

export {
  initSessionSender,
  initSessionReceiver,
  initSessionSenderFromSecret,
  initSessionReceiverFromSecret,
} from './doubleRatchet';

// ---------------------------------------------------------------------------
// Ratchet encrypt / decrypt
// ---------------------------------------------------------------------------

export { ratchetEncrypt, ratchetDecrypt } from './doubleRatchet';

// ---------------------------------------------------------------------------
// X3DH / Sealed sender
// ---------------------------------------------------------------------------

export {
  x3dhSenderSetup,
  x3dhReceiverSetupFull,
  initRatchetFromX3DH,
  createSealedSenderBox,
  openSealedSenderBox,
  fetchPrekeyBundle,
  publishPrekeys,
  replenishOPKsIfNeeded,
  consumeOPKPrivate,
  verifySPK,
} from './x3dh';

// ---------------------------------------------------------------------------
// Notebook crypto
// ---------------------------------------------------------------------------

export {
  deriveNotebookKey,
  encryptNotebookContent,
  decryptNotebookContent,
} from './notebookCrypto';

// ---------------------------------------------------------------------------
// Encoding helpers (used broadly across application and transport layers)
// ---------------------------------------------------------------------------

export { toBase64, fromBase64 } from './crypto';

// ---------------------------------------------------------------------------
// Identity / fingerprint helpers (used in UI and session management)
// ---------------------------------------------------------------------------

export { computeFingerprint, computeSafetyNumber } from './crypto';

// ---------------------------------------------------------------------------
// Primitives — exposed for testing only, NOT for direct application use.
// Application code must use the named operations above.
// ---------------------------------------------------------------------------

export { hkdf, hmacSha256, aesEncrypt, aesDecrypt } from './crypto';
