import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Save, AlertCircle, Loader2, Clock,
  Trash2, Paperclip, Lock, PenLine, X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { useSharedNotebook } from '@/hooks/use-shared-notebook';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttachmentType = 'image' | 'video' | 'file';

interface NotebookAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  url: string;       // public URL after upload
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

// Attachment placeholder embedded in notebook content as a JSON tag.
// Format: [attachment:{"id":"...","name":"...","type":"...","url":"..."}]
function buildAttachmentTag(a: Pick<NotebookAttachment, 'id' | 'name' | 'type' | 'url'>): string {
  return `[attachment:${JSON.stringify({ id: a.id, name: a.name, type: a.type, url: a.url })}]`;
}

// MIME types considered safe to upload (no executables/scripts).
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/avif',
  'video/mp4','video/webm','video/ogg','video/quicktime',
  'audio/mpeg','audio/ogg','audio/wav','audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','text/markdown',
  'application/zip','application/x-zip-compressed',
  'application/json',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function mimeToAttachmentType(mime: string): AttachmentType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SharedNotebookPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | undefined;
  currentUserId: string | undefined;
  displayName?: string;
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return 'Not saved yet';
  const date = new Date(iso);
  return `Last saved ${date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SharedNotebookPanel({
  open,
  onOpenChange,
  conversationId,
  currentUserId,
  displayName,
}: SharedNotebookPanelProps) {
  const {
    content, setContent,
    syncStatus, error,
    lastUpdatedAt,
    save,
    resetNotebook,
    acquireLock, releaseLock, lockState,
  } = useSharedNotebook({ conversationId, currentUserId });

  const [localContent, setLocalContent] = useState(content);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorPosRef = useRef<number>(0);
  // Keep a ref to lockState so the open/close effect always sees the latest value
  // without needing lockState in its dependency array (which would re-run on every
  // lock state change and cause spurious acquire/release cycles).
  const lockStateRef = useRef(lockState);
  useEffect(() => { lockStateRef.current = lockState; }, [lockState]);

  // Sync local editor when remote update arrives.
  useEffect(() => { setLocalContent(content); }, [content]);

  // On open: acquire lock and focus.
  // On close: release lock if we currently hold it (read from ref to avoid stale closure).
  useEffect(() => {
    if (open) {
      acquireLock();
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      if (lockStateRef.current.isWriter) releaseLock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!lockState.isWriter) return;
    cursorPosRef.current = e.target.selectionStart ?? 0;
    setLocalContent(e.target.value);
    setContent(e.target.value);
  };

  // Insert attachment tag at cursor position.
  const insertAttachmentAtCursor = useCallback((tag: string) => {
    const pos = cursorPosRef.current;
    const before = localContent.slice(0, pos);
    const after = localContent.slice(pos);
    const newContent = `${before}\n${tag}\n${after}`;
    setLocalContent(newContent);
    setContent(newContent);
    cursorPosRef.current = pos + tag.length + 2;
  }, [localContent, setContent]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !conversationId || !currentUserId) return;

    // Validate mime type.
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setUploadError(`File type "${file.type}" is not allowed.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File exceeds 50 MB limit.`);
      return;
    }

    setUploading(true);
    setUploadError(null);

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${conversationId}/${currentUserId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('notebook-attachments')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      console.error('[SharedNotebook] upload failed:', uploadErr);
      setUploadError('Upload failed. Please try again.');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('notebook-attachments')
      .getPublicUrl(storagePath);

    const tag = buildAttachmentTag({
      id: storagePath,
      name: file.name,
      type: mimeToAttachmentType(file.type),
      url: urlData.publicUrl,
    });

    insertAttachmentAtCursor(tag);
    setUploading(false);
  };

  const statusIcon = () => {
    if (syncStatus === 'loading' || syncStatus === 'syncing') return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    if (syncStatus === 'error') return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    return <Save className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const statusText = () => {
    if (syncStatus === 'loading') return 'Loading…';
    if (syncStatus === 'syncing') return 'Saving…';
    if (syncStatus === 'error') return 'Save failed';
    if (syncStatus === 'synced') return 'Saved';
    return 'Ready';
  };

  // Is the editor read-only? True when lock is held by someone else.
  const isReadOnly = !lockState.isWriter;
  const lockedByOther = !!lockState.lockedBy && lockState.lockedBy !== currentUserId;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && lockState.isWriter) releaseLock();
      onOpenChange(v);
    }}>
      {/* hideClose suppresses the default X from DialogContent */}
      <DialogContent
        hideClose
        className="max-w-[calc(100%-2rem)] md:max-w-2xl bg-card border-border max-h-[90dvh] flex flex-col p-0"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground text-base">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              Shared Pages
              {displayName && (
                <span className="text-muted-foreground font-normal"> with @{displayName}</span>
              )}
            </span>
            {/* Lock badge */}
            {lockState.isWriter ? (
              <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                <PenLine className="w-3.5 h-3.5" /> Editing
              </span>
            ) : lockedByOther ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Lock className="w-3.5 h-3.5" /> Read-only
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="sr-only">
            End-to-end encrypted shared notebook for this conversation.
          </DialogDescription>
        </DialogHeader>

        {/* ── Read-only banner ────────────────────────────────────────────── */}
        {lockedByOther && (
          <div className="px-4 py-2 bg-muted text-muted-foreground text-xs flex items-center gap-2 shrink-0">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            The other participant is currently editing. You have read-only access.
          </div>
        )}

        {/* ── Error banners ───────────────────────────────────────────────── */}
        {(error || uploadError) && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {uploadError ?? error}
          </div>
        )}

        {/* ── Editor ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            onSelect={(e) => {
              cursorPosRef.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
            }}
            disabled={syncStatus === 'loading' || isReadOnly}
            readOnly={isReadOnly}
            placeholder={
              isReadOnly
                ? 'Waiting for the other participant to finish editing…'
                : 'Write something only the two of you can read…'
            }
            className="flex-1 min-h-0 w-full resize-none bg-background p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            spellCheck={false}
            aria-label="Shared notebook content"
            aria-readonly={isReadOnly}
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border shrink-0 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            {statusIcon()}
            <span>{statusText()}</span>
            <span className="hidden sm:inline text-muted-foreground/60">
              <Clock className="w-3 h-3 inline mx-1" />
              {formatUpdatedAt(lastUpdatedAt)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Attach file — only when writer */}
            {lockState.isWriter && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={Array.from(ALLOWED_MIME_TYPES).join(',')}
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                  title="Attach image, video or file"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </Button>
              </>
            )}

            {/* Reset — only when writer */}
            {lockState.isWriter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setResetDialogOpen(true)}
                aria-label="Reset shared notebook"
                title="Clear all content"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            {/* Close */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (lockState.isWriter) releaseLock();
                onOpenChange(false);
              }}
            >
              <X className="w-4 h-4 mr-1.5" />
              Close
            </Button>

            {/* Save — only when writer */}
            {lockState.isWriter && (
              <Button
                type="button"
                size="sm"
                onClick={() => save()}
                disabled={syncStatus === 'loading' || syncStatus === 'syncing'}
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* ── Reset confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Shared Pages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear all content for both participants.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await resetNotebook();
                setLocalContent('');
                setResetDialogOpen(false);
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
