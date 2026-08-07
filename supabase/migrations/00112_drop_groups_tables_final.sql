-- Drop all group related tables and functions

DROP TABLE IF EXISTS public.group_poll_votes CASCADE;
DROP TABLE IF EXISTS public.group_polls CASCADE;
DROP TABLE IF EXISTS public.group_invites CASCADE;
DROP TABLE IF EXISTS public.group_messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.mls_key_packages CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;

DROP FUNCTION IF EXISTS public.is_group_member CASCADE;
DROP FUNCTION IF EXISTS public.is_group_owner CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin CASCADE;
DROP FUNCTION IF EXISTS public.handle_group_invite CASCADE;
DROP FUNCTION IF EXISTS public.send_group_message CASCADE;
DROP FUNCTION IF EXISTS public.create_mls_group CASCADE;

-- Also remove them from realtime publication if they exist
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_messages;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_invites;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_polls;
  EXCEPTION WHEN OTHERS THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_poll_votes;
  EXCEPTION WHEN OTHERS THEN END;
END $$;
