const h=require('../lib/content-ai.cjs');
exports.handler=async()=>{
 const db=h.db();const cutoff=new Date(Date.now()-20*60000).toISOString();
 const rows=h.checked(await db.from('content_ai_jobs').select('id').eq('billing_state','charged').in('status',['queued','running','failed']).lt('updated_at',cutoff).limit(100));
 for(const row of rows)h.checked(await db.rpc('fail_paid_content_job',{p_job:row.id}));
 return h.json(200,{checked:rows.length});
};

