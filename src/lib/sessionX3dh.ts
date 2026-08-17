/**
 * Session-only re-exports of X3DH functions via cryptoCore.
 *
 * This wrapper lets session.ts lazy-load X3DH prekey publication without
 * forcing x3dh.ts to be split ambiguously across the main and route chunks.
 * All crypto imports route exclusively through cryptoCore.ts.
 */

export { publishPrekeys, replenishOPKsIfNeeded } from '@/lib/cryptoCore';
