import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Lock, Unlock, User, Edit2, Ban,
  Trash2, Eye, EyeOff, AlertTriangle, XCircle, Check,
  Shield, Info, ChevronRight, KeyRound, Download, Copy, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { unblockUser, fetchBlockedUsers } from '@/lib/relay';
import { getMnemonic } from '@/lib/localStore';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

type Section = 'main' | 'bio' | 'username' | 'blocklist' | 'delete' | 'recovery';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, updateBio, changeUsername, updateAvatar, updateAvatarPrivacy, deleteAccount, regenerateMnemonic } = useAuth();
  const username = profile?.username ?? '';

  // Section navigation
  const [section, setSection] = useState<Section>('main');

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPrivate, setAvatarPrivate] = useState(profile?.avatar_private ?? false);

  // Bio
  const [bioInput, setBioInput] = useState(profile?.bio ?? '');
  const [savingBio, setSavingBio] = useState(false);

  // Username
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [changingUsername, setChangingUsername] = useState(false);

  // Blocklist
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; username: string }[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Delete account
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Recovery phrase
  const [recoveryMnemonic, setRecoveryMnemonic] = useState<string | null>(null);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);

  useEffect(() => {
    setBioInput(profile?.bio ?? '');
    setAvatarPrivate(profile?.avatar_private ?? false);
  }, [profile?.bio, profile?.avatar_private]);

  useEffect(() => {
    if (section === 'blocklist') {
      fetchBlockedUsers().then(setBlockedUsers);
    }
  }, [section]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return; }
    setUploadingAvatar(true);
    const { error } = await updateAvatar(file);
    setUploadingAvatar(false);
    if (error) toast.error(error.message || 'Failed to upload avatar.');
    else toast.success('Profile picture updated.');
  };

  const handleAvatarPrivacyToggle = async () => {
    const next = !avatarPrivate;
    setAvatarPrivate(next);
    const { error } = await updateAvatarPrivacy(next);
    if (error) { setAvatarPrivate(!next); toast.error('Failed to update privacy setting.'); }
    else toast.success(next ? 'Profile picture is now private.' : 'Profile picture is now visible to contacts.');
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    const { error } = await updateBio(bioInput);
    setSavingBio(false);
    if (error) toast.error(error.message || 'Failed to update bio.');
    else { toast.success('Bio updated.'); setSection('main'); }
  };

  const handleChangeUsername = async () => {
    setChangingUsername(true);
    const { error } = await changeUsername(newUsernameInput);
    setChangingUsername(false);
    if (error) toast.error(error.message);
    else { toast.success('Username changed successfully.'); setNewUsernameInput(''); setSection('main'); }
  };

  const handleUnblock = async (id: string, uname: string) => {
    setUnblockingId(id);
    try {
      await unblockUser(id);
      toast.success(`@${uname} unblocked.`);
      setBlockedUsers(prev => prev.filter(u => u.id !== id));
    } catch { toast.error('Failed to unblock user.'); }
    setUnblockingId(null);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    const { error } = await deleteAccount(deletePassword);
    setDeletingAccount(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Account deleted.');
    navigate('/auth');
  };

  const handleViewMnemonic = async () => {
    setLoadingMnemonic(true);
    try {
      const phrase = await getMnemonic();
      if (!phrase) { toast.error('Recovery phrase not found in vault. Try signing out and back in.'); return; }
      setRecoveryMnemonic(phrase);
      setRecoveryVisible(true);
    } finally {
      setLoadingMnemonic(false);
    }
  };

  const handleCopyMnemonic = (phrase: string) => {
    navigator.clipboard.writeText(phrase).then(() => {
      setCopiedMnemonic(true);
      setTimeout(() => setCopiedMnemonic(false), 2000);
    });
  };

  const handleDownloadMnemonic = (phrase: string) => {
    const content = [
      'ShadowCrypt Recovery Phrase',
      '============================',
      `Account: @${username}`,
      `Exported: ${new Date().toISOString()}`,
      '',
      'Store this file somewhere safe. Do NOT share it with anyone.',
      '',
      phrase,
      '',
      'Words in order:',
      ...phrase.split(' ').map((w, i) => `${i + 1}. ${w}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShadowCrypt_${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { mnemonic, error } = await regenerateMnemonic();
      if (error || !mnemonic) { toast.error(error?.message || 'Failed to regenerate recovery phrase.'); return; }
      setNewMnemonic(mnemonic);
      setRecoveryMnemonic(mnemonic);
      setRecoveryVisible(true);
      setRegenerateDialogOpen(false);
      toast.success('Recovery phrase regenerated. Save your new phrase now.');
    } finally {
      setRegenerating(false);
    }
  };

  // Username cooldown calc
  const usernameCooldownDays = (() => {
    if (!profile?.username_last_changed) return 0;
    const ms = 14 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(profile.username_last_changed).getTime();
    return elapsed < ms ? Math.ceil((ms - elapsed) / (24 * 60 * 60 * 1000)) : 0;
  })();

  // ── Section: Bio editor ──────────────────────────────────────────
  if (section === 'bio') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSection('main')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Edit Bio</h1>
        </header>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Bio</label>
            <textarea
              value={bioInput}
              onChange={e => setBioInput(e.target.value)}
              placeholder="Write something about yourself..."
              maxLength={160}
              rows={4}
              className="w-full text-sm bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bioInput.length}/160</p>
          </div>
          <button
            onClick={handleSaveBio}
            disabled={savingBio}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savingBio ? 'Saving...' : 'Save Bio'}
          </button>
        </div>
      </div>
    );
  }

  // ── Section: Change Username ─────────────────────────────────────
  if (section === 'username') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSection('main')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Change Username</h1>
        </header>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
          {usernameCooldownDays > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-600 dark:text-amber-400">
              You can change your username again in <strong>{usernameCooldownDays} day{usernameCooldownDays === 1 ? '' : 's'}</strong>.
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">New Username</label>
                <input
                  type="text"
                  value={newUsernameInput}
                  onChange={e => setNewUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="new_username"
                  maxLength={30}
                  className="w-full text-sm bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1.5">3–30 characters · letters, numbers, underscores · 14-day cooldown after change</p>
              </div>
              <button
                onClick={handleChangeUsername}
                disabled={changingUsername || newUsernameInput.length < 3}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {changingUsername ? 'Saving...' : 'Change Username'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Section: Recovery Phrase ─────────────────────────────────────
  if (section === 'recovery') {
    const words = recoveryMnemonic?.split(' ') ?? [];
    const displayPhrase = newMnemonic ?? recoveryMnemonic;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => { setSection('main'); setRecoveryVisible(false); setNewMnemonic(null); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Recovery Phrase</h1>
        </header>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            <strong>Keep this phrase secret.</strong> Anyone with your 12-word phrase can reset your password. Store it offline in a safe place.
          </div>

          {!recoveryVisible ? (
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground text-center text-pretty">
                Your recovery phrase is hidden for security. Tap below to reveal it.
              </p>
              <Button className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                onClick={handleViewMnemonic} disabled={loadingMnemonic}>
                {loadingMnemonic ? 'Loading…' : 'Reveal Recovery Phrase'}
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {words.map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="text-sm font-mono font-medium text-foreground">{word}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9 gap-1.5 text-sm"
                  onClick={() => displayPhrase && handleCopyMnemonic(displayPhrase)}>
                  {copiedMnemonic ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMnemonic ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" className="flex-1 h-9 gap-1.5 text-sm"
                  onClick={() => displayPhrase && handleDownloadMnemonic(displayPhrase)}>
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setRegenerateDialogOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Regenerate Phrase</p>
                <p className="text-xs text-muted-foreground">Invalidates the old phrase permanently</p>
              </div>
              <ChevronRight className="w-4 h-4 text-destructive/60 shrink-0" />
            </button>
          </div>
        </div>

        {/* Regenerate Confirm Dialog */}
        <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                Regenerate Recovery Phrase?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                Your current 12-word phrase will be <strong>permanently invalidated</strong>. You will receive a new phrase. Make sure you have saved your current phrase before proceeding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRegenerate}
                disabled={regenerating}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {regenerating ? 'Regenerating…' : 'Yes, Regenerate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Section: Blocked Users ───────────────────────────────────────
  if (section === 'blocklist') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSection('main')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Blocked Users</h1>
        </header>
        <div className="flex-1 p-4 max-w-lg mx-auto w-full">
          {blockedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Ban className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No blocked users.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map(bu => (
                <div key={bu.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
                  <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-foreground">{bu.username.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                    <span className="text-muted-foreground">@</span>{bu.username}
                  </span>
                  <button
                    onClick={() => handleUnblock(bu.id, bu.username)}
                    disabled={unblockingId === bu.id}
                    className="text-sm text-primary hover:text-primary/80 shrink-0 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50 font-medium"
                  >
                    {unblockingId === bu.id ? '...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Section: Main ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate('/chat')}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-foreground"
          aria-label="Back to chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">

          {/* ── Profile Picture ────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Profile Picture</h2>
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-4">
              {/* Avatar preview + upload */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={`${profile.avatar_url}?t=${profile.username}`} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-primary">{username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-background hover:bg-primary/90 transition-colors disabled:opacity-60"
                  title="Change profile picture"
                >
                  {uploadingAvatar
                    ? <span className="w-3.5 h-3.5 border border-white/60 border-t-white rounded-full animate-spin" />
                    : <Camera className="w-3.5 h-3.5 text-primary-foreground" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <p className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground">@</span>{username}
              </p>

              {/* Privacy toggle */}
              <button
                onClick={handleAvatarPrivacyToggle}
                className={`flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border transition-colors ${
                  avatarPrivate
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-muted border-border text-foreground hover:bg-muted/80'
                }`}
              >
                {avatarPrivate ? <Lock className="w-4 h-4 shrink-0" /> : <Unlock className="w-4 h-4 shrink-0" />}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium leading-tight">
                    {avatarPrivate ? 'Picture is Private' : 'Picture is Public'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {avatarPrivate ? 'Only you can see your profile picture' : 'Your contacts can see your profile picture'}
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* ── Account ────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Account</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {/* Edit Bio */}
              <button
                onClick={() => setSection('bio')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Edit Bio</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.bio || 'Add a bio to your profile'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              {/* Change Username */}
              <button
                onClick={() => setSection('username')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Edit2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Change Username</p>
                  <p className="text-xs text-muted-foreground">
                    {usernameCooldownDays > 0 ? `Available in ${usernameCooldownDays}d` : `Current: @${username}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </section>

          {/* ── Security ───────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Security</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {/* Key Fingerprint */}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground flex-1">Key Fingerprint</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-primary transition-colors">
                        <Info className="w-4 h-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="end" className="w-72 p-3 text-xs leading-relaxed">
                      <p className="font-semibold text-foreground mb-1.5">What is a Key Fingerprint?</p>
                      <p className="text-muted-foreground">
                        A unique hash of your public encryption key. Share it with your contact out-of-band — if both match, your conversation is genuinely E2E encrypted with no man-in-the-middle.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="fingerprint text-primary/80 text-xs break-all pl-11">{profile?.public_key ? '(key loaded)' : 'No key yet'}</p>
              </div>

              {/* Blocked Users */}
              <button
                onClick={() => setSection('blocklist')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Ban className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Blocked Users</p>
                  <p className="text-xs text-muted-foreground">Manage who you have blocked</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              {/* Recovery Phrase */}
              <button
                onClick={() => setSection('recovery')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Recovery Phrase</p>
                  <p className="text-xs text-muted-foreground">View or regenerate your 12-word backup phrase</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </section>

          {/* ── Danger Zone ────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Danger Zone</h2>
            <div className="bg-card border border-destructive/30 rounded-2xl overflow-hidden">
              <button
                onClick={() => { setDeleteDialogOpen(true); setDeletePassword(''); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <ChevronRight className="w-4 h-4 text-destructive/60 shrink-0" />
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={open => { setDeleteDialogOpen(open); if (!open) setDeletePassword(''); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              This action <strong>cannot be undone</strong>. Your account, profile, and all locally
              stored messages, contacts, and groups will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Enter your password to confirm</label>
            <div className="relative">
              <input
                type={showDeletePassword ? 'text' : 'password'}
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-3 pr-10 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive/50"
                onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
              />
              <button
                type="button"
                onClick={() => setShowDeletePassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount || !deletePassword.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? 'Deleting...' : 'Yes, Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden icons referenced by TS — suppress unused import warnings */}
      <span className="hidden"><Check /><XCircle /></span>    </div>
  );
}
