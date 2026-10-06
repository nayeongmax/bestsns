const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/shorts-access.js');
const event = (method='GET', extra={}) => ({ httpMethod: method, headers: {}, ...extra });
test('shorts visibility fails closed, authenticates operators, and never enables production', async () => {
  const original = { ...process.env };
  const originalFetch = global.fetch;
  try {
    delete process.env.SHORTS_PUBLIC_ENABLED;
    delete process.env.SHORTS_PREVIEW_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    const anonymous = JSON.parse((await handler(event())).body);
    assert.deepEqual(anonymous, { published: false, preview: false, productionEnabled: false });
    process.env.SHORTS_PREVIEW_PASSWORD = 'operator-test-password';
    assert.equal((await handler(event('POST', { body: '{"password":"operator-test-password"}' }))).statusCode, 405);
    process.env.SUPABASE_URL = 'https://test.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
    global.fetch = async () => ({ ok: false });
    assert.equal(JSON.parse((await handler(event('GET', { headers: { authorization: 'Bearer forged' } }))).body).preview, false);
    let role = 'user';
    global.fetch = async url => ({ ok: true, json: async () => url.includes('/auth/') ? { id: 'account' } : [{ role }] });
    assert.equal(JSON.parse((await handler(event('GET', { headers: { authorization: 'Bearer verified' } }))).body).preview, false);
    role = 'admin';
    assert.equal(JSON.parse((await handler(event('GET', { headers: { authorization: 'Bearer verified' } }))).body).preview, true);
    global.fetch = async () => { throw Error('offline'); };
    assert.equal(JSON.parse((await handler(event('GET', { headers: { authorization: 'Bearer verified' } }))).body).preview, false);
    process.env.SHORTS_PUBLIC_ENABLED = 'true';
    const publicResult = JSON.parse((await handler(event())).body);
    assert.equal(publicResult.published, true);
    assert.equal(publicResult.productionEnabled, false);
    assert.equal((await handler(event('DELETE'))).statusCode, 405);
  } finally { global.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); }
});

