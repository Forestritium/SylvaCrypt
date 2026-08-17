-- Drop MLS and Group related tables and functions
DROP TABLE IF EXISTS group_invites CASCADE;
DROP TABLE IF EXISTS group_messages CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS mls_key_packages CASCADE;

-- Drop group-related functions if they exist
DROP FUNCTION IF EXISTS handle_group_invite CASCADE;
DROP FUNCTION IF EXISTS send_group_message CASCADE;
DROP FUNCTION IF EXISTS create_mls_group CASCADE;
