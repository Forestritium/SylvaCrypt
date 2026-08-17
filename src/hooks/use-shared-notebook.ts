import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';
import { getRatchetSessionForConversation } from '@/lib/localStore';
import { deriveNotebookKey, encryptNotebookContent, decryptNotebookContent } from '@/lib/notebookCrypto';

export type NotebookSyncStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error';

/** Lock state as seen by this client. */
export interface NotebookLockState {
  /** User ID currently holding the write lock, or null if unlocked. */
  lockedBy: string | null;
  /** ISO timestamp when the lock was acquired. */
  lockedAt: string | null;
  /** Whether the current user holds the lock. */
  isWriter: boolean;
}

/**
 * Attempt to decrypt a notebook ciphertext.  Returns `null` when the blob is
 * unreadable with this key (e.g. legacy ciphertext saved before the
 * sharedSecret fix).  Re-throws unexpected errors.
 */
async function tryDecryptNotebookContent(
  key: CryptoKey,
  encoded: string
): Promise<string | null> {
  try {
    return await decryptNotebookContent(key, encoded);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'OperationError') {
      return null;
    }
    throw err;
  }
}

interface NotebookRow {
  conversation_id: string;
  encrypted_content: string;
  updated_at: string;
  updated_by: string | null;
  locked_by: string | null;
  locked_at: string | null;
}

interface UseSharedNotebookOptions {
  conversationId: string | undefined;
  currentUserId: string | undefined;
}

interface UseSharedNotebookReturn {
  content: string;
  setContent: (value: string) => void;
  syncStatus: NotebookSyncStatus;
  error: string | null;
  lastUpdatedAt: string | null;
  save: () => Promise<void>;
  resetNotebook: () => Promise<void>;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  lockState: NotebookLockState;
  isReady: boolean;
}

const SAVE_DEBOUNCE_MS = 1200;
/** Stale lock timeout: if locked_at is older than this, treat as stale and allow override. */
const LOCK_STALE_MS = 60_000;

/**
 * Hook for the Shared Pages feature.  Loads the encrypted notebook from the
 * server, decrypts it with the HKDF-derived key from the local Double Ratchet
 * session, and subscribes to realtime updates so edits from the other
 * participant appear instantly.  Saves are debounced and follow last-write-wins
 * semantics: an outgoing save is rejected if the server row has a newer
 * `updated_at` timestamp.
 */
export function useSharedNotebook({
  conversationId,
  currentUserId,
}: UseSharedNotebookOptions): UseSharedNotebookReturn {
  const [content, setContent] = useState('');
  const [syncStatus, setSyncStatus] = useState<NotebookSyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [lockState, setLockState] = useState<NotebookLockState>({
    lockedBy: null,
    lockedAt: null,
    isWriter: false,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyPromiseRef = useRef<Promise<CryptoKey> | null>(null);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const contentRef = useRef(content);
  // Track whether content was explicitly reset so debounced save is suppressed.
  const suppressNextSaveRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Derive the notebook key from the local ratchet session once per conversation.
  useEffect(() => {
    if (!conversationId) { setKey(null); return; }
    setSyncStatus('loading');
    setError(null);
    setContent('');
    setLastUpdatedAt(null);
    lastRemoteUpdatedAtRef.current = null;

    keyPromiseRef.current = (async () => {
      const session = await getRatchetSessionForConversation(conversationId);
      if (!session) throw new Error('No ratchet session for this conversation');
      return deriveNotebookKey(session);
    })();

    keyPromiseRef.current
      .then(k => setKey(k))
      .catch(err => {
        console.error('[SharedNotebook] key derivation failed:', err);
        setError('Unable to unlock shared notebook.');
        setSyncStatus('error');
      });
  }, [conversationId]);

  // Internal helper: delete server row (used for unreadable legacy rows).
  const deleteNotebook = useCallback(async () => {
    if (!conversationId) return;
    const { error: deleteError } = await supabase
      .from('shared_notebooks')
      .delete()
      .eq('conversation_id', conversationId);
    if (deleteError) console.error('[SharedNotebook] delete failed:', deleteError);
  }, [conversationId]);

  // Reset: wipe server row + clear local state. Suppress the debounced auto-save
  // so the empty string we set here does not immediately re-create a blank row.
  const resetNotebook = useCallback(async () => {
    if (!conversationId) return;
    suppressNextSaveRef.current = true;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    const { error: deleteError } = await supabase
      .from('shared_notebooks')
      .delete()
      .eq('conversation_id', conversationId);

    if (deleteError) {
      console.error('[SharedNotebook] reset failed:', deleteError);
      setError('Failed to reset notebook.');
      setSyncStatus('error');
      suppressNextSaveRef.current = false;
      return;
    }

    setContent('');
    setLastUpdatedAt(null);
    lastRemoteUpdatedAtRef.current = null;
    setError(null);
    setSyncStatus('synced');
  }, [conversationId]);

  // Acquire the write lock. Returns true if lock was obtained.
  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!conversationId || !currentUserId) return false;
    const now = new Date().toISOString();

    // Ensure a row exists. Use updated_by: null here — this is NOT a content
    // save, so we must not stamp our userId onto updated_by.  If the Realtime
    // subscription receives this event, the updated_at comparison guard will
    // correctly classify it as a lock-only event and skip content processing.
    await supabase.from('shared_notebooks').upsert(
      { conversation_id: conversationId, encrypted_content: '', updated_at: now, updated_by: null },
      { onConflict: 'conversation_id', ignoreDuplicates: true }
    );

    // Fetch current lock state.
    const { data } = await supabase
      .from('shared_notebooks')
      .select('locked_by, locked_at')
      .eq('conversation_id', conversationId)
      .single();

    if (data) {
      const lockedBy = (data as { locked_by: string | null }).locked_by;
      const lockedAt = (data as { locked_at: string | null }).locked_at;
      const isStale = lockedAt
        ? Date.now() - new Date(lockedAt).getTime() > LOCK_STALE_MS
        : true;
      // Lock held by someone else and not stale → cannot acquire.
      if (lockedBy && lockedBy !== currentUserId && !isStale) {
        setLockState({ lockedBy, lockedAt, isWriter: false });
        return false;
      }
    }

    // Acquire / refresh the lock.
    const { error: lockError } = await supabase
      .from('shared_notebooks')
      .update({ locked_by: currentUserId, locked_at: now })
      .eq('conversation_id', conversationId);

    if (lockError) {
      console.error('[SharedNotebook] acquireLock failed:', lockError);
      return false;
    }

    setLockState({ lockedBy: currentUserId, lockedAt: now, isWriter: true });
    return true;
  }, [conversationId, currentUserId]);

  // Release the write lock (only if we hold it).
  const releaseLock = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    await supabase
      .from('shared_notebooks')
      .update({ locked_by: null, locked_at: null })
      .eq('conversation_id', conversationId)
      .eq('locked_by', currentUserId);
    setLockState({ lockedBy: null, lockedAt: null, isWriter: false });
  }, [conversationId, currentUserId]);

  // Load the notebook from the server and decrypt it.
  const loadNotebook = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    const k = await keyPromiseRef.current;
    if (!k) return;

    const { data, error: fetchError } = await supabase
      .from('shared_notebooks')
      .select('conversation_id, encrypted_content, updated_at, updated_by, locked_by, locked_at')
      .eq('conversation_id', conversationId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        setContent('');
        setLastUpdatedAt(null);
        lastRemoteUpdatedAtRef.current = null;
        setSyncStatus('synced');
        return;
      }
      console.error('[SharedNotebook] load failed:', fetchError);
      setError('Failed to load shared notebook.');
      setSyncStatus('error');
      return;
    }

    const row = data as NotebookRow;

    // Update lock state from DB.
    setLockState(prev => ({
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      isWriter: prev.isWriter && row.locked_by === currentUserId,
    }));

    if (row.encrypted_content) {
      const decrypted = await tryDecryptNotebookContent(k, row.encrypted_content);
      if (decrypted === null) {
        console.warn('[SharedNotebook] unreadable notebook row; deleting legacy row');
        await deleteNotebook();
        suppressNextSaveRef.current = true;
        setContent('');
        setLastUpdatedAt(null);
        lastRemoteUpdatedAtRef.current = null;
        setError('Unreadable notebook was cleared.');
        setSyncStatus('error');
        return;
      }
      setContent(decrypted);
    } else {
      setContent('');
    }

    setLastUpdatedAt(row.updated_at);
    lastRemoteUpdatedAtRef.current = row.updated_at;
    setSyncStatus('synced');
  }, [conversationId, currentUserId, deleteNotebook]);

  useEffect(() => {
    if (!key || !conversationId || !currentUserId) return;
    loadNotebook();
  }, [key, conversationId, currentUserId, loadNotebook]);

  // Save the notebook to the server with last-write-wins conflict resolution.
  const save = useCallback(async () => {
    if (!conversationId || !currentUserId) return;

    const k = await keyPromiseRef.current;
    if (!k) {
      setError('Notebook key not ready — please try again.');
      setSyncStatus('error');
      return;
    }

    setSyncStatus('syncing');
    const encrypted = await encryptNotebookContent(k, contentRef.current);
    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from('shared_notebooks')
      .upsert({
        conversation_id: conversationId,
        encrypted_content: encrypted,
        updated_at: now,
        updated_by: currentUserId,
      }, { onConflict: 'conversation_id' });

    if (upsertError) {
      console.error('[SharedNotebook] save failed:', upsertError);
      setError('Failed to save shared notebook.');
      setSyncStatus('error');
      return;
    }

    setLastUpdatedAt(now);
    lastRemoteUpdatedAtRef.current = now;
    setSyncStatus('synced');
    setError(null);
  }, [conversationId, currentUserId]);

  // Debounced auto-save on content change.
  // Guard: do NOT auto-save empty content (prevents re-creating a row after reset).
  useEffect(() => {
    if (!content) return;                         // empty after reset — skip
    if (suppressNextSaveRef.current) {            // explicit reset suppression
      suppressNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save().catch(() => {});
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, save]);

  // Subscribe to realtime updates (content + lock changes) from the other participant.
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channel = supabase
      .channel(`shared-notebook:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_notebooks',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newRow = payload.new as NotebookRow | undefined;
          if (!newRow) return;

          // Always sync lock state regardless of who sent the update.
          setLockState(prev => ({
            lockedBy: newRow.locked_by,
            lockedAt: newRow.locked_at,
            isWriter: prev.isWriter && newRow.locked_by === currentUserId,
          }));

          // Skip content processing when this was a lock-only mutation.
          // Lock acquisitions update locked_by/locked_at but do NOT advance
          // updated_at — so if updated_at hasn't changed vs the last known
          // remote timestamp, there is no new content to apply.
          if (lastRemoteUpdatedAtRef.current &&
              newRow.updated_at === lastRemoteUpdatedAtRef.current) {
            // Lock state already synced above — nothing else to do.
            return;
          }

          // Skip content processing when updated_by is null — this means the
          // event was fired by acquireLock()'s upsert (row creation) or a pure
          // lock mutation that happened to advance updated_at.  There is no
          // meaningful content payload to decrypt in these cases.
          if (newRow.updated_by === null) return;

          // Ignore our own content saves (updated_by will be our userId).
          if (newRow.updated_by === currentUserId) return;

          // Ignore updates that are older than what we already have.
          if (lastRemoteUpdatedAtRef.current && newRow.updated_at <= lastRemoteUpdatedAtRef.current) return;

          try {
            const k = await keyPromiseRef.current;
            if (!k) return;
            const decrypted = newRow.encrypted_content
              ? await tryDecryptNotebookContent(k, newRow.encrypted_content)
              : '';
            if (decrypted === null) {
              console.warn('[SharedNotebook] realtime update unreadable; deleting legacy row');
              await deleteNotebook();
              setError('Remote notebook was unreadable and has been cleared.');
              setSyncStatus('error');
              return;
            }
            setContent(decrypted);
            setLastUpdatedAt(newRow.updated_at);
            lastRemoteUpdatedAtRef.current = newRow.updated_at;
            setSyncStatus('synced');
          } catch (err) {
            console.error('[SharedNotebook] realtime decrypt failed:', err);
            setError('Remote notebook update could not be decrypted.');
            setSyncStatus('error');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, deleteNotebook]);

  return {
    content,
    setContent,
    syncStatus,
    error,
    lastUpdatedAt,
    save,
    resetNotebook,
    acquireLock,
    releaseLock,
    lockState,
    isReady: !!key,
  };
}
