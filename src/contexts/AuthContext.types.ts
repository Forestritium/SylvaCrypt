/**
 * Stable module: contains only the AuthContextType interface and the AuthContext object.
 * Kept separate from AuthContext.tsx so React Fast Refresh never re-evaluates createContext(),
 * which would produce a new context identity and break useAuth() in already-mounted consumers.
 */
import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';
import type { SessionInfo } from '@/lib/session';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: SessionInfo | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  updatePublicKey: (publicKey: string) => Promise<void>;
  updateBio: (bio: string) => Promise<{ error: Error | null }>;
  deleteAccount: (password: string) => Promise<{ error: Error | null }>;
  changeUsername: (newUsername: string) => Promise<{ error: Error | null; daysRemaining?: number }>;
  updateAvatar: (file: File) => Promise<{ error: Error | null; url?: string }>;
  updateAvatarPrivacy: (isPrivate: boolean) => Promise<{ error: Error | null }>;
  migrateToNewPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  generateAndStoreMnemonic: () => Promise<{ mnemonic: string | null; error: Error | null }>;
  regenerateMnemonic: () => Promise<{ mnemonic: string | null; error: Error | null }>;
  resetPasswordWithMnemonic: (username: string, mnemonic: string, newPassword: string) => Promise<{ error: Error | null }>;
}

// createContext lives here — not in AuthContext.tsx — so HMR reloads of the provider
// module never invalidate the context identity that consumers hold onto.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
