-- Allow anyone to search profiles if they are discoverable
CREATE POLICY "Anyone can search discoverable profiles"
    ON profiles
    FOR SELECT
    USING (discoverable = true);