import { createClient } from '@supabase/supabase-js';

const url = 'https://eojfpequxoxunmxejquy.supabase.co';
const key = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

console.log('Attempting to connect to Supabase...');
console.log('URL:', url);
console.log('Key:', key.substring(0, 20) + '...');

try {
  const supabase = createClient(url, key);
  console.log('\n✅ Client created successfully');

  // Check contacts table
  console.log('\n--- Checking contacts table ---');
  const { data: contacts, error: contactsErr } = await supabase.from('contacts').select('*');
  if (contactsErr) {
    console.error('❌ contacts error:', contactsErr.message, contactsErr.code, contactsErr.hint);
  } else {
    console.log(`✅ contacts: ${(contacts || []).length} rows found`);
    if (contacts && contacts.length > 0) {
      contacts.forEach(c => {
        const ownerCompany = c.data ? c.data._ownerCompany : 'NO DATA FIELD';
        const name = c.data ? c.data.name : 'NO NAME';
        console.log(`   - id:${c.id}, name:"${name}", _ownerCompany:"${ownerCompany}"`);
      });
    }
  }

  // Check orders table
  console.log('\n--- Checking orders table ---');
  const { data: orders, error: ordersErr } = await supabase.from('orders').select('*');
  if (ordersErr) {
    console.error('❌ orders error:', ordersErr.message, ordersErr.code, ordersErr.hint);
  } else {
    console.log(`✅ orders: ${(orders || []).length} rows found`);
  }

  // Check settings table for saas_registered_workshops
  console.log('\n--- Checking settings table (saas_registered_workshops) ---');
  const { data: workshopSettings, error: wsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'saas_registered_workshops')
    .maybeSingle();
  if (wsErr) {
    console.error('❌ settings error:', wsErr.message, wsErr.code, wsErr.hint);
  } else if (workshopSettings) {
    console.log('✅ saas_registered_workshops found:', JSON.stringify(workshopSettings, null, 2));
  } else {
    console.log('⚠️ saas_registered_workshops NOT FOUND in settings table');
  }

  // Check settings table for migration_completed
  console.log('\n--- Checking migration_completed ---');
  const { data: migrationData, error: migErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'migration_completed')
    .maybeSingle();
  if (migErr) {
    console.error('❌ migration_completed error:', migErr.message, migErr.code, migErr.hint);
  } else if (migrationData) {
    console.log('✅ migration_completed:', JSON.stringify(migrationData, null, 2));
  } else {
    console.log('⚠️ migration_completed NOT FOUND');
  }

  // Check stocks table
  console.log('\n--- Checking stocks table ---');
  const { data: stocks, error: stocksErr } = await supabase.from('stocks').select('*');
  if (stocksErr) {
    console.error('❌ stocks error:', stocksErr.message, stocksErr.code, stocksErr.hint);
  } else {
    console.log(`✅ stocks: ${(stocks || []).length} rows found`);
  }

  // Check products table
  console.log('\n--- Checking products table ---');
  const { data: products, error: productsErr } = await supabase.from('products').select('*');
  if (productsErr) {
    console.error('❌ products error:', productsErr.message, productsErr.code, productsErr.hint);
  } else {
    console.log(`✅ products: ${(products || []).length} rows found`);
  }

  // Check all settings
  console.log('\n--- All settings ---');
  const { data: allSettings, error: allSettErr } = await supabase.from('settings').select('*');
  if (allSettErr) {
    console.error('❌ all settings error:', allSettErr.message, allSettErr.code, allSettErr.hint);
  } else {
    console.log(`✅ settings: ${(allSettings || []).length} rows`);
    (allSettings || []).forEach(s => {
      console.log(`   - id:"${s.id}", data:`, JSON.stringify(s.data).substring(0, 100));
    });
  }

} catch (e) {
  console.error('❌ CRITICAL ERROR:', e.message);
  console.error(e);
}
