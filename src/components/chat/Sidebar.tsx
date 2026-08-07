import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Bell, BellOff,
  X, Trash2,
  LogOut, MoreVertical, Info, Check, XCircle,
  Clock, Sun, Moon, ChevronDown, ChevronRight, SendHorizontal,
  Shield, Settings, QrCode, Search, PanelLeftClose
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Contact, Profile, ContactRequest } from '@/types/types';
import { AddContactDialog } from './AddContactDialog';
import { QRContactDialog } from './QRContactDialog';
import { makeConversationId } from '@/lib/session';
import { useTheme } from '@/contexts/ThemeContext';
import { acceptContactRequest, rejectContactRequest, cancelContactRequest, blockUser, unblockUser, deleteContactRequestBetween, deleteRelayMessagesBetween, clearContactRemovalsBetween } from '@/lib/relay';
import { saveContactToDB, removeContactAndMessagesFromDB } from '@/lib/dbStore';
import { supabase } from '@/db/supabase';
import { deleteConversationMessagesForBoth } from '@/lib/dbStore';
import { computeFingerprint } from '@/lib/crypto';
import { toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { isDND, setDND } from '@/lib/notificationSound';

const APP_VERSION = 'v8.0.0 (Web)';

function BuyMeACoffee() {
  return (
    <div className="flex justify-center my-2">
      <a
        href="https://www.buymeacoffee.com/admin.forestritium"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90 active:opacity-75"
        style={{ backgroundColor: '#40DCA5', color: '#ffffff', height: '36px' }}
      >
        <span style={{ fontSize: '16px' }}>☕</span>
        Buy creator a cup of coffee
      </a>
    </div>
  );
}

export interface SidebarProps {
  contacts: Contact[];
  lastMessageTimes?: Record<string, number>;
  lastMessagePreviews?: Record<string, string>;
  currentUserId: string;
  username: string;
  fingerprint: string;
  /** Session public key forwarded to QRContactDialog so new accounts can show
   *  a QR code before the profile write has completed. */
  myPublicKeyBase64?: string | null;
  profile: Profile | null;
  isOpen: boolean;
  pendingRequests: ContactRequest[];
  outgoingRequests: ContactRequest[];
  blockedIds: string[];
  onClose: () => void;
  onCollapseDesktop?: () => void;
  onSelectConversation: (conv: any) => void;
  onContactsChange: () => void;
  onRequestHandled?: () => void;
  onConversationDeselect?: (conversationId: string) => void;
  onContactRemoved?: (contactId: string, isBlock?: boolean) => Promise<void>;
  onLogout?: () => void;
  /** Optional ref that the parent can use to programmatically focus the search box (Ctrl+K). */
  focusSearchRef?: React.MutableRefObject<(() => void) | null>;
  /** Optional callback that the parent can call to open the Add Contact dialog (Ctrl+N). */
  onTriggerAddContact?: React.MutableRefObject<(() => void) | null>;
  isMobileList?: boolean;
}
function SidebarContent({
  contacts,
  lastMessageTimes,
  currentUserId,
  username,
  fingerprint,
  myPublicKeyBase64,
  profile,
  pendingRequests,
  outgoingRequests,
  blockedIds,
  onSelectConversation,
  onCollapseDesktop,
  onContactsChange,
  onRequestHandled,
  onConversationDeselect,
  onContactRemoved,
  onLogout,
  onClose,
  isMobile,
  focusSearchRef,
  onTriggerAddContact,
}: SidebarProps & { onClose?: () => void; isMobile?: boolean }) {
  const [showContacts, setShowContacts] = useState(true);
  const [showIncoming, setShowIncoming] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(false);

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactPrefill, setAddContactPrefill] = useState('');
  const [addContactQrToken, setAddContactQrToken] = useState<string | null>(null);
  const [addContactQrFingerprint, setAddContactQrFingerprint] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [handlingId, setHandlingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Contact | null>(null);
  const [blockTarget, setBlockTarget] = useState<Contact | null>(null);
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  // DND (Do Not Disturb) — global sound mute, persisted in localStorage
  const [dndEnabled, setDndEnabled] = useState(() => isDND());
  // Hide the "Buy creator a cup of coffee" button when the user disables it
  const [hideBuyCoffee, setHideBuyCoffee] = useState(() => localStorage.getItem('sc_hide_buy_coffee') === '1');
  // ── Contact search / filter ────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Expose focusSearch + triggerAddContact to parent via refs (Ctrl+K / Ctrl+N)
  useEffect(() => {
    if (focusSearchRef) focusSearchRef.current = () => searchInputRef.current?.focus();
    if (onTriggerAddContact) onTriggerAddContact.current = () => setAddContactOpen(true);
  }, [focusSearchRef, onTriggerAddContact]);

  // Sync hide-buy-coffee toggle across tabs / from Settings changes
  useEffect(() => {
    const sync = () => setHideBuyCoffee(localStorage.getItem('sc_hide_buy_coffee') === '1');
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const contactDisplayName = (c: Contact) => c.nickname?.trim() ? c.nickname.trim() : c.username;

  const handleSelectContact = (contact: Contact) => {
    const convId = makeConversationId(currentUserId, contact.id);
    onSelectConversation({ id: convId, type: 'direct', name: contactDisplayName(contact), unreadCount: 0, contact });
    onClose?.();
  };

  const handleRemoveContact = async (contact: Contact) => {
    const convId = makeConversationId(currentUserId, contact.id);
    try {
      // 1. Delete this user's local DB copy + ratchet session
      await removeContactAndMessagesFromDB(currentUserId, contact.id, convId);
      // 2. Delete contact_requests between both users
      await deleteContactRequestBetween(currentUserId, contact.id);
      // 3. Delete ALL relay messages in both directions (in-flight messages)
      await deleteRelayMessagesBetween(currentUserId, contact.id);
      // 4. Delete the OTHER user's DB copy of messages too (full cascade)
      await deleteConversationMessagesForBoth(currentUserId, contact.id, convId);
      // 5. Notify the other user so they remove us on their end immediately
      await onContactRemoved?.(contact.id);
      toast.success(`@${contact.username} removed from contacts.`);
      onConversationDeselect?.(convId);
      onContactsChange();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to remove contact.');
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleBlockContact = async (contact: Contact) => {
    try {
      const { error } = await blockUser(contact.id);
      if (error) throw new Error(error);
      const convId = makeConversationId(currentUserId, contact.id);
      // We purposefully do NOT delete the local DB contact or the contact_request
      // so that they are merely "hidden" and will be fully restored upon unblocking.
      
      if (notifyBlocked) {
        // notify the user they were blocked by inserting a contact_removals with is_block=true
        await onContactRemoved?.(contact.id, true);
      }
      
      toast.success(`@${contact.username} has been blocked.`);
      onConversationDeselect?.(convId);
      onContactsChange();
      onRequestHandled?.();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to block user.');
    } finally {
      setBlockTarget(null);
      setNotifyBlocked(false);
    }
  };
  const handleAcceptRequest = async (req: ContactRequest) => {
    setHandlingId(req.id);
    try {
      const { error } = await acceptContactRequest(req.id);
      if (error) throw new Error(error);

      // The sender's public key is embedded in the request row (written at
      // send-time). Fall back to a live profile fetch only for legacy rows that
      // pre-date the sender_public_key column, retrying briefly if needed.
      let livePublicKey: string | null | undefined = req.senderPublicKey ?? null;

      if (!livePublicKey) {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
          const { data: senderProfile } = await supabase
            .from('public_profiles')
            .select('public_key')
            .eq('id', req.sender_id)
            .maybeSingle();
          if (senderProfile?.public_key) {
            livePublicKey = senderProfile.public_key;
            break;
          }
        }
      }

      if (!livePublicKey) {
        toast.error("Could not retrieve sender's encryption key.", {
          description:
            "@" + (req.senderUsername ?? 'The sender') +
            " hasn't completed their account setup yet. Ask them to open the app and try again in a moment.",
        });
        return;
      }

      const fp = await computeFingerprint(livePublicKey);
      const convId = makeConversationId(currentUserId, req.sender_id);
      await saveContactToDB(currentUserId, {
        id: req.sender_id,
        username: req.senderUsername ?? 'Unknown',
        publicKey: livePublicKey,
        fingerprint: fp,
        addedAt: Date.now(),
        conversationId: convId,
        verifiedViaQR: false,
        originalFingerprint: fp,
      });
      // Clear any stale contact_removals rows between these two users so that
      // a previous removal notification from a prior cycle never triggers a
      // spurious re-removal the next time either party's login drain runs.
      await clearContactRemovalsBetween(currentUserId, req.sender_id).catch(() => {});
      toast.success(`@${req.senderUsername} added to your contacts.`);
      onRequestHandled?.();
      onContactsChange();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to accept request.');
    } finally {
      setHandlingId(null);
    }
  };

  const handleRejectRequest = async (req: ContactRequest) => {
    setHandlingId(req.id);
    try {
      const { error } = await rejectContactRequest(req.id);
      if (error) throw new Error(error);
      toast.info(`Request from @${req.senderUsername} declined.`);
      onRequestHandled?.();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to decline request.');
    } finally {
      setHandlingId(null);
    }
  };

  const handleCancelRequest = async (req: ContactRequest) => {
    setHandlingId(req.id);
    try {
      const { error } = await cancelContactRequest(req.id);
      if (error) throw new Error(error);
      toast.info('Contact request cancelled.');
      onRequestHandled?.();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to cancel request.');
    } finally {
      setHandlingId(null);
    }
  };

  const filteredContacts = searchQuery.trim()
    ? contacts.filter(c =>
        contactDisplayName(c).toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        c.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : contacts;

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    // Sort by recent conversation activity using lastMessageTimes
    const convIdA = makeConversationId(currentUserId, a.id);
    const convIdB = makeConversationId(currentUserId, b.id);
    const timeA = lastMessageTimes?.[convIdA] ?? a.addedAt;
    const timeB = lastMessageTimes?.[convIdB] ?? b.addedAt;
    return timeB - timeA;
  });

  return (
    <>
      <div className="flex flex-col h-full bg-transparent overflow-hidden">

        {/* ── Header: brand + theme toggle (+ close on mobile) ── */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoUrl} alt="SylvaCrypt" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground leading-tight">SylvaCrypt</p>
                <p className="text-xs text-muted-foreground leading-tight">{"100% secure encryption"}</p>
              </div>
            </div>
            {/* Right side: theme toggle + close (mobile only) */}
            <div className="flex items-center gap-1">
              {onCollapseDesktop && (
                <button
                  onClick={onCollapseDesktop}
                  className="w-8 h-8 rounded-lg hidden md:flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {isMobile && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── User account row ── */}
        <div className="shrink-0 px-3 py-2 border-b border-sidebar-border">
          {/* Avatar row */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={`${profile.avatar_url}?t=${profile.username}`} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-base">{username.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                <span className="text-primary/70">@</span>{username}
              </p>
              {profile?.bio ? (
                <p className="text-xs text-muted-foreground truncate">{profile.bio}</p>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs text-muted-foreground">Online · E2E Encrypted</span>
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-52">
                <DropdownMenuItem
                  onSelect={e => {
                    e.preventDefault();
                    const next = !dndEnabled;
                    setDND(next);
                    setDndEnabled(next);
                    toast.success(next ? 'Do Not Disturb enabled — all sounds muted.' : 'Do Not Disturb disabled.');
                  }}
                  className="gap-2 cursor-pointer"
                >
                  {dndEnabled
                    ? <BellOff className="w-3.5 h-3.5 text-amber-500" />
                    : <Bell className="w-3.5 h-3.5" />
                  }
                  <span className={dndEnabled ? 'text-amber-500 font-medium' : ''}>
                    {dndEnabled ? 'DND: On — tap to disable' : 'Do Not Disturb'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={e => { e.preventDefault(); setShowFingerprint(v => !v); }}
                  className="gap-2 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showFingerprint ? 'Hide' : 'View'} Key Fingerprint
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={e => { e.preventDefault(); navigate('/settings'); onClose?.(); }}
                  className="gap-2 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={e => { e.preventDefault(); if (onLogout) setTimeout(onLogout, 0); }}
                  className="gap-2 cursor-pointer text-muted-foreground"
                >
                  <LogOut className="w-3.5 h-3.5" />Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Fingerprint panel */}
          {showFingerprint && (
            <div className="mt-2 mx-2 bg-primary/5 border border-primary/15 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-medium text-sidebar-foreground">Your Key Fingerprint</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary transition-colors ml-auto shrink-0">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-72 p-3 text-xs leading-relaxed">
                    <p className="font-semibold text-foreground mb-1.5">What is a Key Fingerprint?</p>
                    <p className="text-muted-foreground mb-2">
                      A unique hash of your public encryption key. Share it with your contact
                      out-of-band (phone, in-person) — if both match, your conversation is genuinely E2E encrypted with no man-in-the-middle.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="fingerprint text-primary/80">{fingerprint}</p>
            </div>
          )}
        </div>

        {/* ── Scrollable nav ── */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-0.5">

          {/* ── Contact search ── */}
          <div className="px-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contacts… (Ctrl+K)"
                className="w-full h-8 pl-8 pr-3 text-xs bg-sidebar-accent border border-sidebar-border rounded-lg text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* ── Incoming Requests ── */}
          <div className="px-2">
            <button
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
              onClick={() => setShowIncoming(v => !v)}
            >
              <div className="flex items-center gap-2">
                {showIncoming ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Incoming Requests</span>
                {(pendingRequests.length) > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
            </button>
            {showIncoming && (
              <div className="space-y-1 mt-1 px-1">
                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2 px-2">No incoming requests.</p>
                ) : (
                  <>
                    {pendingRequests.map(req => (
                    <div key={req.id} className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                          <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            {(req.senderUsername ?? '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-sidebar-foreground truncate">
                            <span className="text-muted-foreground">@</span>{req.senderUsername ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">wants to connect</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(req)}
                          disabled={handlingId === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium h-8 rounded-lg transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          disabled={handlingId === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-sidebar-accent border border-border text-sidebar-foreground text-xs font-medium h-8 rounded-lg transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />Decline
                        </button>
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Outgoing Requests ── */}
          <div className="px-2">
            <button
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
              onClick={() => setShowOutgoing(v => !v)}
            >
              <div className="flex items-center gap-2">
                {showOutgoing ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <SendHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Outgoing Requests</span>
                {outgoingRequests.length > 0 && (
                  <span className="ml-1 bg-muted text-muted-foreground text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {outgoingRequests.length}
                  </span>
                )}
              </div>
            </button>
            {showOutgoing && (
              <div className="space-y-1 mt-1 px-1">
                {outgoingRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2 px-2">No outgoing requests.</p>
                ) : (
                  outgoingRequests.map(req => (
                    <div key={req.id} className="bg-sidebar-accent border border-border rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">
                          <span className="text-muted-foreground">@</span>{req.receiverUsername ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending acceptance</p>
                      </div>
                      <button
                        onClick={() => handleCancelRequest(req)}
                        disabled={handlingId === req.id}
                        className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 shrink-0 px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
                      >
                        <X className="w-3 h-3" />Cancel
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* ── Contacts / Conversations ── */}
          <div className="px-2">
            
            {/* Conversations / Contacts Section */}
            <div className="flex items-center justify-between px-2 py-1.5 mt-4">
              <button
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
                onClick={() => setShowContacts(v => !v)}
              >
                {showContacts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                CONTACTS
                <span className="text-muted-foreground font-normal normal-case tracking-normal">({filteredContacts.length})</span>
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => setAddContactOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-sidebar-accent transition-colors"
                  title="Add contact"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setQrDialogOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-sidebar-accent transition-colors"
                  title="QR code contact exchange"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showContacts && (
              <div className="space-y-0.5 mt-1 px-1">
                {sortedContacts.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-xs">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No contacts found.</p>
                  </div>
                ) : (
                  sortedContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left hover:bg-sidebar-accent border border-transparent"
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                          {contact.avatarUrl ? (
                            <img src={contact.avatarUrl} alt={contact.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-sm">
                              {contact.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-0.5 gap-2">
                          <p className="text-sm font-semibold text-sidebar-foreground truncate">
                            {contactDisplayName(contact)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{contact.bio || `Hi! I am ${contact.username}`}</p>
                      </div>
                      <div className="shrink-0 flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setRemoveTarget(contact)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from contacts
                            </DropdownMenuItem>
                            {blockedIds?.includes(contact.id) ? (
                              <DropdownMenuItem
                                onSelect={async () => {
                                  try {
                                    const { error } = await unblockUser(contact.id);
                                    if (error) throw new Error(error);
                                    toast.success(`Unblocked @${contact.username}`);
                                    onRequestHandled?.(); // refresh requests/blocks
                                  } catch (err) {
                                    toast.error((err as Error).message || 'Failed to unblock user.');
                                  }
                                }}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                Unblock
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setBlockTarget(contact)}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                Block
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            
          </div>
        </div>

        {/* Footer ── */}
        <div className="shrink-0 px-3 py-3 border-t border-sidebar-border space-y-2">
          <div className="text-center space-y-0.5">
            {!hideBuyCoffee && <BuyMeACoffee />}
            <p className="text-xs text-muted-foreground/50 font-mono">{APP_VERSION}</p>
            <p className="text-xs text-muted-foreground/35">Developed by Forestritium</p>
          </div>
        </div>
      </div>

      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        currentUserId={currentUserId}
        myPublicKeyBase64={myPublicKeyBase64}
        prefillUsername={addContactPrefill}
        prefillQrToken={addContactQrToken}
        prefillQrFingerprint={addContactQrFingerprint}
        onContactAdded={() => {
          setAddContactOpen(false);
          setAddContactPrefill('');
          setAddContactQrToken(null);
          setAddContactQrFingerprint(null);
          onContactsChange();
          onRequestHandled?.();
        }}
      />

      <QRContactDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        userId={currentUserId}
        username={username}
        myPublicKeyBase64={myPublicKeyBase64}
        onUsernameScanned={(scanned, qrToken, qrFingerprint) => {
          setAddContactPrefill(scanned);
          setAddContactQrToken(qrToken);
          setAddContactQrFingerprint(qrFingerprint);
          setAddContactOpen(true);
        }}
      />

      {/* Remove Contact confirmation */}

      <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive shrink-0" />
              Remove @{removeTarget?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              This will remove <strong>@{removeTarget?.username}</strong> from your contacts and
              permanently delete all message history with them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemoveContact(removeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User confirmation */}
      <AlertDialog open={!!blockTarget} onOpenChange={open => { if (!open) { setBlockTarget(null); setNotifyBlocked(false); } }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4 shrink-0" />
              Block @{blockTarget?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              Blocking <strong>@{blockTarget?.username}</strong> will prevent them from sending
              you messages or contact requests. They will be hidden from your contacts list.
              You can unblock them later from the Blocked Users section.
            </AlertDialogDescription>
            <div className="mt-4 flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="notifyBlocked" 
                checked={notifyBlocked} 
                onChange={(e) => setNotifyBlocked(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="notifyBlocked" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Notify user that they were blocked
              </label>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockTarget && handleBlockContact(blockTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notification badge placeholder for mobile — rendered in parent */}
      <span className="hidden" data-notification-count={pendingRequests.length} />
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  if (props.isMobileList) {
    return (
      <div className="flex flex-col w-full h-full bg-sidebar border-none">
        <SidebarContent {...props} />
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-border h-full bg-sidebar">
        <SidebarContent {...props} onCollapseDesktop={props.onCollapseDesktop} />
      </aside>

      {/* Mobile drawer — Sheet's built-in close button hidden; X button lives inside SidebarContent header */}
      <Sheet open={props.isOpen} onOpenChange={open => !open && props.onClose()}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r border-sidebar-border [&>button:first-of-type]:hidden duration-300 ease-in-out">
          {/* Visually-hidden title + description satisfy Radix accessibility requirements */}
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation sidebar</SheetDescription>
          <SidebarContent {...props} onClose={props.onClose} isMobile />
        </SheetContent>
      </Sheet>
    </>
  );
}
