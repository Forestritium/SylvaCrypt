import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, public_profiles!contacts_contact_id_fkey(avatar_url, bio)')
    .limit(1);
  console.log('data:', data);
  console.log('error:', error);
}

test();
