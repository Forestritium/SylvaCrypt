DROP VIEW IF EXISTS public_profiles;
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    username,
    public_key,
    CASE
        WHEN bio_private = 'true'::jsonb THEN NULL::text
        WHEN jsonb_typeof(bio_private) = 'array'::text THEN
        CASE
            WHEN (( SELECT auth.uid()::text AS uid) IN ( SELECT jsonb_array_elements_text(profiles.bio_private) AS jsonb_array_elements_text)) THEN bio
            ELSE NULL::text
        END
        ELSE bio
    END AS bio,
    CASE
        WHEN avatar_private = 'true'::jsonb THEN NULL::text
        WHEN jsonb_typeof(avatar_private) = 'array'::text THEN
        CASE
            WHEN (( SELECT auth.uid()::text AS uid) IN ( SELECT jsonb_array_elements_text(profiles.avatar_private) AS jsonb_array_elements_text)) THEN avatar_url
            ELSE NULL::text
        END
        ELSE avatar_url
    END AS avatar_url,
    discoverable,
    created_at
FROM profiles;

GRANT SELECT ON public_profiles TO authenticated;
GRANT SELECT ON public_profiles TO anon;