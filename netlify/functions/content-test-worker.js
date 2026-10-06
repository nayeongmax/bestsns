const { db, bucket, json, workerAllowed, checked } = require('../lib/content-test.cjs');
const { randomUUID } = require('node:crypto');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405,{ error:'Method not allowed' });
  if (!workerAllowed(event)) return json(403,{ error:'Worker authentication failed' });
  if (process.env.CONTENT_TEST_ENABLED !== 'true') return json(503,{ error:'Test disabled' });
  try {
    const client=db(); const data=JSON.parse(event.body || '{}');
    if (data.action === 'claim') {
      if (typeof data.worker !== 'string' || data.worker.length>100) return json(400,{error:'Invalid worker'});
      const rows=checked(await client.rpc('claim_content_test',{p_worker:data.worker}));
      if (!rows.length) return json(200,{order:null});
      const order=rows[0];
      order.assets=await Promise.all(order.assets.map(async item=>({...item,url:checked(await client.storage.from(bucket).createSignedUrl(item.path,3600)).signedUrl})));
      return json(200,{order});
    }
    const order=checked(await client.from('content_test_orders').select('*').eq('id',data.id).eq('claim_token',data.claimToken).eq('status','running').single());
    if (data.action === 'outputs') {
      const types=order.kind==='video'?['video/mp4']:['image/jpeg','image/png','image/webp'];
      if (!Array.isArray(data.files) || data.files.length<1 || data.files.length>10 || data.files.some(f=>!types.includes(f.type)||typeof f.name!=='string'||f.name.length>255||!Number.isSafeInteger(f.size)||f.size<=0||f.size>524288000)) return json(400,{error:'Invalid outputs'});
      const results=data.files.map(f=>({...f,path:`${order.id}/outputs/${randomUUID()}`}));
      checked(await client.from('content_test_orders').update({results}).eq('id',order.id).eq('claim_token',data.claimToken));
      const uploads=await Promise.all(results.map(async f=>({...f,token:checked(await client.storage.from(bucket).createSignedUploadUrl(f.path)).token})));
      return json(200,{bucket,uploads});
    }
    if (data.action==='complete') {
      const files=checked(await client.storage.from(bucket).list(`${order.id}/outputs`,{limit:100}));
      if (!order.results.length || order.results.some(r=>!files.some(f=>f.name===r.path.split('/').pop()&&Number(f.metadata?.size)===r.size))) return json(400,{error:'Outputs not uploaded'});
      checked(await client.from('content_test_orders').update({status:'completed',message:'결과 확인 가능',updated_at:new Date().toISOString()}).eq('id',order.id).eq('claim_token',data.claimToken).eq('status','running'));
      return json(200,{status:'completed'});
    }
    if (data.action==='failed') {
      checked(await client.from('content_test_orders').update({status:'failed',message:String(data.message||'픽셀링 제작 실패').slice(0,500),updated_at:new Date().toISOString()}).eq('id',order.id).eq('claim_token',data.claimToken).eq('status','running'));
      return json(200,{status:'failed'});
    }
    return json(400,{error:'Invalid action'});
  } catch(error) {console.error('content-worker',error.message);return json(503,{error:'Worker operation failed'});}
};
