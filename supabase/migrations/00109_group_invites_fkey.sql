-- Fix foreign keys for group_invites to reference profiles instead of auth.users
-- This allows Supabase to join properly

ALTER TABLE public.group_invites DROP CONSTRAINT IF EXISTS group_invites_inviter_id_fkey;
ALTER TABLE public.group_invites DROP CONSTRAINT IF EXISTS group_invites_invitee_id_fkey;

ALTER TABLE public.group_invites ADD CONSTRAINT group_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.group_invites ADD CONSTRAINT group_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
