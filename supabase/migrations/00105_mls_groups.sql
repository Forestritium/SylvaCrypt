-- MLS Groups Infrastructure

CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Store MLS Group context/state
    mls_epoch BIGINT NOT NULL DEFAULT 0,
    mls_group_id TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Store MLS KeyPackage/Credential mapping
    mls_leaf_index BIGINT,
    mls_signature_key TEXT,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.mls_key_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Base64 encoded KeyPackage bytes
    key_package_bytes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Base64 encoded MLS PublicMessage
    mls_ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mls_key_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Group access: users can only see groups they are members of
CREATE POLICY "Users can view groups they are in" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = groups.id
            AND group_members.user_id = auth.uid()
        )
    );

-- Creating a group is allowed for authenticated users
CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Group members view
CREATE POLICY "Users can view members of their groups" ON public.group_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members my_memberships
            WHERE my_memberships.group_id = group_members.group_id
            AND my_memberships.user_id = auth.uid()
        )
    );

-- Managing group members (very basic, actual MLS handles cryptographic adds)
CREATE POLICY "Group owners can add members" ON public.group_members
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.group_members
            WHERE group_id = group_members.group_id AND role = 'owner'
        ) OR auth.uid() = user_id -- Allow self-join if invited (handled by backend)
    );

-- MLS KeyPackages: Anyone can read active KeyPackages to add users to groups
CREATE POLICY "Anyone can read active KeyPackages" ON public.mls_key_packages
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Users can manage their own KeyPackages" ON public.mls_key_packages
    FOR ALL USING (user_id = auth.uid());

-- Group messages: Members can insert and select
CREATE POLICY "Members can insert group messages" ON public.group_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_messages.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can view group messages" ON public.group_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_messages.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
