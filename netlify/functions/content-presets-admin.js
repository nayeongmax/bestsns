const presetConfig=require('../lib/content-preset.cjs');
const references=require('../lib/content-reference.cjs');
const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');const {randomUUID}=require('node:crypto');
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Forbidden'});
 try{const db=h.db();if(!await h.admin(event,db))return h.json(403,{error:'관리자만 이용할 수 있습니다.'});
 if(event.httpMethod==='GET')return h.json(200,{presets:h.checked(await db.from('content_video_presets').select('*').order('updated_at',{ascending:false}))});
 const d=JSON.parse(event.body||'{}');
 if(d.action==='reference'){try{return h.json(200,{reference:references.reference(d.url)});}catch{return h.json(400,{error:'유튜브 영상, 인스타그램 릴스/게시물, 네이버 클립의 원본 HTTPS 링크를 입력해 주세요.'});}}
 if(d.action==='discover'){try{return h.json(200,await references.discover(d));}catch(e){return h.json(503,{error:e.message==='KEY'?'운영자 유튜브 검색 API 키 연결이 필요합니다. 원본 링크 등록은 사용할 수 있습니다.':'유튜브 후보를 불러오지 못했습니다. 검색어와 API 할당량을 확인해 주세요.'});}}
 if(d.action==='draft'){if(!presetConfig.valid(d.productionSettings||{},d.format||'short'))return h.json(400,{error:'제작 설정을 확인해 주세요.'});return h.json(200,{prompt:presetConfig.scaffold(d.productionSettings||{},d.format||'short')});}
 if(d.action==='analyze'){
  if(!m.uuid(d.id)||!h.sharedKey())return h.json(400,{error:'저장된 샘플과 운영자 API 연결을 확인해 주세요.'});
  const preset=h.checked(await db.from('content_video_presets').select('*').eq('id',d.id).single());if(!preset?.sample)return h.json(400,{error:'샘플을 저장해 주세요.'});
  if(['queued','running'].includes(preset.analysis_status))return h.json(409,{error:'이미 분석 중입니다.'});
  const changed=h.checked(await db.from('content_video_presets').update({analysis_status:'queued'}).eq('id',d.id).eq('updated_at',preset.updated_at).select('id'));if(!changed.length)return h.json(409,{error:'설정이 변경됐습니다. 새로고침해 주세요.'});
  try{const base=process.env.DEPLOY_URL||process.env.URL;if(!base||new URL(base).protocol!=='https:')throw Error('URL');const response=await fetch(base+'/.netlify/functions/content-preset-analyze-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,version:preset.updated_at,signature:h.sign('preset:'+d.id+':'+preset.updated_at)}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('DISPATCH');}catch{await db.from('content_video_presets').update({analysis_status:'failed'}).eq('id',d.id);return h.json(503,{error:'분석 작업을 시작하지 못했습니다.'});}
  return h.json(200,{queued:true});
 }
 if(d.action==='sample'){
  if(!Number.isSafeInteger(d.size)||d.size<1||d.size>100*1024*1024)return h.json(400,{error:'샘플은 100MB 이하 MP4로 올려주세요.'});
  const path='presets/'+randomUUID()+'.mp4',upload=h.checked(await db.storage.from(h.bucket).createSignedUploadUrl(path));return h.json(200,{bucket:h.bucket,path,token:upload.token});
 }
 if(d.action==='subscription'){
  if(!m.uuid(d.owner)||!['starter','pro','business'].includes(d.plan)||!Number.isFinite(Date.parse(d.validUntil))||Date.parse(d.validUntil)<=Date.now()||typeof d.reference!=='string'||d.reference.trim().length<8||d.reference.length>200)return h.json(400,{error:'회원 ID, 요금제, 만료일, 확인한 결제 번호를 확인해 주세요.'});
  const profile=h.checked(await db.from('profiles').select('id').eq('id',d.owner).single());if(!profile)return h.json(404,{error:'회원을 찾을 수 없습니다.'});
  h.checked(await db.from('content_subscriptions').upsert({owner_id:d.owner,plan:d.plan,valid_until:new Date(d.validUntil).toISOString(),payment_reference:d.reference.trim(),auto_upload_opt_in:false,updated_at:new Date().toISOString()}));return h.json(200,{saved:true});
 }
 if(d.action==='grant'){
  if(!m.uuid(d.owner)||!Number.isSafeInteger(d.amount)||d.amount<1||d.amount>1000000||typeof d.reference!=='string'||d.reference.trim().length<8||d.reference.length>200)return h.json(400,{error:'회원 ID, 지급 크레딧, 확인한 결제 고유 번호를 입력해 주세요.'});
  const profile=h.checked(await db.from('profiles').select('id').eq('id',d.owner).single());if(!profile)return h.json(404,{error:'회원을 찾을 수 없습니다.'});
  return h.json(200,{balance:h.checked(await db.rpc('grant_content_credits',{p_owner:d.owner,p_amount:d.amount,p_reference:d.reference.trim()}))});
 }
 if(d.action==='save'&&(typeof d.name!=='string'||!d.name.trim()))return h.json(400,{error:'스타일 이름을 입력해 주세요. 예: 일상 브이로그'});
 if(d.action==='save'&&d.published&&(!d.sample||typeof d.prompt!=='string'||!d.prompt.trim()))return h.json(400,{error:'회원 공개에는 MP4 샘플과 제작 프롬프트가 필요합니다. 공개를 끄면 비공개 초안으로 저장할 수 있습니다.'});
 if(d.action!=='save'||(d.id&&!m.uuid(d.id))||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||typeof d.description!=='string'||d.description.length>1000||typeof d.prompt!=='string'||d.prompt.length>20000||typeof d.published!=='boolean'||![d.price,d.revisionPrice].every(n=>n===null||Number.isSafeInteger(n)&&n>0&&n<=1000000))return h.json(400,{error:'입력 길이와 요금을 확인해 주세요. 요금은 비워 두거나 1 이상의 정수로 입력하세요.'});
 if(!presetConfig.valid(d.productionSettings||{},d.format||'short'))return h.json(400,{error:'컷·길이·음성·자막 설정 범위를 확인해 주세요.'});
 const sample=d.sample;if(sample&&(!/^presets\/[0-9a-f-]+\.mp4$/.test(sample.path)||sample.type!=='video/mp4'||!Number.isSafeInteger(sample.size)||sample.size<1||sample.size>100*1024*1024))return h.json(400,{error:'유효한 MP4 샘플을 첨부해 주세요.'});
 if(sample){const files=h.checked(await db.storage.from(h.bucket).list('presets',{search:sample.path.split('/')[1],limit:10}));if(!files.some(f=>f.name===sample.path.split('/')[1]&&Number(f.metadata?.size)===sample.size))return h.json(400,{error:'샘플 업로드를 먼저 완료해 주세요.'});}
 if(d.published&&!sample)return h.json(400,{error:'샘플 영상이 있어야 공개할 수 있습니다.'});
 const row={id:d.id||randomUUID(),name:d.name.trim(),description:d.description.trim(),prompt:d.prompt.trim(),sample:sample?{path:sample.path,type:sample.type,size:sample.size}:null,price:d.price,revision_price:d.revisionPrice,published:d.published,video_format:d.format||'short',production_settings:presetConfig.normalize(d.productionSettings||{},d.format||'short'),updated_at:new Date().toISOString()};
 try{row.reference=references.reference(d.reference);}catch{return h.json(400,{error:'참고 영상 링크를 확인해 주세요.'});}
 if(d.id){const previous=h.checked(await db.from('content_video_presets').select('sample,analysis,analysis_status').eq('id',d.id).single());if(['queued','running'].includes(previous.analysis_status))return h.json(409,{error:'분석이 끝난 뒤 저장해 주세요.'});if(previous.sample?.path!==sample?.path){row.analysis=null;row.analysis_status='none';}}
 h.checked(await db.from('content_video_presets').upsert(row));return h.json(200,{saved:true,id:row.id});
 }catch(e){return h.json(503,{error:'설정을 처리하지 못했습니다. 저장소와 관리자 연결을 확인해 주세요.'});}
};
