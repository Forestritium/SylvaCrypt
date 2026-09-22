DROP VIEW IF EXISTS public_profiles;

ALTER TABLE profiles ALTER COLUMN bio_private DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN avatar_private DROP DEFAULT;

ALTER TABLE profiles ALTER COLUMN bio_private TYPE jsonb USING to_jsonb(bio_private);
ALTER TABLE profiles ALTER COLUMN avatar_private TYPE jsonb USING to_jsonb(avatar_private);

ALTER TABLE profiles ALTER COLUMN bio_private SET DEFAULT 'false'::jsonb;
ALTER TABLE profiles ALTER COLUMN avatar_private SET DEFAULT 'false'::jsonb;

-- Recreate public_profiles view
CREATE OR REPLACE VIEW public_profiles WITH (security_invoker = true) AS
SELECT
    id,
    username,
    public_key,
    CASE 
      WHEN bio_private = 'true'::jsonb THEN NULL 
      WHEN jsonb_typeof(bio_private) = 'array' THEN
        CASE WHEN (SELECT auth.uid()::text) IN (SELECT jsonb_array_elements_text(bio_private)) THEN bio
        ELSE NULL END
      ELSE bio 
    END as bio,
    CASE 
      WHEN avatar_private = 'true'::jsonb THEN NULL 
      WHEN jsonb_typeof(avatar_private) = 'array' THEN
        CASE WHEN (SELECT auth.uid()::text) IN (SELECT jsonb_array_elements_text(avatar_private)) THEN avatar_url
        ELSE NULL END
      ELSE avatar_url 
    END as avatar_url,
    discoverable,
    created_at
FROM profiles;