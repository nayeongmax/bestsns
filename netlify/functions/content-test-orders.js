const { db, bucket, json, admin, originAllowed, checked } = require('../lib/content-test.cjs');
const { randomUUID } = require('node:crypto');
exports.handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  if (!originAllowed(event)) return json(403, { error: 'Origin not allowed' });
  try {
    const client = db(); const owner = await admin(event, client);
    if (!owner) return json(403, { error: '서버에서 인증한 관리자만 테스트할 수 있습니다. 관리자 계정으로 다시 로그인해 주세요.' });
    if (event.httpMethod === 'GET') {
      const rows = checked(await client.from('content_test_orders').select('*').eq('owner_id', owner).order('created_at', { ascending: false }).limit(20));
      for (const row of rows.filter(row => row.status === 'completed')) {
        row.results = await Promise.all((row.results || []).map(async item => ({ ...item, url: checked(await client.storage.from(bucket).createSignedUrl(item.path, 600)).signedUrl })));
      }
      return json(200, { orders: rows, enabled: process.env.CONTENT_TEST_ENABLED === 'true', bridgeReady: process.env.CONTENT_PIXELING_BRIDGE_READY === 'true' });
    }
    if (process.env.CONTENT_TEST_ENABLED !== 'true' || process.env.CONTENT_PIXELING_BRIDGE_READY !== 'true') return json(503, { error: '픽셀링 작업자 연결과 테스트 설정을 완료해야 주문을 실행할 수 있습니다.' });
    const data = JSON.parse(event.body || '{}');
    if (data.action === 'prepare') {
      if (!['video', 'cards'].includes(data.kind) || !Array.isArray(data.files) || data.files.length < 1 || data.files.length > 10) return json(400, { error: '원본 파일을 1~10개 선택해 주세요.' });
      const settings = data.settings || {};
      if (!['15초','30초','60초'].includes(settings.length) || !['3장','5장','7장'].includes(settings.cardCount) || typeof settings.industry !== 'string' || typeof settings.style !== 'string' || typeof settings.request !== 'string' || typeof settings.script !== 'string' || settings.request.length > 10000 || settings.script.length > 10000) return json(400, { error: '제작 설정을 확인해 주세요.' });
      const files = data.files;
      if (files.some(f => !Number.isSafeInteger(f.size) || f.size <= 0 || f.size > 500 * 1024 * 1024 || !(data.kind === 'cards' ? ['image/jpeg','image/png','image/webp'] : ['video/mp4','video/quicktime','video/webm']).includes(f.type) || typeof f.name !== 'string' || f.name.length > 255) || files.reduce((n,f) => n+f.size,0) > 1024*1024*1024) return json(400, { error: '허용된 영상/사진 형식, 파일당 500MB, 총 1GB 제한을 확인해 주세요.' });
      const id = randomUUID();
      const assets = files.map((file,index) => ({ ...file, path: `${id}/inputs/${index}-${randomUUID()}` }));
      checked(await client.from('content_test_orders').insert({ id, owner_id: owner, kind: data.kind, settings, assets, status: 'uploading' }));
      const uploads = await Promise.all(assets.map(async file => ({ ...file, token: checked(await client.storage.from(bucket).createSignedUploadUrl(file.path)).token })));
      return json(200, { id, uploads, bucket });
    }
    if (data.action === 'submit' && typeof data.id === 'string') {
      const order = checked(await client.from('content_test_orders').select('*').eq('id',data.id).eq('owner_id',owner).single());
      if (order.status !== 'uploading') return json(409, { error: '이미 접수되었거나 실행 중인 주문입니다.' });
      const stored = checked(await client.storage.from(bucket).list(`${order.id}/inputs`, { limit: 100 }));
      if (order.assets.some(a => !stored.some(f => f.name === a.path.split('/').pop() && Number(f.metadata?.size) === a.size))) return json(400, { error: '원본 파일 업로드가 완료되지 않았습니다.' });
      checked(await client.from('content_test_orders').update({ status: 'queued', message: '픽셀링 작업자 배정 대기' }).eq('id',order.id).eq('status','uploading'));
      return json(200, { id:order.id, status:'queued' });
    }
    return json(400, { error: 'Invalid action' });
  } catch (error) { console.error('content-test', error.message); return json(503, { error: '테스트 저장소 연결 또는 주문 처리를 확인해 주세요.' }); }
};
