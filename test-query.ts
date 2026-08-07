import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, public_profiles!contacts_contact_id_fkey(avatar_url, bio)')
    .limit(2);
  console.log(JSON.stringify(data, null, 2));
  console.log('Error:', error);
}
run();
