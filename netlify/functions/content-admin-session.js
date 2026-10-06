const { json, cookieToken, originAllowed } = require('../lib/content-test.cjs');
const { timingSafeEqual } = require('node:crypto');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!originAllowed(event)) return json(403, { error: 'Origin not allowed' });
  const expected = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.CONTENT_ADMIN_SESSION_SECRET || '';
  if (!expected) return json(503, { code: 'ADMIN_PASSWORD_MISSING', error: 'Netlify의 현재 배포 환경에 ADMIN_PASSWORD가 없습니다. Functions 범위와 Production/Deploy Previews 값을 확인하고 재배포해 주세요.' });
  if (secret.length < 32) return json(503, { code: 'ADMIN_SESSION_SECRET_INVALID', error: 'ADMIN_SESSION_SECRET이 없거나 32자 미만입니다. Functions 범위에 32자 이상의 무작위 문자열을 설정하고 재배포해 주세요.' });
  if (expected === process.env.VITE_ADMIN_PASSWORD || expected === process.env.VITE_ADMIN_PANEL_PASSWORD) return json(503, { code: 'ADMIN_PASSWORD_REUSED', error: '새 ADMIN_PASSWORD가 기존 공개 비밀번호와 같습니다. 기존과 다른 새 비밀번호를 설정하고 재배포해 주세요.' });
  let data; try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const supplied = typeof data.password === 'string' && data.password.length <= 256 ? data.password : '';
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (data.id !== (process.env.ADMIN_ID || 'admin') || a.length !== b.length || !timingSafeEqual(a, b)) return json(403, { error: '관리자 인증 실패' });
  return json(200, { authenticated: true }, { 'Set-Cookie': `content_admin=${cookieToken()}; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/; Max-Age=3600` });
};
