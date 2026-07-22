import { createClient } from '@supabase/supabase-js';

const url = 'https://eojfpequxoxunmxejquy.supabase.co';
const key = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

const supabase = createClient(url, key);

const tables = ['contacts', 'orders', 'products', 'stocks', 'transactions'];

for (const table of tables) {
  console.log(`\n--- Fixing ${table} ---`);
  const { data: rows, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`  ❌ Error reading ${table}:`, error.message);
    continue;
  }
  
  let fixCount = 0;
  for (const row of (rows || [])) {
    const d = row.data;
    if (!d || !d._ownerCompany || d._ownerCompany === 'undefined') {
      // Fix: set _ownerCompany to Master Admin
      const fixedData = { ...d, _ownerCompany: 'Atölyecim Master' };
      const { error: updateErr } = await supabase
        .from(table)
        .update({ data: fixedData, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      
      if (updateErr) {
        console.error(`  ❌ Failed to fix ${table} id:${row.id}:`, updateErr.message);
      } else {
        fixCount++;
        console.log(`  ✅ Fixed ${table} id:${row.id} → _ownerCompany set to "Atölyecim Master"`);
      }
    }
  }
  console.log(`  Total fixed in ${table}: ${fixCount}/${(rows || []).length}`);
}

console.log('\n🎉 All fixes applied! Verifying...');

// Verify contacts
const { data: contacts } = await supabase.from('contacts').select('*');
console.log('\n--- Verification: contacts ---');
(contacts || []).forEach(c => {
  console.log(`  id:${c.id}, name:"${c.data.name}", _ownerCompany:"${c.data._ownerCompany}"`);
});
