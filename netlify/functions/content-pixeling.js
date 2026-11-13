const release=require('../lib/content-studio-release.cjs');
const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
const catalog=require('../data/content-pixeling-catalog.json');
const {randomUUID}=require('node:crypto');
const files=require('../lib/content-studio-files.cjs');
const presets=require('../lib/content-studio-presets.cjs');
const inputBucket='content-studio-input';
const enabled=()=>release.productionEnabled&&process.env.CONTENT_PIXELING_REQUESTS_ENABLED==='true';
const safe=row=>({id:row.id,presetId:row.preset_id,presetName:row.preset_name,presetVersion:row.preset_version,text:row.text,parentId:row.parent_id,state:row.state,resultDeleted:!!row.result_deleted_at,projectId:row.project_id||row.parent_id||row.id,createdAt:row.created_at,updatedAt:row.updated_at,attachments:(row.attachments||[]).map(f=>({id:f.id,name:f.name,type:f.type,size:f.size})),events:row.progress_events||[]});
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'지원하지 않는 요청입니다.'});
 if(!h.originAllowed(event))return h.json(403,{error:'허용되지 않은 요청입니다.'});
 try{
  const db=h.db(),owner=await m.member(event,db),admin=!!await h.admin(event,db);
  if(release.adminOnly&&!admin)return h.json(403,{error:'운영자 전용 테스트 페이지입니다.'});
  if(event.httpMethod==='GET'){
   const manage=admin&&event.queryStringParameters?.manage==='1';let requests=[],storageReady=true;
   if(owner){let q=db.from('content_pixeling_requests').select('*').order('created_at',{ascending:false}).limit(100);if(!manage)q=q.eq('owner_id',owner);const result=await q;if(result.error){storageReady=false;}else{requests=await Promise.all(result.data.map(async row=>({...safe(row),attachments:await Promise.all((row.attachments||[]).map(async f=>({id:f.id,name:f.name,type:f.type,size:f.size,...(row.state!=='uploading'?{url:h.checked(await db.storage.from(inputBucket).createSignedUrl(f.path,600,{download:f.name})).signedUrl}:{})}))),...(row.state==='completed'&&!row.result_deleted_at&&row.result_path?{url:h.checked(await db.storage.from(h.bucket).createSignedUrl(row.result_path,600)).signedUrl}:{})})));}}
   return h.json(200,{catalog,requests,admin,accepting:enabled()&&storageReady,storageReady,execution:'operator',billing:'not_connected'});
  }
  if(!owner)return h.json(401,{error:'로그인 후 이용해 주세요.'});
  const d=JSON.parse(event.body||'{}');
  if(d.action==='request'){
   if(!enabled())return h.json(503,{error:'영상 제작 연결을 준비하고 있습니다. 아직 주문·결제는 접수하지 않습니다.'});
   const p=catalog.items.find(p=>p.id===d.presetId)||await presets.find(db,d.presetId||'',owner);
   if(d.projectId&&!m.uuid(d.projectId))return h.json(400,{error:'프로젝트 번호를 확인해 주세요.'});
   const incoming=d.files||[];if(!files.valid(incoming))return h.json(400,{error:'첨부파일은 최대 8개, 파일당 100MB, 합계 300MB까지 지원합니다.'});
   if(!p||!m.uuid(d.id)||typeof d.text!=='string'||!d.text.trim()||d.text.length>5000||d.confirmed!==true)return h.json(400,{error:'프리셋과 요청 내용을 확인해 주세요.'});
   const prior=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).maybeSingle());
   if(prior){if(prior.owner_id!==owner||prior.text!==d.text||prior.preset_id!==p.id||prior.parent_id!==(d.parentId||null)||(d.projectId&&prior.project_id!==d.projectId)||JSON.stringify((prior.attachments||[]).map(({name,type,size})=>({name,type,size})))!==JSON.stringify(incoming.map(({name,type,size})=>({name,type,size}))))return h.json(409,{error:'다른 요청과 번호가 겹쳤습니다. 다시 시도해 주세요.'});return h.json(200,{request:safe(prior)});}
   if(d.parentId){if(!m.uuid(d.parentId))return h.json(400,{error:'수정할 완성본을 확인해 주세요.'});const parent=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.parentId).eq('owner_id',owner).eq('state','completed').eq('preset_id',p.id).maybeSingle());if(parent&&d.projectId&&(parent.project_id||parent.id)!==d.projectId)return h.json(400,{error:'같은 프로젝트의 완성본만 수정할 수 있습니다.'});if(parent?.result_deleted_at)return h.json(400,{error:'삭제한 결과물은 수정할 수 없습니다.'});if(!parent)return h.json(400,{error:'내 완성본만 수정할 수 있습니다.'});}
   // Preserve the exact customer's text. Do not execute it as code or add secret instructions.
   if(d.projectId){
    const project=h.checked(await db.from('content_studio_projects').select('id,owner_id,deleted_at').eq('id',d.projectId).maybeSingle());
    if(project?.deleted_at)return h.json(409,{error:'삭제한 프로젝트에는 새 요청을 추가할 수 없습니다.'});
    if(project&&project.owner_id!==owner)return h.json(403,{error:'내 프로젝트만 이용할 수 있습니다.'});
    if(!project)h.checked(await db.from('content_studio_projects').insert({id:d.projectId,owner_id:owner,title:d.text.trim().slice(0,100)}));
   }
   const attachments=incoming.map(f=>{const id=randomUUID();return{id,name:f.name,type:f.type,size:f.size,path:'studio-input/'+d.id+'/'+id+'.'+files.types[f.type]};});
   const row=h.checked(await db.from('content_pixeling_requests').insert({...(d.projectId?{project_id:d.projectId}:{}),...(p.referenceId?{reference_result_id:p.referenceId}:{}),attachments,state:attachments.length?'uploading':'submitted',id:d.id,owner_id:owner,preset_id:p.id,preset_name:p.name,preset_version:p.version,text:d.text,parent_id:d.parentId||null}).select('*').single());
   return h.json(200,{request:safe(row)});
  }
  if(['attachment-upload','attachments-ready'].includes(d.action)){
   if(!m.uuid(d.id))return h.json(400,{error:'요청 번호를 확인해 주세요.'});
   const own=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).eq('owner_id',owner).maybeSingle());
   if(!own)return h.json(404,{error:'내 요청만 이용할 수 있습니다.'});
   if(own.state!=='uploading')return d.action==='attachments-ready'?h.json(200,{request:safe(own)}):h.json(409,{error:'이미 접수된 첨부파일은 변경할 수 없습니다.'});
   if(d.action==='attachment-upload'){
    const file=(own.attachments||[]).find(f=>f.id===d.fileId);if(!file)return h.json(400,{error:'첨부파일을 확인해 주세요.'});
    if(await files.verify(db,inputBucket,file))return h.json(200,{uploaded:true});
    const signed=h.checked(await db.storage.from(inputBucket).createSignedUploadUrl(file.path));
    return h.json(200,{bucket:inputBucket,path:file.path,token:signed.token,url:signed.signedUrl});
   }
   for(const file of own.attachments||[])if(!await files.verify(db,inputBucket,file))return h.json(400,{error:'파일 업로드 또는 파일 형식을 확인해 주세요.'});
   const changed=h.checked(await db.from('content_pixeling_requests').update({state:'submitted',updated_at:new Date().toISOString()}).eq('id',own.id).eq('state','uploading').select('*'));
   return changed.length?h.json(200,{request:safe(changed[0])}):h.json(409,{error:'접수 상태가 변경되었습니다. 다시 확인해 주세요.'});
  }
  if(!admin)return h.json(403,{error:'운영자만 이용할 수 있습니다.'});
  if(!m.uuid(d.id))return h.json(400,{error:'주문을 확인해 주세요.'});
  const row=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).single());
  if(d.action==='progress'){
   if(row.state!=='working'||typeof d.message!=='string'||!d.message.trim()||d.message.length>1000)return h.json(400,{error:'제작 중인 주문에 회원에게 보여줄 작업 내용을 1,000자 이내로 입력하세요.'});
   if((row.progress_events||[]).length>=100)return h.json(400,{error:'작업 기록은 최대 100개입니다.'});
   const entry={id:randomUUID(),text:d.message,at:new Date().toISOString()};
   const changed=h.checked(await db.from('content_pixeling_requests').update({progress_events:[...(row.progress_events||[]),entry],updated_at:entry.at}).eq('id',row.id).eq('state','working').eq('updated_at',row.updated_at).select('id'));
   return changed.length?h.json(200,{saved:true}):h.json(409,{error:'다른 작업 기록이 갱신되었습니다. 다시 보내주세요.'});
  }
  if(d.action==='handoff'){
   let source=row;const references=[],seen=new Set([row.id]);
   while(source.reference_result_id||source.parent_id){
    const id=source.reference_result_id||source.parent_id;
    if(seen.has(id)||references.length>=30)throw Error('invalid reference chain');seen.add(id);
    source=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',id).eq('owner_id',row.owner_id).eq('state','completed').single());
    references.push({orderId:source.id,presetId:source.preset_id,presetVersion:source.preset_version,message:source.text,url:h.checked(await db.storage.from(h.bucket).createSignedUrl(source.result_path,600)).signedUrl});
   }
   let customPrompt=null;
   const q=db.from('content_studio_presets').select('private_prompt');
   const custom=h.checked(await (source.preset_id.startsWith('studio_')?q.eq('id',source.preset_id.slice(7)):q.eq('source_preset_id',source.preset_id)).maybeSingle());customPrompt=custom?.private_prompt||null;
   return h.json(200,{job:{privateProductionInstructions:customPrompt,references,orderId:row.id,preset:{id:source.preset_id,name:source.preset_name,version:source.preset_version},selectedPreset:{id:row.preset_id,name:row.preset_name,version:row.preset_version},message:row.text,parentOrderId:row.parent_id,attachments:await Promise.all((row.attachments||[]).map(async f=>({name:f.name,type:f.type,url:h.checked(await db.storage.from(inputBucket).createSignedUrl(f.path,600,{download:f.name})).signedUrl}))),instructions:'원본 프리셋 ID·버전을 확인하고 고객 message를 그대로 전달하세요. references가 있으면 해당 완성본과 이전 요청을 함께 참고하여 수정하세요. 이것은 실행 완료 확인이 아닌 작업 전달 파일입니다.'}});
  }
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
  if(event.httpMethod==='GET'&&!release.adminOnly)return h.json(200,{catalog,requests:[],admin:false,accepting:false,storageReady:false,execution:'operator',billing:'not_connected'});
  return h.json(503,{error:'콘텐츠 제작 저장소 연결을 확인해 주세요. 입력한 내용은 지우지 말고 다시 시도해 주세요.'});
 }
};

