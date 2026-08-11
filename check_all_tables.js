import { createClient } from '@supabase/supabase-js';

const url = 'https://eojfpequxoxunmxejquy.supabase.co';
const key = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

const supabase = createClient(url, key);

async function run() {
  const tables = ['contacts', 'orders', 'products', 'stocks', 'contractors', 'contractor_jobs', 'contractor_transactions', 'settings'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.log(`❌ Table ${table} error:`, error.message);
    } else {
      console.log(`✅ Table ${table} count:`, data ? data.length : 0);
      if (data && data.length > 0) {
        console.log(`   Sample:`, JSON.stringify(data[0]).substring(0, 200));
      }
    }
  }
}

run();
