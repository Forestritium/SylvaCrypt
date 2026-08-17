ALTER TABLE public.public_themes ALTER COLUMN author_id SET NOT NULL;

DROP POLICY IF EXISTS "Users can insert their own public themes" ON public.public_themes;

CREATE POLICY "Users can insert their own public themes"
  ON public.public_themes FOR INSERT
  WITH CHECK (auth.uid() = author_id);