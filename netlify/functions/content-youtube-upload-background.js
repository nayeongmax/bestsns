const m=require('../lib/content-members.cjs');
const h=require('../lib/content-ai.cjs'),y=require('../lib/content-youtube.cjs');
exports.handler=async event=>{
 let db,post;
 if(event.httpMethod!=='POST')return h.json(405,{error:'Method not allowed'});
 try{const d=JSON.parse(event.body||'{}');if(!h.validSignature('youtube:'+d.id,d.signature)||!y.config().enabled||!m.enabled())return h.json(403,{error:'Forbidden'});
 db=h.db();const rows=h.checked(await db.from('content_social_posts').update({status:'running',updated_at:new Date().toISOString()}).eq('id',d.id).eq('provider','youtube').eq('status','queued').select('*'));if(!rows.length)return h.json(200,{ignored:true});post=rows[0];if(!(await m.subscription(db,post.owner_id)).canPublish)throw Error('PLAN');
 const connection=h.checked(await db.from('content_social_connections').select('*').eq('owner_id',post.owner_id).eq('provider','youtube').single());if(!connection||connection.channel_id!==post.channel_id)throw Error('CHANNEL_CHANGED');
 const tokens=await y.token({grant_type:'refresh_token',refresh_token:JSON.parse(h.decrypt(connection.tokens)).refresh_token});
 const actual=await y.channel(tokens.access_token);if(actual.id!==post.channel_id)throw Error('CHANNEL_CHANGED');
 const chat=h.checked(await db.from('content_ai_chats').select('results').eq('id',post.chat_id).eq('owner_id',post.owner_id).eq('member',true).single());const result=chat?.results.find(r=>r.path===post.result_path&&r.type==='video/mp4');if(!result)throw Error('NO_RESULT');
 const blob=h.checked(await db.storage.from(h.bucket).download(result.path));if(blob.size!==result.size||blob.size>150*1024*1024)throw Error('INVALID_SIZE');
 const auth={Authorization:'Bearer '+tokens.access_token};
 if(!post.session_url){
  const response=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{...auth,'Content-Type':'application/json','X-Upload-Content-Length':String(blob.size),'X-Upload-Content-Type':'video/mp4'},body:JSON.stringify(post.metadata),signal:AbortSignal.timeout(30000),redirect:'error'});
  const location=y.uploadURL(response.headers.get('location'));if(!response.ok||!location)throw Error('SESSION');
  h.checked(await db.from('content_social_posts').update({session_url:location}).eq('id',post.id));post.session_url=location;
 }
 const session=y.uploadURL(post.session_url);if(!session)throw Error('SESSION');
 const deadline=Date.now()+10*60000;let offset=0,finished=null;
 // Probe the same resumable session, including after ambiguous network responses. Never initiate a second upload.
 async function probe(){return fetch(session,{method:'PUT',headers:{...auth,'Content-Range':'bytes */'+blob.size,'Content-Length':'0'},signal:AbortSignal.timeout(30000),redirect:'error'});}
 function progress(response){const range=response.headers.get('range');return range?Number(range.match(/bytes=0-(\d+)/)?.[1])+1:0;}
 const initial=await probe();if(initial.ok)finished=await initial.json();else if(initial.status===308)offset=progress(initial);else throw Error('UPLOAD_STATE');
 while(!finished&&offset<blob.size){
  if(!(await m.subscription(db,post.owner_id)).canPublish)throw Error('PLAN');
  if(Date.now()>deadline)throw Error('TIMEOUT');
  const connected=h.checked(await db.from('content_social_connections').select('channel_id').eq('owner_id',post.owner_id).eq('provider','youtube').maybeSingle());if(connected?.channel_id!==post.channel_id)throw Error('CHANNEL_CHANGED');
  const end=Math.min(offset+8*1024*1024,blob.size);let response;
  try{response=await fetch(session,{method:'PUT',headers:{...auth,'Content-Type':'video/mp4','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end),signal:AbortSignal.timeout(90000),redirect:'error'});}catch(e){response=await probe();}
  if(response.ok){finished=await response.json();break;}if(response.status!==308)throw Error('UPLOAD_STATE');const next=progress(response);if(!Number.isSafeInteger(next)||next<=offset||next>blob.size)throw Error('UPLOAD_PROGRESS');offset=next;
  h.checked(await db.from('content_social_posts').update({updated_at:new Date().toISOString()}).eq('id',post.id));
 }
 if(!finished?.id||!/^[\w-]{6,100}$/.test(finished.id))throw Error('UPLOAD_STATE');
 h.checked(await db.from('content_social_posts').update({status:'uploaded',video_id:finished.id,privacy:finished.status?.privacyStatus||post.metadata.status.privacyStatus,message:'유튜브 전송 완료. 처리·공개 상태는 유튜브에서 확인해 주세요.',updated_at:new Date().toISOString()}).eq('id',post.id));
 return h.json(200,{uploaded:true});
 }catch(e){if(db&&post)await db.from('content_social_posts').update({status:post.session_url?'needs_review':'failed',message:post.session_url?'업로드 상태 확인이 필요합니다. 중복 게시를 막기 위해 자동 재게시하지 않습니다.':'유튜브 전송을 시작하지 못했습니다. 연결과 운영 설정을 확인해 주세요.',updated_at:new Date().toISOString()}).eq('id',post.id);return h.json(503,{error:'유튜브 업로드를 완료하지 못했습니다.'});}
};
