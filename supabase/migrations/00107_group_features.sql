-- Helper function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = target_group_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
$$;

-- Allow admins to update group details
DROP POLICY IF EXISTS "Group owners can update group details" ON public.groups;
CREATE POLICY "Group admins can update group details" ON public.groups
    FOR UPDATE USING (
        public.is_group_admin(id)
    );

-- Allow admins to remove members (cannot remove owners)
CREATE POLICY "Admins can remove members" ON public.group_members
    FOR DELETE USING (
        (public.is_group_admin(group_id) AND role != 'owner') OR auth.uid() = user_id
    );

-- Allow owners to update member roles
CREATE POLICY "Owners can update members" ON public.group_members
    FOR UPDATE USING (
        public.is_group_owner(group_id)
    );

-- Create Group Invites table
CREATE TABLE IF NOT EXISTS public.group_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
    inviter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(group_id, invitee_id)
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invites they sent or received" ON public.group_invites
    FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Admins can insert invites" ON public.group_invites
    FOR INSERT WITH CHECK (
        public.is_group_admin(group_id)
    );

CREATE POLICY "Users can update invites they received" ON public.group_invites
    FOR UPDATE USING (auth.uid() = invitee_id);

CREATE POLICY "Inviter can delete pending invites" ON public.group_invites
    FOR DELETE USING (auth.uid() = inviter_id OR public.is_group_admin(group_id));

-- Add realtime for group_invites
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invites;

