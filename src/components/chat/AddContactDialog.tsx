import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, AlertCircle, Shield, Key, Send, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findUserByUsername, sendContactRequest, getRequestStatus } from '@/lib/relay';
import { computeFingerprint } from '@/lib/crypto';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onContactAdded: () => void;
}

export function AddContactDialog({
  open,
  onOpenChange,
  currentUserId,
  onContactAdded,
}: AddContactDialogProps) {
  const [searchUsername, setSearchUsername] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; username: string; public_key: string | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [existingStatus, setExistingStatus] = useState<'pending' | 'accepted' | 'rejected' | null>(null);
  const [error, setError] = useState('');
  const [fingerprint, setFingerprint] = useState('');

  const handleSearch = async () => {
    const trimmed = searchUsername.trim();
    if (!trimmed) return;
    setSearching(true);
    setError('');
    setFoundUser(null);
    setFingerprint('');
    setRequestSent(false);
    setExistingStatus(null);
    try {
      const result = await findUserByUsername(trimmed);
      if (!result) {
        setError(`No user found with username "${trimmed}".`);
        return;
      }
      if (result.id === currentUserId) {
        setError("You can't add yourself as a contact.");
        return;
      }
      setFoundUser(result);
      if (result.public_key) {
        const fp = await computeFingerprint(result.public_key);
        setFingerprint(fp);
      }
      // Check if a request already exists
      const status = await getRequestStatus(currentUserId, result.id);
      setExistingStatus(status);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!foundUser) return;
    if (!foundUser.public_key) {
      toast.error('This user has no public key. Ask them to log in first.');
      return;
    }
    setSending(true);
    try {
      const { error: reqErr } = await sendContactRequest(currentUserId, foundUser.id);
      if (reqErr) {
        toast.error(reqErr);
        return;
      }
      setRequestSent(true);
      toast.success(`Contact request sent to @${foundUser.username}.`);
      onContactAdded();
    } catch {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSearchUsername('');
    setFoundUser(null);
    setError('');
    setFingerprint('');
    setRequestSent(false);
    setExistingStatus(null);
    onOpenChange(false);
  };

  const alreadyPending = existingStatus === 'pending' || requestSent;
  const alreadyAccepted = existingStatus === 'accepted';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Encrypted Contact
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search for a user by their ShadowCrypt username to send a contact request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-muted-foreground uppercase tracking-wider">
              Username
            </Label>
            <div className="flex gap-2">
              <Input
                value={searchUsername}
                onChange={e => { setSearchUsername(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="their_username"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground px-3"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !searchUsername.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              >
                {searching ? (
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : 'Search'}
              </Button>
            </div>
            {error && (
              <p className="text-destructive text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{error}
              </p>
            )}
          </div>

          {foundUser && (
            <div className="bg-accent/60 border border-primary/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">
                    {foundUser.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-foreground font-semibold">
                    <span className="text-primary/60">@</span>{foundUser.username}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">E2E Encrypted</span>
                  </div>
                </div>
              </div>

              {fingerprint && (
                <div className="bg-background/50 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Key className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Key Fingerprint</span>
                  </div>
                  <p className="text-xs font-mono text-primary/80 break-all">{fingerprint}</p>
                </div>
              )}

              {alreadyAccepted ? (
                <div className="flex items-center gap-2 text-xs text-green-500 bg-green-500/10 rounded px-3 py-2">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  Already in your contacts
                </div>
              ) : alreadyPending ? (
                <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 rounded px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Contact request sent — waiting for @{foundUser.username} to accept
                </div>
              ) : (
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSendRequest}
                  disabled={sending || !foundUser.public_key}
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending request...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Contact Request
                    </span>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
