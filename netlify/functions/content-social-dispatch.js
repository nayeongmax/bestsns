const h=require('../lib/content-ai.cjs'),y=require('../lib/content-youtube.cjs'),s=require('../lib/content-short-social.cjs');
exports.handler=async()=>{
 if(!y.config().enabled&&!s.config('instagram').enabled&&!s.config('tiktok').enabled)return h.json(200,{disabled:true});const db=h.db();
 const stale=new Date(Date.now()-20*60000).toISOString();
 h.checked(await db.from('content_social_posts').update({status:'needs_review',message:'업로드 상태 확인이 필요합니다. 유튜브 게시 내역을 확인해 주세요.'}).eq('status','running').lt('updated_at',stale));
 const rows=h.checked(await db.from('content_social_posts').select('id,provider').eq('status','queued').limit(20));
 for(const row of rows)await (row.provider==='youtube'?y.dispatch(row.id):s.dispatch(row.id)).catch(()=>{});
 return h.json(200,{queued:rows.length});
};
