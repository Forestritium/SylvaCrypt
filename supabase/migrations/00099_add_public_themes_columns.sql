ALTER TABLE public.public_themes 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS mode text DEFAULT 'light',
ADD COLUMN IF NOT EXISTS rating_sum integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;
