const h=require('../lib/content-ai.cjs');const{randomUUID}=require('node:crypto');
const now=()=>new Date().toISOString();
async function ownChat(client,owner,id){return h.checked(await client.from('content_ai_chats').select('*').eq('id',id).eq('owner_id',owner).single());}
const credential=h.credential;
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Origin not allowed'});
 try{
  const client=h.db(),owner=await h.admin(event,client);if(!owner)return h.json(403,{error:'서버에서 인증한 관리자만 이용할 수 있습니다.'});
  if(event.httpMethod==='GET'){
   const projects=h.checked(await client.from('content_ai_projects').select('*').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100));
   const chats=h.checked(await client.from('content_ai_chats').select('id,project_id,title,status,updated_at').eq('owner_id',owner).order('updated_at',{ascending:false}).limit(100));
   const key=await credential(client,owner);const policy=await h.policy(client);
   const saved=h.checked(await client.from('content_ai_settings').select('settings').eq('owner_id',owner).maybeSingle());
   let chat=null;const id=event.queryStringParameters?.chat;
   if(id){chat=await ownChat(client,owner,id);for(const group of[chat.assets,chat.results])for(const item of group){if(item.uploaded===false)continue;item.url=h.checked(await client.storage.from(h.bucket).createSignedUrl(item.path,600)).signedUrl;}chat.jobs=h.checked(await client.from('content_ai_jobs').select('id,status,message,created_at,updated_at').eq('chat_id',id).eq('owner_id',owner).order('created_at',{ascending:false}).limit(10));}
   return h.json(200,{projects,chats,chat,policy,sharedKeyConfigured:!!h.sharedKey(),key:key?{source:key.source||'personal',key_hint:key.key_hint,models:key.models,verified_at:key.verified_at}:null,settings:{...h.defaults,...saved?.settings},keyStorageReady:(process.env.CONTENT_AI_KEY_SECRET||'').length>=32});
  }
  const d=JSON.parse(event.body||'{}');
  if(d.action==='save-policy'){if(!h.validPolicy(d.policy))return h.json(400,{error:'크레딧은 0~1,000,000 정수 또는 미설정이어야 합니다. 지침은 20,000자 이내이며 적용 시 내용이 필요합니다.'});const policy={qualityMode:d.policy.qualityMode||'high',videoCredits:d.policy.videoCredits,imageCredits:d.policy.imageCredits,revisionCredits:d.policy.revisionCredits,instructions:d.policy.instructions.trim(),instructionsEnabled:d.policy.instructionsEnabled,updated_at:now(),updated_by:owner};h.checked(await client.from('content_ai_settings').upsert({owner_id:'__content_policy__',settings:policy}));return h.json(200,{saved:true,policy});}
  if(d.action==='verify-shared-key'){if(!h.sharedKey())return h.json(400,{error:'Netlify Functions에 CONTENT_OPENAI_API_KEY를 설정하고 다시 배포해 주세요.'});const models=await h.apiJSON(h.sharedKey(),'/models');const ids=(models.data||[]).map(m=>m.id).filter(id=>/^gpt-/.test(id)&&!/(realtime|audio|transcribe|tts|image)/.test(id)).sort();h.checked(await client.from('content_ai_settings').upsert({owner_id:'__shared_models__',settings:{models:ids,verified_at:now(),keyFingerprint:h.sharedFingerprint()}}));return h.json(200,{verified:true,message:'운영자 공용 키 인증 완료. 실제 제작 권한은 별도 확인됩니다.'});}
  if(d.action==='save-key'){
   if(h.sharedKey())return h.json(409,{error:'운영자 공용 키를 사용 중입니다. 키 변경은 Netlify에서 진행해 주세요.'});
   if(typeof d.key!=='string'||d.key.trim().length<20||d.key.length>1024)return h.json(400,{error:'OpenAI에서 발급받은 API 키를 입력해 주세요.'});
   const key=d.key.trim(),encrypted=h.encrypt(key);const models=await h.apiJSON(key,'/models');
   const ids=(models.data||[]).map(m=>m.id).filter(id=>/^gpt-/.test(id)&&!/(realtime|audio|transcribe|tts|image)/.test(id)).sort();
   h.checked(await client.from('content_ai_credentials').upsert({owner_id:owner,encrypted_key:encrypted,key_hint:'••••'+key.slice(-4),models:ids,verified_at:now()}));
   return h.json(200,{verified:true,models:ids,message:'키 인증 완료 · 영상 제작 실행 권한은 첫 제작에서 별도로 확인됩니다.'});
  }
  if(d.action==='remove-key'){if(h.sharedKey())return h.json(409,{error:'공용 키는 Netlify 환경 변수에서 관리합니다.'});h.checked(await client.from('content_ai_credentials').delete().eq('owner_id',owner));return h.json(200,{removed:true});}
  if(d.action==='settings'){
   if(!h.validSettings(d.settings))return h.json(400,{error:'모델·권한·저장 폴더 설정을 확인해 주세요.'});
   const key=await credential(client,owner);if(key&&!key.models.includes(d.settings.model))return h.json(400,{error:'연결된 API 계정의 모델 목록에서 선택해 주세요.'});
   h.checked(await client.from('content_ai_settings').upsert({owner_id:owner,settings:d.settings}));return h.json(200,{saved:true});
  }
  if(d.action==='project'){
   if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80)return h.json(400,{error:'프로젝트 이름은 1~80자로 입력해 주세요.'});
   const row=h.checked(await client.from('content_ai_projects').insert({owner_id:owner,name:d.name.trim()}).select('id').single());return h.json(200,row);
  }
  if(d.action==='chat'){
   const project=h.checked(await client.from('content_ai_projects').select('id').eq('id',d.projectId).eq('owner_id',owner).single());
   const row=h.checked(await client.from('content_ai_chats').insert({owner_id:owner,project_id:project.id,title:'새 제작 대화'}).select('id').single());return h.json(200,row);
  }
  const chat=await ownChat(client,owner,d.chatId);
  if(d.action==='prepare'){
   if(['queued','running'].includes(chat.status))return h.json(409,{error:'제작 중에는 원본을 변경할 수 없습니다.'});
   if(!h.validFiles(d.files)||chat.assets.length+d.files.length>12||chat.assets.reduce((n,f)=>n+f.size,0)+d.files.reduce((n,f)=>n+f.size,0)>300*1024*1024)return h.json(400,{error:'총 12개, 파일당 100MB, 대화당 총 300MB까지 첨부할 수 있습니다.'});
   const assets=d.files.map(f=>({name:f.name,type:f.type,size:f.size,role:f.role,uploaded:false,path:'ai/'+chat.id+'/inputs/'+randomUUID()+({ 'video/mp4':'.mp4','video/quicktime':'.mov','video/webm':'.webm','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp' }[f.type])}));
   const changed=h.checked(await client.from('content_ai_chats').update({assets:[...chat.assets,...assets],updated_at:now()}).eq('id',chat.id).eq('owner_id',owner).eq('updated_at',chat.updated_at).select('id'));if(!changed.length)return h.json(409,{error:'첨부 상태가 바뀌었습니다. 새로고침 후 다시 시도해 주세요.'});
   const uploads=await Promise.all(assets.map(async f=>({...f,token:h.checked(await client.storage.from(h.bucket).createSignedUploadUrl(f.path)).token})));return h.json(200,{bucket:h.bucket,uploads});
  }
  if(d.action==='remove-asset'){
   if(['queued','running'].includes(chat.status))return h.json(409,{error:'제작 중에는 원본을 변경할 수 없습니다.'});
   const assets=chat.assets.filter(a=>a.path!==d.path);h.checked(await client.from('content_ai_chats').update({assets,updated_at:now()}).eq('id',chat.id).eq('owner_id',owner).eq('updated_at',chat.updated_at));return h.json(200,{removed:true});
  }
  if(d.action==='cancel'){
   const jobs=h.checked(await client.from('content_ai_jobs').select('*').eq('chat_id',chat.id).eq('owner_id',owner).in('status',['queued','running']));
   const stored=await credential(client,owner);for(const job of jobs){if(job.response_id&&stored)await h.apiJSON(await h.executionKey(client,owner),'/responses/'+encodeURIComponent(job.response_id)+'/cancel',{}).catch(()=>{});h.checked(await client.from('content_ai_jobs').update({status:'failed',message:'운영자가 중지했습니다.',updated_at:now()}).eq('id',job.id).eq('owner_id',owner).in('status',['queued','running']));}
   h.checked(await client.from('content_ai_chats').update({status:'failed',updated_at:now()}).eq('id',chat.id).eq('owner_id',owner));return h.json(200,{cancelled:true});
  }
  if(d.action==='run'){
   if(typeof d.text!=='string'||!d.text.trim()||d.text.length>10000)return h.json(400,{error:'제작 요청을 1~10,000자로 입력해 주세요.'});
   if(['queued','running'].includes(chat.status))return h.json(409,{error:'이 대화에서 진행 중인 작업이 있습니다.'});
   const key=await credential(client,owner);if(!key)return h.json(400,{error:'AI 연결 설정에서 OpenAI API 키를 먼저 추가해 주세요.'});
   const saved=h.checked(await client.from('content_ai_settings').select('settings').eq('owner_id',owner).maybeSingle());const settings={...h.defaults,...saved?.settings};
   if(!key.models.includes(settings.model))return h.json(400,{error:'사용 가능한 모델을 AI 설정에서 선택해 주세요.'});
   if(settings.permission==='approve'&&d.approved!==true)return h.json(400,{error:'선택한 권한에 따라 이번 제작 실행을 승인해 주세요.'});
   if(d.provider!=='openai')return h.json(400,{error:'현재 실제 제작 연결은 OpenAI를 지원합니다.'});
   if(!chat.assets.some(a=>a.role==='source'))return h.json(400,{error:'원본 영상 또는 사진을 먼저 첨부해 주세요.'});
   const uploaded=h.checked(await client.storage.from(h.bucket).list('ai/'+chat.id+'/inputs',{limit:100}));
   if(chat.assets.some(a=>!uploaded.some(f=>f.name===a.path.split('/').pop()&&Number(f.metadata?.size)===a.size)))return h.json(400,{error:'원본·타겟 파일 업로드가 끝나지 않았습니다. 실패한 첨부를 제거하고 다시 올려 주세요.'});
   const currentPolicy=await h.policy(client),creditEstimate=h.estimate(currentPolicy,d.kind==='cards'?'cards':'video',d.options||{},chat.results.length>0);
   const changed=h.checked(await client.from('content_ai_chats').update({status:'queued',updated_at:now()}).eq('id',chat.id).eq('owner_id',owner).eq('updated_at',chat.updated_at).in('status',['idle','failed']).select('id'));if(!changed.length)return h.json(409,{error:'다른 요청이 먼저 실행되었습니다.'});
   const id=randomUUID(),message={id:randomUUID(),role:'user',text:d.text.trim(),createdAt:now()},assets=chat.assets.map(a=>({...a,uploaded:true}));
   const snapshot={policy:currentPolicy,creditEstimate,settings,messages:chat.messages.slice(-20),assets,previousResults:chat.results.slice(-10),text:d.text.trim(),kind:d.kind==='cards'?'cards':'video',options:d.options&&typeof d.options==='object'?{industry:String(d.options.industry||'').slice(0,100),style:String(d.options.style||'').slice(0,100),length:String(d.options.length||'30초').slice(0,20),cardCount:String(d.options.cardCount||'5장').slice(0,20),script:String(d.options.script||'').slice(0,10000)}:{}};
   try{
    h.checked(await client.from('content_ai_jobs').insert({id,owner_id:owner,chat_id:chat.id,snapshot}));
    h.checked(await client.from('content_ai_chats').update({assets,messages:[...chat.messages,message].slice(-100),title:chat.title==='새 제작 대화'?d.text.trim().slice(0,50):chat.title}).eq('id',chat.id).eq('owner_id',owner));
    const url=process.env.DEPLOY_URL||process.env.DEPLOY_PRIME_URL||process.env.URL;if(!url||new URL(url).protocol!=='https:')throw Error('NO_DEPLOY_URL');
    const dispatch=await fetch(url+'/.netlify/functions/content-ai-run-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,signature:h.sign(id)}),signal:AbortSignal.timeout(10000)});if(!dispatch.ok)throw Error('DISPATCH_FAILED');
    return h.json(200,{id,started:true,creditEstimate});
   }catch(e){await client.from('content_ai_jobs').update({status:'failed',message:h.safeError(e),updated_at:now()}).eq('id',id).eq('status','queued');await client.from('content_ai_chats').update({status:'failed',updated_at:now()}).eq('id',chat.id).eq('status','queued');throw e;}
  }
  return h.json(400,{error:'지원하지 않는 요청입니다.'});
 }catch(e){return h.json(503,{error:h.safeError(e)});}
};
