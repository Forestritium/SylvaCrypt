-- Add ON DELETE CASCADE to group_members and group_polls when a group is deleted
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_group_id_fkey;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.group_polls DROP CONSTRAINT IF EXISTS group_polls_group_id_fkey;
ALTER TABLE public.group_polls ADD CONSTRAINT group_polls_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.group_messages DROP CONSTRAINT IF EXISTS group_messages_group_id_fkey;
ALTER TABLE public.group_messages ADD CONSTRAINT group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- Group deletion policy
CREATE POLICY "Group admins can delete groups" ON public.groups
    FOR DELETE USING (
        public.is_group_admin(id)
    );
