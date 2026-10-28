const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');const {randomUUID}=require('node:crypto');
const stamp=()=>new Date().toISOString();
async function own(db,owner,id){if(!m.uuid(id))throw Error('NOT_FOUND');const chat=h.checked(await db.from('content_ai_chats').select('*').eq('id',id).eq('owner_id',owner).eq('member',true).single());if(!chat)throw Error('NOT_FOUND');return chat;}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Forbidden'});
 if(!m.enabled())return h.json(503,{error:'회원 영상 제작을 준비하고 있습니다.'});
 try{const db=h.db(),owner=await m.member(event,db);if(!owner)return h.json(401,{error:'로그인 후 이용해 주세요.'});
 if(event.httpMethod==='GET'){
  const presets=h.checked(await db.from('content_video_presets').select('id,name,description,price,revision_price,updated_at,sample,video_format,production_settings').eq('published',true).order('updated_at',{ascending:false}));
  const catalog=[];for(const p of presets){if(!p.sample)continue;const url=h.checked(await db.storage.from(h.bucket).createSignedUrl(p.sample.path,600)).signedUrl;catalog.push({...m.publicPreset(p),sampleUrl:url});}
  const wallet=h.checked(await db.from('content_wallets').select('balance').eq('owner_id',owner).maybeSingle());
  const chats=h.checked(await db.from('content_ai_chats').select('id,title,status,updated_at').eq('owner_id',owner).eq('member',true).order('updated_at',{ascending:false}).limit(50));
  let detail=null;const id=event.queryStringParameters?.chat;
  if(id){const chat=await own(db,owner,id);const jobs=h.checked(await db.from('content_ai_jobs').select('id,status,charge,billing_state,parent_job_id,created_at').eq('chat_id',id).eq('owner_id',owner).order('created_at',{ascending:false}).limit(50));
   const assets=[];for(const a of chat.assets){const url=h.checked(await db.storage.from(h.bucket).createSignedUrl(a.path,600)).signedUrl;assets.push({name:a.name,type:a.type,size:a.size,path:a.path,url});}
   const results=[];for(const a of chat.results){const url=h.checked(await db.storage.from(h.bucket).createSignedUrl(a.path,600)).signedUrl;results.push({name:'완성 영상.mp4',type:a.type,path:a.path,jobId:a.jobId,url});}
   // Never expose snapshots, private prompts or model-generated prose to members.
   const requests=chat.messages.filter(x=>x.role==='user').map(x=>({id:x.id,text:x.text,createdAt:x.createdAt}));
   detail={id:chat.id,presetId:chat.preset_id,title:chat.title,status:chat.status,assets,results,jobs,requests};
  }
  return h.json(200,{presets:catalog,balance:wallet?.balance||0,chats,chat:detail});
 }
 const d=JSON.parse(event.body||'{}');
 if(d.action==='chat'){
  if(!m.uuid(d.presetId))return h.json(400,{error:'스타일을 선택해 주세요.'});
  const preset=h.checked(await db.from('content_video_presets').select('id,name').eq('id',d.presetId).eq('published',true).single());if(!preset)throw Error('PRESET_UNAVAILABLE');
  const project=h.checked(await db.from('content_ai_projects').insert({owner_id:owner,name:'회원 영상 제작'}).select('id').single());
  const chat=h.checked(await db.from('content_ai_chats').insert({owner_id:owner,project_id:project.id,title:preset.name,member:true,preset_id:preset.id}).select('id').single());return h.json(200,chat);
 }
 const chat=await own(db,owner,d.chatId);
 if(d.action==='prepare'){
  if(['queued','running'].includes(chat.status))throw Error('JOB_ACTIVE');
  if(!h.validFiles(d.files)||d.files.some(f=>f.role!=='source')||chat.assets.length+d.files.length>12||chat.assets.reduce((n,f)=>n+f.size,0)+d.files.reduce((n,f)=>n+f.size,0)>300*1024*1024)return h.json(400,{error:'영상·사진을 파일당 100MB, 총 12개·300MB 이하로 첨부해 주세요.'});
  const extensions={'video/mp4':'.mp4','video/quicktime':'.mov','video/webm':'.webm','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
  const assets=d.files.map(f=>({name:f.name,type:f.type,size:f.size,role:'source',path:'ai/'+chat.id+'/inputs/'+randomUUID()+extensions[f.type]}));
  const changed=h.checked(await db.from('content_ai_chats').update({assets:[...chat.assets,...assets],updated_at:stamp()}).eq('id',chat.id).eq('owner_id',owner).eq('updated_at',chat.updated_at).select('id'));if(!changed.length)throw Error('JOB_ACTIVE');
  const uploads=[];for(const a of assets){const signed=h.checked(await db.storage.from(h.bucket).createSignedUploadUrl(a.path));uploads.push({path:a.path,token:signed.token});}return h.json(200,{bucket:h.bucket,uploads});
 }
 if(d.action==='remove-asset'){
  if(['queued','running'].includes(chat.status))throw Error('JOB_ACTIVE');
  h.checked(await db.from('content_ai_chats').update({assets:chat.assets.filter(a=>a.path!==d.path),updated_at:stamp()}).eq('id',chat.id).eq('owner_id',owner).eq('updated_at',chat.updated_at));return h.json(200,{removed:true});
 }
 if(d.action!=='run')return h.json(400,{error:'지원하지 않는 요청입니다.'});
 if(!m.uuid(d.requestId)||!m.uuid(d.presetId)||typeof d.text!=='string'||!d.text.trim()||d.text.length>5000||typeof d.version!=='string'||!Number.isSafeInteger(d.expectedPrice)||d.expectedPrice<1||(d.parentJobId&&!m.uuid(d.parentJobId))||d.confirmed!==true)return h.json(400,{error:'제작 요청과 이번 요금을 확인해 주세요.'});
 if(chat.preset_id!==d.presetId)throw Error('PRESET_UNAVAILABLE');
 if(!h.sharedKey())return h.json(503,{error:'제작 연결을 준비하고 있습니다.'});
 // Resolve a replay before source validation; it must never trigger another charge or dispatch.
 const prior=h.checked(await db.from('content_ai_jobs').select('id,owner_id,chat_id,charge,status,billing_state').eq('id',d.requestId).maybeSingle());
 if(prior){if(prior.owner_id!==owner||prior.chat_id!==chat.id)throw Error('REQUEST_CONFLICT');return h.json(200,{id:prior.id,created:false,amount:prior.charge,status:prior.status,billingState:prior.billing_state});}
 const preset=h.checked(await db.from('content_video_presets').select('id,sample,video_format,production_settings').eq('id',d.presetId).eq('published',true).single());if(!preset?.sample)throw Error('PRESET_UNAVAILABLE');if(preset.video_format==='long'&&process.env.CONTENT_LONGFORM_ENABLED!=='true')return h.json(503,{error:'롱폼은 샘플을 볼 수 있으며 제작 실행은 검증 후 활성화됩니다.'});
 if(!chat.assets.some(a=>a.role==='source'))return h.json(400,{error:'원본 영상 또는 사진을 첨부해 주세요.'});
 const stored=h.checked(await db.storage.from(h.bucket).list('ai/'+chat.id+'/inputs',{limit:100}));
 if(chat.assets.some(a=>!stored.some(f=>f.name===a.path.split('/').pop()&&Number(f.metadata?.size)===a.size)))return h.json(400,{error:'업로드가 끝나지 않았습니다. 실패한 첨부를 제거하고 다시 첨부해 주세요.'});
 let previousResults=[];
 if(d.parentJobId){previousResults=chat.results.filter(r=>r.jobId===d.parentJobId);if(!previousResults.length)throw Error('INVALID_PARENT');}
 const snapshot={member:true,presetId:preset.id,assets:[...chat.assets,{...preset.sample,name:'style-sample.mp4',role:'reference'}],previousResults,messages:[],text:d.text.trim(),kind:'video',settings:{...h.defaults},format:preset.video_format||'short',productionSettings:preset.production_settings||{},options:{length:String(preset.production_settings?.duration||(preset.video_format==='long'?300:30))+'초'}};
 const queued=h.checked(await db.rpc('enqueue_paid_content_job',{p_id:d.requestId,p_owner:owner,p_chat:chat.id,p_preset:preset.id,p_version:d.version,p_expected:d.expectedPrice,p_parent:d.parentJobId||null,p_snapshot:snapshot}));
 if(queued.created){try{await m.dispatch(db,queued.id);}catch(e){h.checked(await db.rpc('fail_paid_content_job',{p_job:queued.id}));return h.json(503,{error:'제작을 시작하지 못해 크레딧을 돌려드렸습니다.'});}}
 return h.json(200,queued);
 }catch(e){return h.json(400,{error:m.safeMemberError(e)});}
};
