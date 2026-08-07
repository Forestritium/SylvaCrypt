-- Fix infinite recursion in group RLS policies
DROP POLICY IF EXISTS "Users can view groups they are in" ON public.groups;
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS "Group owners can add members" ON public.group_members;
DROP POLICY IF EXISTS "Members can insert group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members can view group messages" ON public.group_messages;

-- Create SECURITY DEFINER functions to prevent recursion
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = target_group_id
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(target_group_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = target_group_id
        AND user_id = auth.uid()
        AND role = 'owner'
    );
$$;

-- Apply non-recursive policies
-- Also allow creators to view groups immediately after insert (before member row exists)
CREATE POLICY "Users can view groups they are in or created" ON public.groups
    FOR SELECT USING (
        creator_id = auth.uid() OR public.is_group_member(id)
    );

CREATE POLICY "Users can view members of their groups" ON public.group_members
    FOR SELECT USING (
        public.is_group_member(group_id)
    );

CREATE POLICY "Group owners can add members" ON public.group_members
    FOR INSERT WITH CHECK (
        public.is_group_owner(group_id) OR auth.uid() = user_id
    );

CREATE POLICY "Members can insert group messages" ON public.group_messages
    FOR INSERT WITH CHECK (
        public.is_group_member(group_id)
    );

CREATE POLICY "Members can view group messages" ON public.group_messages
    FOR SELECT USING (
        public.is_group_member(group_id)
    );
