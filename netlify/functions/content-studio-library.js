const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
const {randomUUID}=require('node:crypto');
exports.handler=async event=>{
 if(!h.originAllowed(event))return h.json(403,{error:'허용되지 않은 요청입니다.'});
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'지원하지 않는 요청입니다.'});
 try{
  const db=h.db(),owner=await m.member(event,db);
  if(!owner)return h.json(401,{error:'로그인 후 이용해 주세요.'});
  if(event.httpMethod==='GET'){
   const projects=h.checked(await db.from('content_studio_projects').select('id,title,deleted_at').eq('owner_id',owner));
   const rows=h.checked(await db.from('content_studio_personal_presets').select('id,name,format,request_id').eq('owner_id',owner));
   const items=[];
   for(const row of rows){
    const result=h.checked(await db.from('content_pixeling_requests').select('result_path,state').eq('id',row.request_id).eq('owner_id',owner).maybeSingle());
    if(result?.state==='completed'&&result.result_path)items.push({id:'personal_'+row.id,name:row.name,group:'personal',version:1,format:row.format,size:row.format==='short'?'9:16':'16:9',fps:'',thumbnail:null,previewUrl:h.checked(await db.storage.from(h.bucket).createSignedUrl(result.result_path,600)).signedUrl});
   }
   return h.json(200,{projects,items});
  }
  const d=JSON.parse(event.body||'{}');
  if(!m.uuid(d.id))return h.json(400,{error:'항목 번호를 확인해 주세요.'});
  if(['rename-project','delete-project'].includes(d.action)){
   const project=h.checked(await db.from('content_studio_projects').select('id').eq('id',d.id).eq('owner_id',owner).maybeSingle());
   if(!project)return h.json(404,{error:'내 프로젝트만 변경할 수 있습니다.'});
   if(d.action==='rename-project'&&(typeof d.name!=='string'||!d.name.trim()||d.name.length>100))return h.json(400,{error:'이름을 100자 이내로 입력하세요.'});
   h.checked(await db.from('content_studio_projects').update(d.action==='delete-project'?{deleted_at:new Date().toISOString()}:{title:d.name.trim()}).eq('id',d.id).eq('owner_id',owner));
   return h.json(200,{saved:true});
  }
  const result=h.checked(await db.from('content_pixeling_requests').select('*').eq('id',d.id).eq('owner_id',owner).maybeSingle());
  if(!result||result.state!=='completed'||!result.result_path)return h.json(404,{error:'내 완성 영상만 이용할 수 있습니다.'});
  if(d.action==='delete-result'){
   h.checked(await db.from('content_pixeling_requests').update({result_deleted_at:new Date().toISOString()}).eq('id',d.id).eq('owner_id',owner));
   return h.json(200,{saved:true});
  }
  if(d.action==='personal-preset'){
   if(result.result_deleted_at)return h.json(409,{error:'삭제한 결과물은 등록할 수 없습니다.'});
   if(typeof d.name!=='string'||!d.name.trim()||d.name.length>100||!['short','long'].includes(d.format))return h.json(400,{error:'프리셋 이름과 영상 형식을 확인하세요.'});
   const prior=h.checked(await db.from('content_studio_personal_presets').select('id').eq('owner_id',owner).eq('request_id',d.id).maybeSingle());
   if(prior)return h.json(200,{id:'personal_'+prior.id});
   const id=randomUUID();
   h.checked(await db.from('content_studio_personal_presets').insert({id,owner_id:owner,request_id:d.id,name:d.name.trim(),format:d.format}));
   return h.json(200,{id:'personal_'+id});
  }
  return h.json(400,{error:'지원하지 않는 요청입니다.'});
 }catch{return h.json(503,{error:'작업실 보관함 연결을 확인해 주세요. 변경 사항은 저장되지 않았습니다.'});}
};
