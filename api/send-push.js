import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID Keys setup
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BG1947QNf0x6COBkxo4HX129RGPSMnWgdNq453kRFVV4CSaPYojaFBG95Tm9DMetWkdqR2PxiL0pWQZt4rwoXZk";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "8wLyLoz3ANQfQHK0u3n2nSNZ0YPYfE6cPR-5gE8PU9M";

webpush.setVapidDetails(
  'mailto:info@atolyecim.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { workshopId, title, message, userType, contactId } = req.body;

  if (!workshopId || !title || !message) {
    return res.status(400).json({ error: 'Missing required parameters: workshopId, title, message' });
  }

  // Supabase connection credentials
  const supabaseUrl = process.env.SUPABASE_URL || 'https://eojfpequxoxunmxejquy.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Query push subscriptions with filters
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('workshop_id', workshopId);

    if (userType) {
      query = query.eq('user_type', userType);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, sentCount: 0, message: 'No matching subscribers found.' });
    }

    // 2. Broadcast payloads concurrently
    const payload = JSON.stringify({ title, body: message });

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        const pushSubscription = {
          endpoint: s.endpoint,
          keys: s.keys
        };
        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { id: s.id, status: 'success' };
        } catch (err) {
          // If subscription has expired or is invalid (410/404), clean up database!
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
            return { id: s.id, status: 'deleted_expired' };
          }
          throw err;
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
    const deletedCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'deleted_expired').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    return res.status(200).json({
      success: true,
      sentCount: successCount,
      deletedCount: deletedCount,
      failedCount: failedCount
    });

  } catch (err) {
    console.error('Send push error:', err);
    return res.status(500).json({ error: err.message });
  }
}
