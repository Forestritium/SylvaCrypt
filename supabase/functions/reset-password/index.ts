import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashMnemonic(mnemonic: string): Promise<string> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username, mnemonic, newPassword } = await req.json();
    if (!username || !mnemonic || !newPassword) {
      throw new Error('Missing required fields: username, mnemonic, newPassword');
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up the user's profile by username
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, mnemonic_hash')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();

    if (profileErr || !profile) throw new Error('User not found.');
    if (!profile.mnemonic_hash) throw new Error('No recovery phrase on file for this account.');

    // Verify the mnemonic hash
    const incomingHash = await hashMnemonic(mnemonic);
    if (incomingHash !== profile.mnemonic_hash) {
      throw new Error('Recovery phrase does not match. Please check each word carefully.');
    }

    // Reset the Supabase Auth password using admin client
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });
    if (updateErr) throw new Error(`Failed to reset password: ${updateErr.message}`);

    // Mark the profile as migrated so the migration modal does not re-appear
    const { error: profileUpdateErr } = await adminClient
      .from('profiles')
      .update({ password_version: 1 })
      .eq('id', profile.id);
    if (profileUpdateErr) {
      console.error('Failed to update password_version after reset:', profileUpdateErr);
      // Non-fatal — password was already reset successfully
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
