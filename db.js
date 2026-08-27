/* =========================================
   ATÖLYECİM — Veritabanı Katmanı (IndexedDB & Supabase)
   ========================================= */

import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
// ⚠️ GÜVENLİK: Bu değerleri doğrudan buraya yazmayın!
// Supabase URL ve Anahtar bilgilerini Yönetici Paneli → Ayarlar bölümüne girin.
// Uygulama localStorage'daki değerleri veya .env dosyasındaki VITE_ değişkenlerini kullanır.
const DEFAULT_SUPABASE_URL = 'https://eojfpequxoxunmxejquy.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

let supabaseClient = null;
let useSupabase = false;

export function initSupabaseClient() {
  const supabaseUrl = localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = localStorage.getItem('supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
  const currentCompany = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';

  try {
    if (supabaseUrl && supabaseKey && supabaseUrl !== '' && !supabaseUrl.includes('your-project-id')) {
      // Base64 encode company name to avoid Turkish char issues in PostgREST headers
      const companyB64 = btoa(unescape(encodeURIComponent(currentCompany)));
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            'x-company-id': companyB64
          }
        }
      });
      window.supabaseClient = supabaseClient;
      useSupabase = true;
      window.dbMode = 'supabase';
      console.log(`Database Mode: Supabase Cloud initialized for tenant: "${currentCompany}"`);
    } else {
      useSupabase = false;
      supabaseClient = null;
      window.supabaseClient = null;
      window.dbMode = 'local';
      console.log('Database Mode: Local IndexedDB enabled');
    }
  } catch (e) {
    console.error('Supabase init error:', e);
    useSupabase = false;
    supabaseClient = null;
    window.supabaseClient = null;
    window.dbMode = 'local';
  }
}

// Bind to window for global access
window.initSupabaseClient = initSupabaseClient;

// Initialize on start
initSupabaseClient();

// Local IndexedDB Settings
const DB_NAME = 'atolyecim_db_v4';
const DB_VERSION = 5;
let db = null;

// Primary key field mappings for different tables
function getKeyField(storeName) {
  if (storeName === 'recipes') return 'productId';
  if (storeName === 'settings') return 'key';
  return 'id';
}

// Map from Supabase row structure { id, data, updated_at } to frontend JS object
function mapFromSupabase(storeName, row) {
  if (!row) return null;
  const keyField = getKeyField(storeName);
  const item = { ...row.data };
  
  if (keyField === 'key') {
    let keyVal = row.id;
    if (storeName === 'settings' && typeof keyVal === 'string') {
      const currentCompany = getCurrentTenantCompany();
      if (keyVal.startsWith(currentCompany + '_')) {
        keyVal = keyVal.substring(currentCompany.length + 1);
      }
    }
    item[keyField] = keyVal;
  } else {
    item[keyField] = Number(row.id); // Bigint ID to number
  }
  return item;
}

// Local IndexedDB fallback CRUD helpers used for offline sync/migration
function localDbGetAll(storeName) {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

// Seed default stocks locally (used if local mode or during local init)
async function seedDefaultStocks() {
  const stocks = await dbGetAll('stocks');
  if (stocks.length > 0) return; // Already has data

  const defaultStocks = [
    { type: 'sole', name: 'Comfort EVA (Siyah)', size: '40-44', qty: 120, limit: 30, location: 'A-12', unit: 'Çift' },
    { type: 'sole', name: 'Klasik Kösele (Taba)', size: '38-43', qty: 15, limit: 20, location: 'B-04', unit: 'Çift' },
    { type: 'accessory', name: 'Metal Toka (Gümüş 2cm)', qty: 850, limit: 200, supplier: 'Yıldız Aksesuar', unit: 'Adet' },
    { type: 'accessory', name: 'Mumlanmış Bağcık (Siyah 120cm)', qty: 120, limit: 50, supplier: 'Özen Bağcık', unit: 'Adet' },
    { type: 'leather', name: 'Vidala Sığır Derisi', color: 'Siyah', qty: 45, limit: 15, quality: '1. Sınıf (A)', unit: 'm²' },
    { type: 'leather', name: 'Süet Astar', color: 'Kahverengi', qty: 8, limit: 10, quality: '2. Sınıf (B)', unit: 'm²' },
    { type: 'raw', name: 'Poliüretan Yapıştırıcı (Solüsyon)', qty: 60, limit: 10, location: 'Kimya Deposu', unit: 'Litre' },
    { type: 'raw', name: 'Mumlanmış Saya İpliği', qty: 40, limit: 5, location: 'İplik Dolabı', unit: 'Bobin' }
  ];

  for (const item of defaultStocks) {
    await dbAdd('stocks', item);
  }
}

// Automatic migration from IndexedDB to Supabase
async function migrateIndexedDBToSupabase() {
  try {
    // 1. Check local storage first to prevent unnecessary network requests
    if (localStorage.getItem('atolyecim_migration_completed') === 'true') {
      console.log('Migration already marked as completed locally.');
      return;
    }

    // 2. Check prefixed migration status
    let isCompleted = await dbGet('settings', 'migration_completed');
    
    // 3. Fallback: check legacy unprefixed migration status directly in Supabase
    if (!isCompleted && useSupabase && supabaseClient) {
      try {
        const { data: legacyRow } = await supabaseClient
          .from('settings')
          .select('*')
          .eq('id', 'migration_completed')
          .maybeSingle();
        if (legacyRow && legacyRow.data && legacyRow.data.done) {
          isCompleted = { key: 'migration_completed', value: { done: true } };
        }
      } catch (e) {
        console.warn('Failed to fetch legacy migration status:', e);
      }
    }

    if (isCompleted && isCompleted.value && isCompleted.value.done) {
      localStorage.setItem('atolyecim_migration_completed', 'true');
      console.log('Migration already completed in cloud.');
      return;
    }

    // Read all tables from local IndexedDB
    const localProducts = await localDbGetAll('products');
    const localOrders = await localDbGetAll('orders');
    const localContacts = await localDbGetAll('contacts');
    const localStocks = await localDbGetAll('stocks');
    const localRecipes = await localDbGetAll('recipes');
    const localTransactions = await localDbGetAll('transactions');
    const localSettings = await localDbGetAll('settings');

    const totalRecords = localProducts.length + localOrders.length + localContacts.length + localStocks.length + localTransactions.length;
    if (totalRecords === 0) {
      console.log('No local data to migrate.');
      // Mark as done anyway in cloud settings
      await dbUpdate('settings', { key: 'migration_completed', value: { done: true } });
      localStorage.setItem('atolyecim_migration_completed', 'true');
      return;
    }

    if (window.showToast) {
      window.showToast('Yerel verileriniz bulut veritabanına aktarılıyor, lütfen sayfayı kapatmayın...', 'info');
    }

    const uploadStore = async (storeName, items, idField) => {
      for (const item of items) {
        const idValue = item[idField];
        if (idValue === undefined || idValue === null || idValue === '') {
          continue;
        }

        try {
          // Use dbUpdate to automatically assign _ownerCompany and prefix settings IDs!
          await dbUpdate(storeName, item);
        } catch (err) {
          console.warn(`Supabase migration skipped row in ${storeName} for ID ${idValue}:`, err);
        }
      }
    };

    await uploadStore('products', localProducts, 'id');
    await uploadStore('orders', localOrders, 'id');
    await uploadStore('contacts', localContacts, 'id');
    await uploadStore('stocks', localStocks, 'id');
    await uploadStore('recipes', localRecipes, 'productId');
    await uploadStore('transactions', localTransactions, 'id');
    await uploadStore('settings', localSettings, 'key');

    // Mark as completed
    await dbUpdate('settings', { key: 'migration_completed', value: { done: true } });
    localStorage.setItem('atolyecim_migration_completed', 'true');

    if (window.showToast) {
      window.showToast('Eşitleme tamamlandı! Yerel verileriniz buluta başarıyla yüklendi.', 'success');
    }
  } catch (err) {
    console.error('Data migration warning:', err);
    // Silent fail so it does not block the application load
  }
}

// Initialize Database (Local IndexedDB always starts as fallback)
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      if (!database.objectStoreNames.contains('products')) {
        const ps = database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('category', 'category', { unique: false });
        ps.createIndex('stage', 'stage', { unique: false });
      }

      if (!database.objectStoreNames.contains('contacts')) {
        const cs = database.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
        cs.createIndex('type', 'type', { unique: false });
      }

      if (!database.objectStoreNames.contains('transactions')) {
        const ts = database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        ts.createIndex('contactId', 'contactId', { unique: false });
        ts.createIndex('type', 'type', { unique: false });
        ts.createIndex('date', 'date', { unique: false });
      }

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('orders')) {
        const os = database.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        os.createIndex('contactId', 'contactId', { unique: false });
        os.createIndex('productId', 'productId', { unique: false });
      }

      if (!database.objectStoreNames.contains('recipes')) {
        database.createObjectStore('recipes', { keyPath: 'productId' });
      }

      if (!database.objectStoreNames.contains('stocks')) {
        const ss = database.createObjectStore('stocks', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('type', 'type', { unique: false });
      }

      if (!database.objectStoreNames.contains('assortments')) {
        database.createObjectStore('assortments', { keyPath: 'id', autoIncrement: true });
      }

      if (!database.objectStoreNames.contains('contractors')) {
        database.createObjectStore('contractors', { keyPath: 'id', autoIncrement: true });
      }

      if (!database.objectStoreNames.contains('contractor_jobs')) {
        const cjs = database.createObjectStore('contractor_jobs', { keyPath: 'id', autoIncrement: true });
        cjs.createIndex('contractorId', 'contractorId', { unique: false });
      }

      if (!database.objectStoreNames.contains('contractor_transactions')) {
        const cts = database.createObjectStore('contractor_transactions', { keyPath: 'id', autoIncrement: true });
        cts.createIndex('contractorId', 'contractorId', { unique: false });
      }

      if (!database.objectStoreNames.contains('job_tickets')) {
        const jts = database.createObjectStore('job_tickets', { keyPath: 'id', autoIncrement: true });
        jts.createIndex('stage', 'stage', { unique: false });
        jts.createIndex('serialNo', 'serialNo', { unique: false });
      }

      if (!database.objectStoreNames.contains('material_suppliers')) {
        const mss = database.createObjectStore('material_suppliers', { keyPath: 'id', autoIncrement: true });
        mss.createIndex('category', 'category', { unique: false });
        mss.createIndex('name', 'name', { unique: false });
      }

      if (!database.objectStoreNames.contains('material_prices')) {
        const mps = database.createObjectStore('material_prices', { keyPath: 'id', autoIncrement: true });
        mps.createIndex('supplierId', 'supplierId', { unique: false });
        mps.createIndex('category', 'category', { unique: false });
        mps.createIndex('materialName', 'materialName', { unique: false });
      }
    };

    request.onsuccess = async (e) => {
      db = e.target.result;
      try {
        if (useSupabase) {
          await migrateIndexedDBToSupabase();
          await getAdminWorkshops();
        } else {
          await seedDefaultStocks();
        }
        resolve(db);
      } catch (err) {
        console.error('Database setup success handler error:', err);
        resolve(db);
      }
    };

    request.onerror = (e) => {
      console.error('IndexedDB Error:', e.target.error);
      reject(e.target.error);
    };
  });
}

/* --- Database CRUD Handlers (Multi-Tenant Scoped) --- */

const memoryCache = {}; // { [storeName]: { data: any[], timestamp: number } }
const pendingQueries = {}; // { [storeName]: Promise<any[]> }
const CACHE_TTL_MS = 6000; // 6 seconds TTL for cache

function invalidateCache(storeName) {
  if (memoryCache[storeName]) {
    delete memoryCache[storeName];
  }
}

// Bind to window for debugging or manual cache bust
window.dbMemoryCache = memoryCache;
window.invalidateDbCache = invalidateCache;

function getCurrentTenantCompany() {
  return localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
}

function getSupabaseTableName(storeName) {
  if (storeName === 'job_tickets') return 'contractor_jobs';
  if (storeName === 'material_suppliers') return 'contacts';
  if (storeName === 'material_prices') return 'stocks';
  return storeName;
}

function filterByTenant(storeName, items) {
  if (storeName === 'settings') return items;
  const currentCompany = getCurrentTenantCompany();

  return (items || []).filter(item => {
    if (!item) return false;
    if (item._ownerCompany !== currentCompany) return false;
    if (storeName === 'job_tickets') {
      return item._type === 'job_ticket' || item.serialNo !== undefined;
    }
    if (storeName === 'contractor_jobs') {
      return item._type !== 'job_ticket' && item.serialNo === undefined;
    }
    if (storeName === 'material_suppliers') {
      return item._type === 'material_supplier';
    }
    if (storeName === 'contacts') {
      return item._type !== 'material_supplier';
    }
    if (storeName === 'material_prices') {
      return item._type === 'material_price';
    }
    if (storeName === 'stocks') {
      return item._type !== 'material_price';
    }
    return true;
  });
}

async function dbAdd(storeName, data) {
  data._ownerCompany = data._ownerCompany || getCurrentTenantCompany();
  if (storeName === 'job_tickets') {
    data._type = 'job_ticket';
  }
  if (storeName === 'material_suppliers') {
    data._type = 'material_supplier';
  }
  if (storeName === 'material_prices') {
    data._type = 'material_price';
  }

  if (useSupabase) {
    const targetTable = getSupabaseTableName(storeName);
    const keyField = getKeyField(storeName);
    data.createdAt = data.createdAt || new Date().toISOString();

    const payload = { ...data };
    let idValue = payload[keyField];
    delete payload[keyField];

    // For settings store, prefix ID in Supabase to avoid cross-tenant ID collision (global_ hariç)
    if (storeName === 'settings' && idValue) {
      const isGlobal = String(idValue).startsWith('global_');
      if (!isGlobal) {
        const currentCompany = getCurrentTenantCompany();
        idValue = `${currentCompany}_${idValue}`;
      }
    }

    const dbRow = {
      data: payload,
      updated_at: new Date().toISOString()
    };

    // Omit created_at column for new tables that lack it in the Supabase schema
    const TABLES_WITHOUT_CREATED_AT = ['contractors', 'contractor_jobs', 'contractor_transactions', 'assortments', 'job_tickets'];
    if (!TABLES_WITHOUT_CREATED_AT.includes(targetTable) && !TABLES_WITHOUT_CREATED_AT.includes(storeName)) {
      dbRow.created_at = data.createdAt;
    }

    if (idValue !== undefined && idValue !== null && idValue !== '') {
      dbRow.id = idValue;
    }

    const { data: insertedRows, error } = await supabaseClient
      .from(targetTable)
      .insert(dbRow)
      .select();

    if (error) {
      console.error(`Supabase dbAdd error in ${storeName}:`, error);
      throw error;
    }

    let newId = (insertedRows && insertedRows.length > 0) ? insertedRows[0].id : idValue;
    if (storeName === 'settings' && typeof newId === 'string') {
      const currentCompany = getCurrentTenantCompany();
      if (newId.startsWith(currentCompany + '_')) {
        newId = newId.substring(currentCompany.length + 1);
      }
    }
    data[keyField] = keyField === 'key' ? newId : Number(newId);

    // Hızlı İyimser Önbellek Güncellemesi (UI anında tazelenir)
    if (memoryCache[storeName] && Array.isArray(memoryCache[storeName].data)) {
      memoryCache[storeName].data.unshift(JSON.parse(JSON.stringify(data)));
      memoryCache[storeName].timestamp = Date.now();
    } else {
      invalidateCache(storeName);
    }

    return data[keyField];
  }

  // Local IndexedDB
  invalidateCache(storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    data.createdAt = data.createdAt || new Date().toISOString();
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const now = Date.now();
  
  // 1. Check if cache is valid
  if (memoryCache[storeName] && (now - memoryCache[storeName].timestamp) < CACHE_TTL_MS) {
    return JSON.parse(JSON.stringify(memoryCache[storeName].data));
  }

  // 2. Check if there is a pending query for this store
  if (pendingQueries[storeName]) {
    await pendingQueries[storeName];
    if (memoryCache[storeName]) {
      return JSON.parse(JSON.stringify(memoryCache[storeName].data));
    }
  }

  // 3. Create a new query promise
  const queryPromise = (async () => {
    let allItems = [];

    if (useSupabase) {
      const currentCompany = getCurrentTenantCompany();
      const targetTable = getSupabaseTableName(storeName);
      let query = supabaseClient.from(targetTable).select('*')
        .eq('data->>_ownerCompany', currentCompany);
      
      const { data: rows, error } = await query;

      if (error) {
        console.error(`Supabase dbGetAll error in ${storeName}:`, error);
        throw error;
      }

      allItems = (rows || []).map(row => mapFromSupabase(storeName, row));
    } else {
      // Local IndexedDB
      allItems = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    const filtered = filterByTenant(storeName, allItems);
    
    // Populate cache
    memoryCache[storeName] = {
      data: JSON.parse(JSON.stringify(filtered)),
      timestamp: Date.now()
    };

    return filtered;
  })();

  pendingQueries[storeName] = queryPromise;

  try {
    await queryPromise;
  } finally {
    delete pendingQueries[storeName];
  }

  return JSON.parse(JSON.stringify(memoryCache[storeName].data));
}

async function dbGet(storeName, id) {
  const keyField = getKeyField(storeName);
  const now = Date.now();

  // Try to return from cache if valid
  if (memoryCache[storeName] && (now - memoryCache[storeName].timestamp) < CACHE_TTL_MS) {
    const cachedItem = memoryCache[storeName].data.find(item => String(item[keyField]) === String(id));
    if (cachedItem) {
      return JSON.parse(JSON.stringify(cachedItem));
    }
  }

  // If there's a pending query, await it and try cache again
  if (pendingQueries[storeName]) {
    await pendingQueries[storeName];
    if (memoryCache[storeName]) {
      const cachedItem = memoryCache[storeName].data.find(item => String(item[keyField]) === String(id));
      if (cachedItem) {
        return JSON.parse(JSON.stringify(cachedItem));
      }
    }
  }

  let item = null;

  if (useSupabase) {
    const currentCompany = getCurrentTenantCompany();
    const targetTable = getSupabaseTableName(storeName);
    const isGlobal = storeName === 'settings' && String(id).startsWith('global_');
    const dbId = (storeName === 'settings' && !isGlobal) ? `${currentCompany}_${id}` : id;
    let query = supabaseClient.from(targetTable).select('*').eq('id', dbId);
    if (!isGlobal) {
      query = query.eq('data->>_ownerCompany', currentCompany);
    }
    const { data: row, error } = await query.maybeSingle();

    if (error) {
      console.error(`Supabase dbGet error in ${storeName}:`, error);
      throw error;
    }
    item = mapFromSupabase(storeName, row);
  } else {
    // Local IndexedDB
    item = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  const filtered = filterByTenant(storeName, item ? [item] : []);
  return filtered.length > 0 ? filtered[0] : null;
}

async function dbUpdate(storeName, data) {
  data._ownerCompany = data._ownerCompany || getCurrentTenantCompany();
  if (storeName === 'job_tickets') {
    data._type = 'job_ticket';
  }
  if (storeName === 'material_suppliers') {
    data._type = 'material_supplier';
  }
  if (storeName === 'material_prices') {
    data._type = 'material_price';
  }

  let resultId;
  if (useSupabase) {
    const keyField = getKeyField(storeName);
    const idValue = data[keyField];
    if (idValue === undefined || idValue === null || idValue === '') {
      throw new Error(`dbUpdate: ${keyField} is missing for ${storeName}`);
    }

    const currentCompany = getCurrentTenantCompany();
    const isGlobal = storeName === 'settings' && String(idValue).startsWith('global_');
    const dbId = (storeName === 'settings' && !isGlobal) ? `${currentCompany}_${idValue}` : idValue;

    const payload = { ...data };
    delete payload[keyField];

    const targetTable = getSupabaseTableName(storeName);
    // Tek adımda doğrudan hızlı upsert (PostgreSQL RLS güvenlik kalkanı koruması devrede)
    const { error } = await supabaseClient
      .from(targetTable)
      .upsert({
        id: dbId,
        data: payload,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Supabase dbUpdate error in ${storeName}:`, error);
      throw error;
    }
    resultId = idValue;

    // Hızlı İyimser Önbellek Güncellemesi
    if (memoryCache[storeName] && Array.isArray(memoryCache[storeName].data)) {
      const idx = memoryCache[storeName].data.findIndex(item => String(item[keyField]) === String(idValue));
      if (idx !== -1) {
        memoryCache[storeName].data[idx] = JSON.parse(JSON.stringify(data));
      } else {
        memoryCache[storeName].data.unshift(JSON.parse(JSON.stringify(data)));
      }
      memoryCache[storeName].timestamp = Date.now();
    } else {
      invalidateCache(storeName);
    }
  } else {
    // Local IndexedDB
    invalidateCache(storeName);
    resultId = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      data.updatedAt = new Date().toISOString();
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Hook for stock limits SMS notification
  if (storeName === 'stocks' && window.checkStockLimitAndNotify) {
    setTimeout(() => {
      window.checkStockLimitAndNotify(data);
    }, 100);
  }

  return resultId;
}

async function dbDelete(storeName, id) {
  const keyField = getKeyField(storeName);

  // If deleting from operational stores, move to recycle_bin first!
  if (['orders', 'products', 'stocks', 'contacts'].includes(storeName)) {
    try {
      let item = null;
      // Önce hafızadaki önbellekten anında al (ekstra ağ beklemesini önle)
      if (memoryCache[storeName] && Array.isArray(memoryCache[storeName].data)) {
        item = memoryCache[storeName].data.find(i => String(i[keyField]) === String(id));
      }
      if (!item) {
        item = await dbGet(storeName, id).catch(() => null);
      }

      if (item) {
        const recycleItem = JSON.parse(JSON.stringify(item));
        recycleItem.deletedAt = new Date().toISOString();
        recycleItem.originalStore = storeName;
        recycleItem.originalId = id;

        // Save into settings/localStorage recycle_bin log
        let recycleBin = JSON.parse(localStorage.getItem('atolyecim_recycle_bin') || '[]');
        recycleBin.unshift(recycleItem);
        while (recycleBin.length > 50) recycleBin.pop();
        localStorage.setItem('atolyecim_recycle_bin', JSON.stringify(recycleBin));
      }
    } catch (e) {
      console.warn('Recycle bin move warning:', e);
    }
  }

  // İyimser Önbellekten Anında Kaldır (UI saniyelerce beklemez)
  if (memoryCache[storeName] && Array.isArray(memoryCache[storeName].data)) {
    memoryCache[storeName].data = memoryCache[storeName].data.filter(item => String(item[keyField]) !== String(id));
    memoryCache[storeName].timestamp = Date.now();
  } else {
    invalidateCache(storeName);
  }

  if (useSupabase) {
    const currentCompany = getCurrentTenantCompany();
    const targetTable = getSupabaseTableName(storeName);
    const dbId = storeName === 'settings' ? `${currentCompany}_${id}` : id;
    const { error } = await supabaseClient
      .from(targetTable)
      .delete()
      .eq('id', dbId)
      .eq('data->>_ownerCompany', currentCompany);

    if (error) {
      console.error(`Supabase dbDelete error in ${storeName}:`, error);
      throw error;
    }
    return;
  }

  // Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Toplu Hızlı Silme (Batch Deletion) — onlarca ağ isteği yerine tek istekte siler
async function dbDeleteMany(storeName, ids) {
  if (!ids || ids.length === 0) return;
  const keyField = getKeyField(storeName);

  // İyimser Önbellekten toplu tahliye
  if (memoryCache[storeName] && Array.isArray(memoryCache[storeName].data)) {
    const idSet = new Set(ids.map(String));
    memoryCache[storeName].data = memoryCache[storeName].data.filter(item => !idSet.has(String(item[keyField])));
    memoryCache[storeName].timestamp = Date.now();
  } else {
    invalidateCache(storeName);
  }

  if (useSupabase) {
    const currentCompany = getCurrentTenantCompany();
    const targetTable = getSupabaseTableName(storeName);
    const dbIds = storeName === 'settings' ? ids.map(id => `${currentCompany}_${id}`) : ids;
    const { error } = await supabaseClient
      .from(targetTable)
      .delete()
      .in('id', dbIds)
      .eq('data->>_ownerCompany', currentCompany);

    if (error) {
      console.error(`Supabase dbDeleteMany error in ${storeName}:`, error);
      throw error;
    }
    return;
  }

  // Local IndexedDB
  return Promise.all(ids.map(id => dbDelete(storeName, id)));
}

async function dbGetByIndex(storeName, indexName, value) {
  const allItems = await dbGetAll(storeName); // already tenant filtered!
  return allItems.filter(item => String(item[indexName]) === String(value));
}

async function dbClearStore(storeName) {
  invalidateCache(storeName);
  if (useSupabase) {
    const currentCompany = getCurrentTenantCompany();
    const targetTable = getSupabaseTableName(storeName);
    let query = supabaseClient.from(targetTable).delete();
    if (storeName !== 'settings') {
      query = query.eq('data->>_ownerCompany', currentCompany);
    } else {
      query = query.like('id', `${currentCompany}_%`);
    }
    const { error } = await query;

    if (error) {
      console.error(`Supabase dbClearStore error in ${storeName}:`, error);
      throw error;
    }
    return;
  }

  // Local IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* --- Settings helper functions --- */

function setSetting(key, value) {
  return dbUpdate('settings', { key, value });
}

function getSetting(key) {
  return dbGet('settings', key).then(r => r ? r.value : null);
}

/* --- SaaS Super Admin Helper Functions --- */
async function dbGetAllRaw(storeName) {
  let allItems = [];
  if (useSupabase) {
    const { data: rows, error } = await supabaseClient
      .from(storeName)
      .select('*');
    if (!error && rows) {
      allItems = rows.map(row => mapFromSupabase(storeName, row));
    }
  } else {
    allItems = await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }
  return allItems || [];
}

async function getAdminWorkshops() {
  let workshops = JSON.parse(localStorage.getItem('saas_workshops') || '[]');
  if (useSupabase && supabaseClient) {
    try {
      // Settings tablosunda kayıt, tenant prefix'li olarak saklanır (ör: "Atölyecim Master_saas_registered_workshops")
      // Giriş yapmamış kullanıcılar için getCurrentTenantCompany() varsayılan olarak 'Atölyecim Master' döner
      const currentCompany = getCurrentTenantCompany();
      const prefixedId = currentCompany + '_saas_registered_workshops';
      
      let { data: cloudSettings } = await supabaseClient
        .from('settings')
        .select('*')
        .eq('id', prefixedId)
        .maybeSingle();

      // Geriye dönük uyumluluk: prefix'siz eski kayıt da dene
      if (!cloudSettings) {
        const fallback = await supabaseClient
          .from('settings')
          .select('*')
          .eq('id', 'saas_registered_workshops')
          .maybeSingle();
        cloudSettings = fallback.data;
      }

      if (cloudSettings && cloudSettings.data) {
        // Handle both data.workshops and data.value.workshops structures
        let ws = cloudSettings.data.workshops || (cloudSettings.data.value && cloudSettings.data.value.workshops);
        if (ws && Array.isArray(ws)) {
          workshops = ws;
          localStorage.setItem('saas_workshops', JSON.stringify(workshops));
        }
      }
    } catch (e) {
      console.warn('Cloud workshops fetch warning:', e);
    }
  }
  return workshops || [];
}

// Giriş akışı için özel fonksiyon: tenant filtresi olmadan çalışır.
// Login sırasında (henüz şirket adı belli değilken) atölye listesini çekmek için kullanılır.
async function fetchWorkshopsForLogin() {
  // Önce localStorage önbelleğine bak
  const cached = localStorage.getItem('saas_workshops');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (_) {}
  }

  // Supabase varsa direkt çek (tenant filtresi yok!)
  if (supabaseClient) {
    try {
      // Önce prefix'li kayıt dene
      let { data: cloudSettings } = await supabaseClient
        .from('settings')
        .select('*')
        .eq('id', 'Atölyecim Master_saas_registered_workshops')
        .maybeSingle();

      // Sonra prefix'siz dene
      if (!cloudSettings) {
        const fallback = await supabaseClient
          .from('settings')
          .select('*')
          .eq('id', 'saas_registered_workshops')
          .maybeSingle();
        cloudSettings = fallback.data;
      }

      if (cloudSettings && cloudSettings.data) {
        const ws = cloudSettings.data.workshops || (cloudSettings.data.value && cloudSettings.data.value.workshops);
        if (ws && Array.isArray(ws) && ws.length > 0) {
          localStorage.setItem('saas_workshops', JSON.stringify(ws));
          return ws;
        }
      }
    } catch (e) {
      console.warn('fetchWorkshopsForLogin hata:', e);
    }
  }
  return [];
}

async function getAdminStats() {
  const workshops = await getAdminWorkshops();
  const allOrders = await dbGetAllRaw('orders');
  const allContacts = await dbGetAllRaw('contacts');
  return {
    workshopsCount: workshops.length,
    ordersCount: allOrders.length,
    contactsCount: allContacts.length,
    activeSubscriptions: 'Sınırsız (V.I.P)'
  };
}

async function getWorkshopDetailedReport(companyName) {
  const allOrders = await dbGetAllRaw('orders');
  const allProducts = await dbGetAllRaw('products');
  const allStocks = await dbGetAllRaw('stocks');
  const allContacts = await dbGetAllRaw('contacts');

  const workshopOrders = allOrders.filter(o => o && o._ownerCompany === companyName);
  const workshopProducts = allProducts.filter(p => p && p._ownerCompany === companyName);
  const workshopStocks = allStocks.filter(s => s && s._ownerCompany === companyName);
  const workshopContacts = allContacts.filter(c => c && c._ownerCompany === companyName);

  const totalRevenue = workshopOrders.reduce((acc, o) => acc + (Number(o.totalPrice) || 0), 0);

  return {
    company: companyName,
    ordersCount: workshopOrders.length,
    productsCount: workshopProducts.length,
    stocksCount: workshopStocks.length,
    contactsCount: workshopContacts.length,
    totalRevenue: totalRevenue
  };
}

/* --- Recycle Bin Helper Functions --- */
function getRecycleBinItems() {
  const allBin = JSON.parse(localStorage.getItem('atolyecim_recycle_bin') || '[]');
  const currentCompany = getCurrentTenantCompany();
  const isAdmin = localStorage.getItem('atolyecim_is_admin') === 'true';

  // Purge items older than 30 days automatically
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  const validBin = allBin.filter(item => {
    if (!item || !item.deletedAt) return false;
    const deletedTime = new Date(item.deletedAt).getTime();
    return (now - deletedTime) < THIRTY_DAYS_MS;
  });

  if (validBin.length !== allBin.length) {
    localStorage.setItem('atolyecim_recycle_bin', JSON.stringify(validBin));
  }

  return validBin.filter(item => item._ownerCompany === currentCompany);
}

async function restoreRecycleBinItem(deletedAtTime) {
  let recycleBin = JSON.parse(localStorage.getItem('atolyecim_recycle_bin') || '[]');
  const index = recycleBin.findIndex(item => item.deletedAt === deletedAtTime);
  if (index === -1) return false;

  const itemToRestore = recycleBin[index];
  recycleBin.splice(index, 1);
  localStorage.setItem('atolyecim_recycle_bin', JSON.stringify(recycleBin));

  const storeName = itemToRestore.originalStore || 'orders';
  delete itemToRestore.deletedAt;
  delete itemToRestore.originalStore;
  delete itemToRestore.originalId;

  await dbUpdate(storeName, itemToRestore);
  return true;
}

function permanentlyDeleteRecycleBinItem(deletedAtTime) {
  let recycleBin = JSON.parse(localStorage.getItem('atolyecim_recycle_bin') || '[]');
  recycleBin = recycleBin.filter(item => item.deletedAt !== deletedAtTime);
  localStorage.setItem('atolyecim_recycle_bin', JSON.stringify(recycleBin));
}

async function dbClearLocalData() {
  return new Promise((resolve) => {
    if (db) {
      db.close();
      db = null;
    }
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
      console.log('Local IndexedDB deleted successfully');
      resolve();
    };
    req.onerror = () => {
      console.warn('Failed to delete local IndexedDB');
      resolve();
    };
    req.onblocked = () => {
      console.warn('Delete IndexedDB blocked');
      resolve();
    };
  });
}

// Global window bindings
window.initDB = initDB;
window.dbAdd = dbAdd;
window.dbGetAll = dbGetAll;
window.dbGetAllRaw = dbGetAllRaw;
window.dbGet = dbGet;
window.dbUpdate = dbUpdate;
window.dbDelete = dbDelete;
window.dbDeleteMany = dbDeleteMany;
window.dbGetByIndex = dbGetByIndex;
window.dbClearStore = dbClearStore;
window.setSetting = setSetting;
window.getSetting = getSetting;
window.getAdminWorkshops = getAdminWorkshops;
window.fetchWorkshopsForLogin = fetchWorkshopsForLogin;
window.getAdminStats = getAdminStats;
window.getWorkshopDetailedReport = getWorkshopDetailedReport;
window.getRecycleBinItems = getRecycleBinItems;
window.restoreRecycleBinItem = restoreRecycleBinItem;
window.permanentlyDeleteRecycleBinItem = permanentlyDeleteRecycleBinItem;
window.dbClearLocalData = dbClearLocalData;
