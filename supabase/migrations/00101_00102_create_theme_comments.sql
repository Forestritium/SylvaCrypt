CREATE TABLE IF NOT EXISTS public.theme_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid REFERENCES public.public_themes(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.theme_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON public.theme_comments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert comments"
  ON public.theme_comments FOR INSERT
  WITH CHECK (true);