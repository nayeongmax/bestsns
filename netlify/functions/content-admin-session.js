const { json, cookieToken, originAllowed } = require('../lib/content-test.cjs');
const { timingSafeEqual } = require('node:crypto');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!originAllowed(event)) return json(403, { error: 'Origin not allowed' });
  const expected = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.CONTENT_ADMIN_SESSION_SECRET || '';
  if (!expected || expected === process.env.VITE_ADMIN_PASSWORD || expected === process.env.VITE_ADMIN_PANEL_PASSWORD || secret.length < 32) return json(503, { error: '실제 제작용 관리자 비밀번호는 공개된 VITE_ADMIN_PASSWORD와 다른 서버 전용 값으로 설정해야 합니다.' });
  let data; try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const supplied = typeof data.password === 'string' && data.password.length <= 256 ? data.password : '';
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (data.id !== (process.env.ADMIN_ID || 'admin') || a.length !== b.length || !timingSafeEqual(a, b)) return json(403, { error: '관리자 인증 실패' });
  return json(200, { authenticated: true }, { 'Set-Cookie': `content_admin=${cookieToken()}; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/; Max-Age=3600` });
};
