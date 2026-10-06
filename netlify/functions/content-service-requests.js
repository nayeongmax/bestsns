const h = require('../lib/content-test.cjs');
const { randomUUID } = require('node:crypto');
const table = 'content_service_requests';
const types = ['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'];
function validFiles(files,max=50) {
  return Array.isArray(files)&&files.length>0&&files.length<=max&&files.every(f=>typeof f.name==='string'&&f.name.length<=255&&types.includes(f.type)&&Number.isSafeInteger(f.size)&&f.size>0&&f.size<=524288000)&&files.reduce((n,f)=>n+f.size,0)<=5*1024**3;
}
function validDetails(d) {
  return d&&['name','contact','industry','business','request'].every(k=>typeof d[k]==='string'&&d[k].trim().length>0&&d[k].length<=(k==='request'?10000:200))&&['video','images','both'].includes(d.kind)&&Array.isArray(d.references)&&d.references.length<=10&&d.references.every(x=>{try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)&&x.length<=2000;}catch{return false;}});
}
async function uploaded(client,files,prefix) {
  const stored=h.checked(await client.storage.from(h.bucket).list(prefix,{limit:100}));
  return files.every(a=>stored.some(f=>f.name===a.path.split('/').pop()&&Number(f.metadata?.size)===a.size));
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Origin not allowed'});
 try {
  const client=h.db(),owner=await h.admin(event,client);
  if(!owner)return h.json(403,{error:'현재는 서버에서 인증한 관리자만 제작 의뢰를 테스트할 수 있습니다.'});
  if(event.httpMethod==='GET') {
   const rows=h.checked(await client.from(table).select('*').order('created_at',{ascending:false}).limit(30));
   for(const row of rows)for(const key of ['assets','results'])row[key]=await Promise.all((row[key]||[]).map(async f=>({...f,url:h.checked(await client.storage.from(h.bucket).createSignedUrl(f.path,600)).signedUrl})));
   return h.json(200,{requests:rows,admin:true,creditsOnHold:true});
  }
  let data;try{data=JSON.parse(event.body||'{}');}catch{return h.json(400,{error:'Invalid JSON'});}
  if(data.action==='prepare') {
   if(!validDetails(data.details)||!validFiles(data.files))return h.json(400,{error:'필수 정보와 참고 링크, 원본 파일 형식을 확인해 주세요. 최대 50개 · 파일당 500MB · 총 5GB입니다.'});
   const id=randomUUID(),assets=data.files.map(f=>({...f,path:`service/${id}/inputs/${randomUUID()}`}));
   h.checked(await client.from(table).insert({id,owner_id:owner,details:data.details,assets,status:'uploading'}));
   const uploads=await Promise.all(assets.map(async f=>({...f,token:h.checked(await client.storage.from(h.bucket).createSignedUploadUrl(f.path)).token})));
   return h.json(200,{id,bucket:h.bucket,uploads});
  }
  if(typeof data.id!=='string')return h.json(400,{error:'의뢰 번호를 확인해 주세요.'});
  const row=h.checked(await client.from(table).select('*').eq('id',data.id).single());
  const update=async(patch,status=row.status)=>{
   const rows=h.checked(await client.from(table).update({...patch,updated_at:new Date().toISOString()}).eq('id',row.id).eq('status',status).eq('quote_version',row.quote_version).select('id'));
   return rows?.length?h.json(200,{id:row.id}):h.json(409,{error:'의뢰 상태가 변경됐습니다. 새로고침 후 다시 확인해 주세요.'});
  };
  if(data.action==='submit') {
   if(row.owner_id!==owner)return h.json(403,{error:'본인의 의뢰만 제출할 수 있습니다.'});
   if(row.status!=='uploading')return h.json(409,{error:'이미 접수된 의뢰입니다.'});
   if(!await uploaded(client,row.assets,`service/${row.id}/inputs`))return h.json(400,{error:'원본 업로드가 완료되지 않았습니다.'});
   return update({status:'submitted'});
  }
  if(data.action==='quote') {
   if(!['submitted','quoted'].includes(row.status))return h.json(409,{error:'접수 또는 견적 확인 단계에서만 견적을 변경할 수 있습니다.'});
   if(!Number.isSafeInteger(data.credits)||data.credits<=0||data.credits>10000000||typeof data.note!=='string'||!data.note.trim()||data.note.length>10000)return h.json(400,{error:'양수 크레딧과 작업 범위를 입력해 주세요.'});
   return update({status:'quoted',quote_credits:data.credits,quote_note:data.note.trim(),quote_version:row.quote_version+1,approved_at:null});
  }
  if(data.action==='approve') {
   if(row.owner_id!==owner)return h.json(403,{error:'본인의 견적만 승인할 수 있습니다.'});
   if(row.status!=='quoted'||data.version!==row.quote_version||data.credits!==row.quote_credits)return h.json(409,{error:'최신 견적을 확인한 뒤 승인해 주세요.'});
   return update({status:'approved',approved_at:new Date().toISOString()});
  }
  if(data.action==='start') {
   if(row.status!=='approved')return h.json(409,{error:'고객이 견적을 승인한 의뢰만 제작을 시작할 수 있습니다.'});
   return update({status:'producing'});
  }
  if(data.action==='outputs') {
   if(row.status!=='producing'||!validFiles(data.files,20))return h.json(400,{error:'제작 중인 의뢰에 완성본 1~20개를 선택해 주세요.'});
   const results=data.files.map(f=>({...f,path:`service/${row.id}/outputs/${randomUUID()}`}));
   const response=await update({results});if(response.statusCode!==200)return response;
   const uploads=await Promise.all(results.map(async f=>({...f,token:h.checked(await client.storage.from(h.bucket).createSignedUploadUrl(f.path)).token})));
   return h.json(200,{id:row.id,bucket:h.bucket,uploads});
  }
  if(data.action==='complete') {
   if(row.status!=='producing'||!row.results?.length||!await uploaded(client,row.results,`service/${row.id}/outputs`))return h.json(400,{error:'완성본 업로드를 먼저 완료해 주세요.'});
   return update({status:'completed'});
  }
  return h.json(400,{error:'Invalid action'});
 }catch(e){console.error('content-service',e.message);return h.json(503,{error:/content_service_requests|schema cache|does not exist/i.test(e.message)?'제작 의뢰 저장소 설정이 필요합니다. Supabase에 20261006_content_service.sql을 적용해 주세요.':'제작 의뢰 저장소 연결 또는 파일 업로드 설정을 확인해 주세요.'});}
};
exports.validDetails=validDetails;
exports.validFiles=validFiles;
