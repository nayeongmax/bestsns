const h=require('./content-ai.cjs'),m=require('./content-members.cjs'),release=require('./content-studio-release.cjs');

async function result(db,post){
 if(post.request_id){
  const row=h.checked(await db.from('content_pixeling_requests').select('id,result_path,result_size,result_deleted_at').eq('id',post.request_id).eq('owner_id',post.owner_id).eq('state','completed').maybeSingle());
  if(!row||row.result_deleted_at||!row.result_path||row.result_path!==post.result_path)return null;
  return {path:row.result_path,size:row.result_size,type:'video/mp4'};
 }
 const chat=h.checked(await db.from('content_ai_chats').select('results').eq('id',post.chat_id).eq('owner_id',post.owner_id).eq('member',true).single());
 return chat?.results?.find(r=>r.path===post.result_path&&r.type==='video/mp4')||null;
}
async function canPublish(db,post){
 if(post.request_id&&post.metadata?._operatorTest===true&&release.adminOnly)return true;
 return m.enabled()&&(await m.subscription(db,post.owner_id)).canPublish;
}
function oauthContext(value){try{const parsed=JSON.parse(value);if(parsed?.context==='studio')return parsed;}catch{}return {verifier:value};}
async function canConnect(db,row,context){return context.context==='studio'&&context.operator===true&&release.adminOnly||(await m.subscription(db,row.owner_id)).canPublish;}
function readiness(){
 const fields={youtube:['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET'],instagram:['INSTAGRAM_CLIENT_ID','INSTAGRAM_CLIENT_SECRET','INSTAGRAM_GRAPH_VERSION'],tiktok:['TIKTOK_CLIENT_ID','TIKTOK_CLIENT_SECRET']};
 return Object.fromEntries(Object.entries(fields).map(([provider,keys])=>[provider,{missing:keys.filter(k=>!process.env[k]),enabled:process.env['CONTENT_'+provider.toUpperCase()+'_ENABLED']==='true',callback:(process.env.URL||'https://bestsns.com')+'/.netlify/functions/content-'+(provider==='youtube'?'youtube':'social')+'-callback'}]));
}
module.exports={result,canPublish,oauthContext,canConnect,readiness};
