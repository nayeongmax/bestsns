const { timingSafeEqual } = require('node:crypto');
const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed' });
  // Publication only changes visibility. Production remains disabled until the worker and billing are ready.
  const published = process.env.SHORTS_PUBLIC_ENABLED === 'true';
  let preview = false;
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }
    const expected = process.env.SHORTS_PREVIEW_PASSWORD || process.env.ADMIN_PASSWORD || '';
    const supplied = typeof body.password === 'string' ? body.password : '';
    if (expected && supplied && supplied.length <= 256) {
      const a = Buffer.from(expected), b = Buffer.from(supplied);
      preview = a.length === b.length && timingSafeEqual(a, b);
    }
    return reply(preview ? 200 : 403, { published, preview, productionEnabled: false });
  }
  const bearer = event.headers?.authorization || event.headers?.Authorization || '';
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (bearer.startsWith('Bearer ') && url && key) {
    try {
      const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: bearer } });
      if (auth.ok) {
        const account = await auth.json();
        if (typeof account.id === 'string') {
          const profiles = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(account.id)}&select=role&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
          if (profiles.ok) { const rows = await profiles.json(); preview = rows[0]?.role === 'admin'; }
        }
      }
    } catch { /* Fail closed for missing configuration and failed verification. */ }
  }
  return reply(200, { published, preview, productionEnabled: false });
};
