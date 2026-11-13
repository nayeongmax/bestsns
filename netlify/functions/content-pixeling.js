const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
const catalog=require('../data/content-pixeling-catalog.json');
const {randomUUID}=require('node:crypto');
const enabled=()=>process.env.CONTENT_PIXELING_REQUESTS_ENABLED==='true';
const safe=row=>({id:row.id,presetId:row.preset_id,presetName:row.preset_name,presetVersion:row.preset_version,text:row.text,parentId:row.parent_id,state:row.state,createdAt:row.created_at});
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'지원하지 않는 요청입니다.'});
 if(!h.originAllowed(event))return h.json(403,{error:'허용되지 않은 요청입니다.'});
 try{
  const db=h.db(),owner=await m.member(event,db),admin=owner?!!await h.admin(event,db):false;
  if(event.httpMethod==='GET'){
   const manage=admin&&event.queryStringParameters?.manage==='1';let requests=[],storageReady=true;
   if(owner){let q=db.from('content_pixeling_requests').select('*').order('created_at',{ascending:false}).limit(100);if(!manage)q=q.eq('owner_id',owner);const result=await q;if(result.error){storageReady=false;}else{requests=await Promise.all(result.data.map(async row=>({...safe(row),...(row.state==='completed'&&row.result_path?{url:h.checked(await db.storage.from(h.bucket).createSignedUrl(row.result_path,600)).signedUrl}:{})})));}}
   return h.json(200,{catalog,requests,admin,accepting:enabled()&&storageReady,storageReady,execution:'operator',billing:'not_connected'});
  }
  if(!owner)return h.json(401,{error:'로그인 후 이용해 주세요.'});
  const d=JSON.parse(event.body||'{}');
  if(d.action==='request'){
   if(!enabled())return h.json(503,{error:'픽셀링 제작 연결을 준비하고 있습니다. 아직 주문·결제는 접수하지 않습니다.'});
   const p=catalog.items.find(p=>p.id===d.presetId);
   if(!p||!m.uuid(d.id)||typeof d.text!=='string'||!d.text.trim()||d.text.length>5000||d.confirmed!==true)return h.json(400,{error:'프리셋과 요청 내용을 확인해 주세요.'});
   const prior=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).maybeSingle());
   if(prior){if(prior.owner_id!==owner||prior.text!==d.text||prior.preset_id!==p.id||prior.parent_id!==(d.parentId||null))return h.json(409,{error:'다른 요청과 번호가 겹쳤습니다. 다시 시도해 주세요.'});return h.json(200,{request:safe(prior)});}
   if(d.parentId){if(!m.uuid(d.parentId))return h.json(400,{error:'수정할 완성본을 확인해 주세요.'});const parent=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.parentId).eq('owner_id',owner).eq('state','completed').eq('preset_id',p.id).maybeSingle());if(!parent)return h.json(400,{error:'내 완성본만 수정할 수 있습니다.'});}
   // Preserve the exact customer's text. Do not execute it as code or add secret instructions.
   const row=h.checked(await db.from('content_pixeling_requests').insert({id:d.id,owner_id:owner,preset_id:p.id,preset_name:p.name,preset_version:p.version,text:d.text,parent_id:d.parentId||null}).select('*').single());
   return h.json(200,{request:safe(row)});
  }
  if(!admin)return h.json(403,{error:'운영자만 이용할 수 있습니다.'});
  if(!m.uuid(d.id))return h.json(400,{error:'주문을 확인해 주세요.'});
  const row=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).single());
  if(d.action==='handoff')return h.json(200,{job:{orderId:row.id,preset:{id:row.preset_id,name:row.preset_name,version:row.preset_version},message:row.text,parentOrderId:row.parent_id,instructions:'픽셀링에서 동일 ID·버전의 프리셋을 선택하고 message를 그대로 입력하세요. 이것은 실행 완료 확인이 아닌 작업 전달 파일입니다.'}});
  if(d.action==='working'||d.action==='failed'){
   const allowed=d.action==='working'?['submitted']:['submitted','working'];
   const changed=h.checked(await db.from('content_pixeling_requests').update({state:d.action,updated_at:new Date().toISOString()}).eq('id',row.id).in('state',allowed).select('id'));
   return changed.length?h.json(200,{saved:true}):h.json(409,{error:'현재 주문 상태에서는 변경할 수 없습니다.'});
  }
  if(d.action==='upload'){
   if(row.state!=='working'||!Number.isSafeInteger(d.size)||d.size<1||d.size>150*1024*1024)return h.json(400,{error:'제작 중인 주문에 150MB 이하 MP4를 등록하세요.'});
   const path='pixeling/'+row.id+'/'+randomUUID()+'.mp4';
   const upload=h.checked(await db.storage.from(h.bucket).createSignedUploadUrl(path));
   const changed=h.checked(await db.from('content_pixeling_requests').update({result_path:path,result_size:d.size}).eq('id',row.id).eq('state','working').select('id'));if(!changed.length)return h.json(409,{error:'주문 상태가 변경됐습니다.'});
   return h.json(200,{bucket:h.bucket,path,token:upload.token});
  }
  if(d.action==='complete'){
   if(row.state!=='working')return h.json(409,{error:'제작 중인 주문만 완료할 수 있습니다.'});
   if(!row.result_path)return h.json(400,{error:'완성 영상을 먼저 업로드하세요.'});
   const files=h.checked(await db.storage.from(h.bucket).list('pixeling/'+row.id,{search:row.result_path.split('/').pop(),limit:10}));const file=files.find(f=>f.name===row.result_path.split('/').pop());const size=Number(file?.metadata?.size);
   if(!file||size!==row.result_size||!Number.isSafeInteger(size)||size<1||size>150*1024*1024)return h.json(400,{error:'완성 영상 업로드를 먼저 완료해 주세요.'});
   const blob=h.checked(await db.storage.from(h.bucket).download(row.result_path));if(!h.validMedia(Buffer.from(await blob.slice(0,32).arrayBuffer()),'video/mp4'))return h.json(400,{error:'유효한 MP4 파일을 등록하세요.'});
   const changed=h.checked(await db.from('content_pixeling_requests').update({state:'completed',updated_at:new Date().toISOString()}).eq('id',row.id).eq('state','working').eq('result_path',row.result_path).select('id'));if(!changed.length)return h.json(409,{error:'등록 중 주문이 변경됐습니다. 다시 확인하세요.'});
   return h.json(200,{saved:true});
  }
  return h.json(400,{error:'지원하지 않는 작업입니다.'});
 }catch{
  // Public browsing remains available when authentication or order storage is unavailable.
  // Never return private orders, admin access, or accepting=true on this fallback.
  if(event.httpMethod==='GET')return h.json(200,{catalog,requests:[],admin:false,accepting:false,storageReady:false,execution:'operator',billing:'not_connected'});
  return h.json(503,{error:'콘텐츠 제작 저장소 연결을 확인해 주세요. 입력한 내용은 지우지 말고 다시 시도해 주세요.'});
 }
};

