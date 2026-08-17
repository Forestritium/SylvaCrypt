ALTER TABLE public.public_themes DROP CONSTRAINT IF EXISTS public_themes_config_size_check;
ALTER TABLE public.public_themes ADD CONSTRAINT public_themes_config_size_check CHECK (octet_length(config::text) < 5242880);
