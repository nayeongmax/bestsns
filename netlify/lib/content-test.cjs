const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const bucket = 'content-test';
const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) });
function db() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw Error('관리자 테스트 저장소가 설정되지 않았습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.CONTENT_ADMIN_SESSION_SECRET || '';
function cookieToken() {
  const body = Buffer.from(JSON.stringify({ id: 'admin', exp: Date.now() + 3600000 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}
function validCookie(event) {
  if (secret().length < 32) return false;
  const token = (event.headers?.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('content_admin='))?.slice(14);
  if (!token) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(body, 'base64url').toString()); return data.id === 'admin' && data.exp > Date.now(); } catch { return false; }
}
async function admin(event, client) {
  if (validCookie(event)) return 'admin';
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const { data, error } = await client.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const profile = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return !profile.error && profile.data?.role === 'admin' ? data.user.id : null;
}
function originAllowed(event) {
  const origin = event.headers?.origin;
  return !origin || origin === 'https://' + event.headers?.host || origin === process.env.URL || origin === process.env.DEPLOY_PRIME_URL;
}
function workerAllowed(event) {
  const key = process.env.CONTENT_WORKER_KEY || '';
  const given = event.headers?.authorization || '';
  return key.length >= 32 && given === 'Bearer ' + key;
}
function checked(result) { if (result.error) throw Error(result.error.message); return result.data; }
module.exports = { db, bucket, json, admin, cookieToken, originAllowed, workerAllowed, checked };
