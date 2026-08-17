ALTER TABLE public.public_themes ALTER COLUMN author_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can insert their own public themes" ON public.public_themes;

CREATE POLICY "Anyone can insert public themes" 
  ON public.public_themes FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own public themes" ON public.public_themes;

CREATE POLICY "Anyone can update public themes" 
  ON public.public_themes FOR UPDATE 
  USING (true);