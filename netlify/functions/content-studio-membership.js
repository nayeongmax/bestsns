const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
const release=require('../lib/content-studio-release.cjs'),s=require('../lib/content-studio-settings.cjs');
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Forbidden'});
 try{
  const db=h.db(),admin=!!await h.admin(event,db),owner=await m.member(event,db);
  if(release.adminOnly&&!admin)return h.json(403,{error:'운영자 전용 테스트 페이지입니다.'});
  if(!owner&&!admin)return h.json(401,{error:'로그인 후 이용해 주세요.'});
  const subscription=owner?await m.subscription(db,owner):{active:false,plan:null,validUntil:null};
  const row=h.checked(await db.from('content_ai_settings').select('settings').eq('owner_id','__content_studio_display__').maybeSingle());
  return h.json(200,{active:subscription.active===true,plan:subscription.plan,validUntil:subscription.validUntil,operator:admin,settings:s.valid(row?.settings)?s.clean(row.settings):s.defaults,billingEnabled:false},{'Cache-Control':'no-store'});
 }catch{return h.json(503,{error:'구독 정보를 확인하지 못했습니다. 다시 시도해 주세요.'});}
};
