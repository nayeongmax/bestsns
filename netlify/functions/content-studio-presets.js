const release=require('../lib/content-studio-release.cjs');
const h=require('../lib/content-ai.cjs'),p=require('../lib/content-studio-presets.cjs'),f=require('../lib/content-studio-files.cjs');
const {randomUUID}=require('node:crypto');
const catalog=require('../data/content-pixeling-catalog.json');
exports.handler=async event=>{
 if(!h.originAllowed(event))return h.json(403,{error:'허용되지 않은 요청입니다.'});
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'지원하지 않는 요청입니다.'});
 try{
  const db=h.db(),admin=!!await h.admin(event,db);
  if(release.adminOnly&&!admin)return h.json(403,{error:"운영자 전용 테스트 페이지입니다."});
  if(event.httpMethod==='GET'){
   let items=[],rows=[],ready=true;
   try{items=await p.list(db);if(admin)rows=h.checked(await db.from('content_studio_presets').select('id,source_preset_id,name,description,format,published,created_at').order('created_at',{ascending:false}));}catch{ready=false;}
   return h.json(200,{items,rows,admin,ready});
  }
  if(!admin)return h.json(403,{error:'운영자만 프리셋을 등록할 수 있습니다.'});
  const d=JSON.parse(event.body||'{}');
  if(d.action==='prepare'){
   if(typeof d.name!=='string'||!d.name.trim()||d.name.length>100||typeof d.description!=='string'||d.description.length>1000||!['short','long'].includes(d.format)||typeof d.prompt!=='string'||!d.prompt.trim()||d.prompt.length>20000||!Number.isSafeInteger(d.size)||d.size<1||d.size>300*1024*1024||!Number.isSafeInteger(d.thumbnailSize)||d.thumbnailSize<1||d.thumbnailSize>1024*1024)return h.json(400,{error:'이름·분류·비공개 제작 지침과 300MB 이하 MP4를 확인해 주세요.'});
   if(d.sourceId&&!catalog.items.some(p=>p.id===d.sourceId))return h.json(400,{error:'기존 프리셋을 확인해 주세요.'});
   const id=randomUUID(),videoPath=id+'/video.mp4',thumbPath=id+'/thumbnail.jpg';
   h.checked(await db.from('content_studio_presets').insert({id,source_preset_id:d.sourceId||null,name:d.name.trim(),description:d.description,format:d.format,private_prompt:d.prompt,video_path:videoPath,video_size:d.size,thumbnail_path:thumbPath,thumbnail_size:d.thumbnailSize}));
   const video=h.checked(await db.storage.from(p.bucket).createSignedUploadUrl(videoPath));const thumbnail=h.checked(await db.storage.from(p.bucket).createSignedUploadUrl(thumbPath));
   return h.json(200,{id,bucket:p.bucket,video:{path:videoPath,token:video.token},thumbnail:{path:thumbPath,token:thumbnail.token}});
  }
  if(!/^[a-f0-9-]{36}$/i.test(d.id||''))return h.json(400,{error:'프리셋을 확인해 주세요.'});
  const row=h.checked(await db.from('content_studio_presets').select('*').eq('id',d.id).single());
  if(d.action==='publish'){
   if(!await f.verify(db,p.bucket,{path:row.video_path,size:row.video_size,type:'video/mp4'})||!await f.verify(db,p.bucket,{path:row.thumbnail_path,size:row.thumbnail_size,type:'image/jpeg'}))return h.json(400,{error:'영상·썸네일 업로드를 완료한 후 공개해 주세요.'});
   h.checked(await db.from('content_studio_presets').update({published:true}).eq('id',row.id));return h.json(200,{saved:true});
  }
  if(d.action==='hide'){h.checked(await db.from('content_studio_presets').update({published:false}).eq('id',row.id));return h.json(200,{saved:true});}
  if(d.action==='prompt'){return h.json(200,{prompt:row.private_prompt});}
  if(d.action==='update-prompt'){
   if(typeof d.prompt!=='string'||!d.prompt.trim()||d.prompt.length>20000)return h.json(400,{error:'비공개 지침을 20,000자 이내로 입력하세요.'});
   h.checked(await db.from('content_studio_presets').update({private_prompt:d.prompt}).eq('id',row.id));return h.json(200,{saved:true});
  }
  return h.json(400,{error:'지원하지 않는 요청입니다.'});
 }catch{return event.httpMethod==='GET'?h.json(200,{items:[],rows:[],admin:false,ready:false}):h.json(503,{error:'프리셋 저장소 설정을 확인해 주세요. 동일한 기존 프리셋을 중복 등록할 수 없습니다.'});}
};
