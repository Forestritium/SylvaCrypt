-- Fix public_profiles view to hide bio when bio_private is true
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker = false) AS
SELECT 
    id, 
    username, 
    public_key, 
    CASE WHEN bio_private THEN NULL ELSE bio END AS bio, 
    bio_private, 
    created_at, 
    CASE WHEN avatar_private THEN NULL ELSE avatar_url END AS avatar_url,
    avatar_private, 
    discoverable
FROM public.profiles;

-- Add size constraint to public_themes config to prevent unbounded JSONB payloads
ALTER TABLE public.public_themes
ADD CONSTRAINT public_themes_config_size_check 
CHECK (octet_length(config::text) < 524288);
