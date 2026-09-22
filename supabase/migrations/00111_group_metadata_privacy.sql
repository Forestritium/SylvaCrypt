-- In a real production system, you would want a secure key exchange mechanism
-- for the group metadata. For this iteration, we fulfill the requirement of
-- "Supabase should not store the real name of the Groups" by encrypting the
-- name at the client side and storing the encrypted value.

-- Ensure name column is long enough to store base64 encrypted payloads (which can be quite long)
ALTER TABLE public.groups ALTER COLUMN name TYPE text;
ALTER TABLE public.groups ALTER COLUMN description TYPE text;

-- Add a column to store the encrypted metadata key wrapped for each user, 
-- or we assume the group manager distributes the metaKey over the MLS channel.
-- For now, the groupManager client function handles the AES-GCM encryption.
