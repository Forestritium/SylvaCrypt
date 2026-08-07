import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/db/supabase';
import {
  getUserPublicKey,
  findUserByUsername,
  blockUser,
  unblockUser,
  fetchBlockedUserIds,
  sendContactRequest,
  acceptContactRequest
} from '../relay';

// Mock Supabase client
vi.mock('@/db/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn()
    },
    rpc: vi.fn(),
    channel: vi.fn()
  }
}));

// Mock localStore functions
vi.mock('../localStore', () => ({
  getIdentityKeyPair: vi.fn().mockResolvedValue({
    pubKey: new Uint8Array(32),
    privKey: new Uint8Array(32)
  })
}));

// Mock double ratchet
vi.mock('../doubleRatchet', () => ({
  initSessionSender: vi.fn().mockResolvedValue({}),
  initSessionReceiver: vi.fn().mockResolvedValue({}),
  ratchetEncrypt: vi.fn().mockResolvedValue({ ciphertext: 'mock', header: {} }),
  ratchetDecrypt: vi.fn().mockResolvedValue('decrypted')
}));

// Mock crypto
vi.mock('../crypto', () => ({
  toBase64: vi.fn().mockReturnValue('mock-base64'),
  fromBase64: vi.fn().mockReturnValue(new Uint8Array(32)),
  computeFingerprint: vi.fn().mockResolvedValue('mock-fingerprint')
}));

describe('Relay Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserPublicKey', () => {
    it('returns public_key when profile exists', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { public_key: 'test-key' } });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await getUserPublicKey('user-1');
      expect(result).toBe('test-key');
      expect(supabase.from).toHaveBeenCalledWith('public_profiles');
    });

    it('returns null when profile not found', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await getUserPublicKey('unknown-user');
      expect(result).toBeNull();
    });
  });

  describe('findUserByUsername', () => {
    it('returns user details ignoring case', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'user-1', public_key: 'test-key', username: 'TestUser' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockIlike = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await findUserByUsername('testuser');
      expect(result).toEqual({ id: 'user-1', public_key: 'test-key', username: 'TestUser' });
    });
  });

  describe('blockUser and unblockUser', () => {
    it('blocks a user correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'me' } } } as any);
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

      const res = await blockUser('bad-user');
      expect(res.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('blocked_users');
      expect(mockInsert).toHaveBeenCalledWith({ blocker_id: 'me', blocked_id: 'bad-user' });
    });

    it('unblocks a user correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'me' } } } as any);
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any);

      const res = await unblockUser('bad-user');
      expect(res.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('blocked_users');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith('blocker_id', 'me');
      expect(mockEq2).toHaveBeenCalledWith('blocked_id', 'bad-user');
    });

    it('fetches blocked user ids correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'me' } } } as any);
      const mockSelect = vi.fn().mockResolvedValue({ data: [{ blocked_id: 'bad-1' }, { blocked_id: 'bad-2' }] });
      
      // Fix for mocked override chaining
      vi.mocked(supabase.from).mockImplementation((table: any) => {
        if (table === 'blocked_users') return { select: mockSelect } as any;
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) } as any;
      });

      const ids = await fetchBlockedUserIds();
      expect(ids).toEqual(['bad-1', 'bad-2']);
    });
  });

  describe('sendContactRequest', () => {
    it('sends contact request correctly', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'me' } } } as any);
      
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { username: 'MyUsername' } });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      const mockDeleteEq3 = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteEq2 = vi.fn().mockReturnValue({ eq: mockDeleteEq3 });
      const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });

      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'public_profiles') {
          return { select: mockSelect } as any;
        }
        if (table === 'contact_requests') {
          return { insert: mockInsert, delete: mockDelete } as any;
        }
        return {} as any;
      });

      const res = await sendContactRequest('target-user', 'target-key');
      expect(res.error).toBeNull();
      expect(mockInsert).toHaveBeenCalled();
    });
  });
});
