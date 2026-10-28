const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs');
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return h.json(405,{error:'Method not allowed'});
 try{if(!m.enabled())return h.json(200,{presets:[],chats:[],chat:null,balance:0});const db=h.db();
 const rows=h.checked(await db.from('content_video_presets').select('id,name,description,price,revision_price,updated_at,sample,video_format,production_settings').eq('published',true).order('updated_at',{ascending:false}));const presets=[];
 for(const p of rows){if(!p.sample)continue;presets.push({...m.publicPreset(p),sampleUrl:h.checked(await db.storage.from(h.bucket).createSignedUrl(p.sample.path,600)).signedUrl});}
 return h.json(200,{presets,chats:[],chat:null,balance:0});
 }catch{return h.json(503,{error:'샘플을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.'});}
};
