const release=require('../lib/content-studio-release.cjs');
const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
const {randomUUID,randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const stages={prepared:'제작 자료를 PC에서 확인했습니다.',submitted:'제작 프로그램에 요청을 전달했습니다.',review:'완성 영상의 파일 무결성과 재생 가능 여부를 자동 검사하고 있습니다.',attention:'운영자 확인이 필요합니다. 중복 제작을 방지하기 위해 자동 재실행하지 않습니다.'};
async function payload(db,row){
 let base=row;const references=[],seen=new Set([row.id]);
 while(base.reference_result_id||base.parent_id){
  const id=base.reference_result_id||base.parent_id;if(seen.has(id)||references.length>=30)throw Error('REFERENCE_INVALID');seen.add(id);
  base=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',id).eq('owner_id',row.owner_id).eq('state','completed').single());
  references.push({id:base.id,text:base.text,url:h.checked(await db.storage.from(h.bucket).createSignedUrl(base.result_path,600)).signedUrl});
 }
 const q=db.from('content_studio_presets').select('private_prompt');
 const custom=h.checked(await (base.preset_id.startsWith('studio_')?q.eq('id',base.preset_id.slice(7)):q.eq('source_preset_id',base.preset_id)).maybeSingle());
 return {id:row.id,state:row.state,stage:row.desktop_stage,threadId:row.desktop_thread_id,resultSha256:row.result_sha256,presetId:base.preset_id,presetName:base.preset_name,presetVersion:base.preset_version,message:row.text,privateInstructions:custom?.private_prompt||'',references,attachments:await Promise.all((row.attachments||[]).map(async f=>({id:f.id,name:f.name,type:f.type,size:f.size,url:h.checked(await db.storage.from('content-studio-input').createSignedUrl(f.path,600)).signedUrl})))};
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const db=h.db(),auth=event.headers?.authorization||event.headers?.Authorization||'';
  // Worker tokens never authenticate member/admin routes. No browser cookies accepted here.
  if(!auth.startsWith('Bearer desktop_')){
   if(!h.originAllowed(event)||!await h.admin(event,db))return h.json(403,{error:'운영자만 PC 연결을 설정할 수 있습니다.'});
   if(event.httpMethod==='GET')return h.json(200,{workers:h.checked(await db.from('content_desktop_workers').select('id,name,revoked,expires_at,last_seen_at').order('created_at',{ascending:false}))});
   const d=JSON.parse(event.body||'{}');
   if(d.action==='create'){
    if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80)return h.json(400,{error:'PC 이름을 확인하세요.'});
    const id=randomUUID(),secret=randomBytes(32).toString('hex'),token='desktop_'+id+'.'+secret;
    h.checked(await db.from('content_desktop_workers').insert({id,name:d.name.trim(),token_hash:hash(token)}));
    return h.json(200,{id,token});
   }
   if(d.action==='revoke'&&m.uuid(d.id)){h.checked(await db.from('content_desktop_workers').update({revoked:true}).eq('id',d.id));return h.json(200,{saved:true});}
   return h.json(400,{error:'INVALID_ACTION'});
  }
  const token=auth.slice(7),match=/^desktop_([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);
  if(!match||!m.uuid(match[1]))return h.json(401,{error:'WORKER_UNAUTHORIZED'});
  const worker=h.checked(await db.from('content_desktop_workers').select('*').eq('id',match[1]).maybeSingle());
  if(!worker||worker.revoked||Date.parse(worker.expires_at)<=Date.now()||!worker.token_hash||worker.token_hash.length!==64||!timingSafeEqual(Buffer.from(worker.token_hash),Buffer.from(hash(token))))return h.json(401,{error:'WORKER_UNAUTHORIZED'});
  h.checked(await db.from('content_desktop_workers').update({last_seen_at:new Date().toISOString()}).eq('id',worker.id));
  if(event.httpMethod==='GET')return h.json(200,{connected:true,name:worker.name,enabled:release.productionEnabled&&process.env.CONTENT_DESKTOP_WORKER_ENABLED==='true'});
  const d=JSON.parse(event.body||'{}');
  if(d.action==='claim'){
   if(!release.productionEnabled||process.env.CONTENT_DESKTOP_WORKER_ENABLED!=='true')return h.json(503,{error:'WORKER_DISABLED'});
   const row=h.checked(await db.rpc('content_desktop_claim',{worker:worker.id}));
   return h.json(200,{job:row?await payload(db,row):null});
  }
  if(!m.uuid(d.id))return h.json(400,{error:'INVALID_JOB'});
  const row=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).eq('desktop_worker_id',worker.id).maybeSingle());
  if(!row)return h.json(404,{error:'JOB_NOT_ASSIGNED'});
  if(d.action==='job')return h.json(200,{job:await payload(db,row)});
  if(d.action==='complete'&&row.state==='completed'&&row.result_sha256===d.sha256&&row.desktop_thread_id===d.threadId)return h.json(200,{saved:true});
  if(row.state!=='working')return h.json(409,{error:'JOB_NOT_WORKING'});
  if(d.action==='stage'){
   if(!stages[d.stage])return h.json(400,{error:'INVALID_STAGE'});
   if(d.threadId&&(!/^[a-zA-Z0-9:_-]{1,160}$/.test(d.threadId)||(row.desktop_thread_id&&row.desktop_thread_id!==d.threadId)))return h.json(409,{error:'THREAD_MISMATCH'});
   if(row.desktop_stage===d.stage&&(!d.threadId||row.desktop_thread_id===d.threadId))return h.json(200,{saved:true});
   const entry={id:randomUUID(),text:stages[d.stage],at:new Date().toISOString()};
   const changed=h.checked(await db.from('content_pixeling_requests').update({desktop_stage:d.stage,...(d.threadId?{desktop_thread_id:d.threadId}:{}),progress_events:[...(row.progress_events||[]).slice(-98),entry],updated_at:entry.at}).eq('id',row.id).eq('state','working').eq('updated_at',row.updated_at).select('id'));
   return changed.length?h.json(200,{saved:true}):h.json(409,{error:'JOB_CHANGED'});
  }
  if(d.action==='upload'){
   if(!row.desktop_thread_id||!Number.isSafeInteger(d.size)||d.size<12||d.size>150*1024*1024||!/^[a-f0-9]{64}$/.test(d.sha256||''))return h.json(400,{error:'INVALID_OUTPUT'});
   if(row.result_sha256&&row.result_sha256!==d.sha256)return h.json(409,{error:'OUTPUT_CHANGED'});
   // Stable content-addressed path: retry cannot substitute a different file unnoticed.
   const path='desktop/'+row.id+'/'+d.sha256+'.mp4';
   const signed=h.checked(await db.storage.from(h.bucket).createSignedUploadUrl(path,{upsert:true}));
   h.checked(await db.from('content_pixeling_requests').update({result_path:path,result_size:d.size,result_sha256:d.sha256}).eq('id',row.id).eq('state','working'));
   return h.json(200,{url:signed.signedUrl});
  }
  if(d.action==='complete'){
   if(!row.result_path||row.result_sha256!==d.sha256||row.desktop_thread_id!==d.threadId)return h.json(409,{error:'OUTPUT_MISMATCH'});
   const blob=h.checked(await db.storage.from(h.bucket).download(row.result_path));
   if(blob.size!==row.result_size||blob.size>150*1024*1024)return h.json(400,{error:'OUTPUT_SIZE_MISMATCH'});
   const bytes=Buffer.from(await blob.arrayBuffer());
   if(!h.validMedia(bytes,'video/mp4')||hash(bytes)!==row.result_sha256)return h.json(400,{error:'OUTPUT_INVALID'});
   const changed=h.checked(await db.from('content_pixeling_requests').update({state:'completed',desktop_stage:'completed',updated_at:new Date().toISOString()}).eq('id',row.id).eq('state','working').eq('result_sha256',d.sha256).select('id'));
   return changed.length?h.json(200,{saved:true}):h.json(409,{error:'JOB_CHANGED'});
  }
  return h.json(400,{error:'INVALID_ACTION'});
 }catch{return h.json(503,{error:'DESKTOP_STORAGE_UNAVAILABLE'});}
};
