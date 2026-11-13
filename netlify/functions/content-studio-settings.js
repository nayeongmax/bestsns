const h=require('../lib/content-ai.cjs'),s=require('../lib/content-studio-settings.cjs');
exports.handler=async event=>{
 if(!h.originAllowed(event))return h.json(403,{error:'허용되지 않은 요청입니다.'});
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'지원하지 않는 요청입니다.'});
 try{const db=h.db();if(!await h.admin(event,db))return h.json(403,{error:'운영자만 설정을 관리할 수 있습니다.'});
  if(event.httpMethod==='GET'){const row=h.checked(await db.from('content_ai_settings').select('settings').eq('owner_id','__content_studio_display__').maybeSingle());return h.json(200,{settings:s.valid(row?.settings)?s.clean(row.settings):s.defaults,testMode:true,billingEnabled:false});}
  const d=JSON.parse(event.body||'{}');if(!s.valid(d.settings))return h.json(400,{error:'문구·금액·요금제 설정을 확인하세요. 스타터는 자동 업로드를 사용할 수 없습니다.'});
  const settings=s.clean(d.settings);h.checked(await db.from('content_ai_settings').upsert({owner_id:'__content_studio_display__',settings}));return h.json(200,{saved:true,settings,testMode:true,billingEnabled:false});
 }catch{return h.json(503,{error:'콘텐츠 설정 저장소를 확인하세요. 저장되지 않았습니다.'});}
};
