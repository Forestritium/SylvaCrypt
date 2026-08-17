CREATE TABLE IF NOT EXISTS public.group_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_poll_votes (
  poll_id uuid REFERENCES public.group_polls(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view polls" ON public.group_polls
    FOR SELECT USING (public.is_group_member(group_id));

CREATE POLICY "Group admins can insert polls" ON public.group_polls
    FOR INSERT WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "Group members can view votes" ON public.group_poll_votes
    FOR SELECT USING (EXISTS(
        SELECT 1 FROM public.group_polls 
        WHERE id = poll_id AND public.is_group_member(group_id)
    ));

CREATE POLICY "Group members can vote" ON public.group_poll_votes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS(SELECT 1 FROM public.group_polls WHERE id = poll_id AND public.is_group_member(group_id))
    );

CREATE POLICY "Group members can update vote" ON public.group_poll_votes
    FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_poll_votes;
