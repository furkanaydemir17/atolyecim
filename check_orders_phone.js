import { createClient } from '@supabase/supabase-js';

const url = 'https://eojfpequxoxunmxejquy.supabase.co';
const key = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

const supabase = createClient(url, key);

async function run() {
  console.log('--- FETCHING RECENT ORDERS ---');
  const { data: orders, error: oErr } = await supabase.from('orders').select('*').limit(10);
  if (oErr) {
    console.error('Error fetching orders:', oErr);
    return;
  }

  console.log(`Found ${orders.length} orders:`);
  for (const o of orders) {
    console.log(`\nOrder ID: #${o.id}`);
    console.log(`Data field:`, JSON.stringify(o.data));
    
    const contactId = o.data ? o.data.contactId : null;
    console.log(`Contact ID in order:`, contactId, typeof contactId);
    
    if (contactId) {
      const { data: contact, error: cErr } = await supabase.from('contacts').select('*').eq('id', contactId).maybeSingle();
      if (cErr) {
        console.error(`  Error fetching contact for ID ${contactId}:`, cErr.message);
      } else if (contact) {
        console.log(`  ✅ Contact found: "${contact.data.name}", Phone: "${contact.data.phone}"`);
      } else {
        console.log(`  ⚠️ Contact NOT found in Supabase for ID ${contactId}`);
      }
    } else {
      console.log(`  No contactId in this order`);
    }
  }
}

run();
