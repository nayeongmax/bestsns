// Operator-only validation window; billing and member production stay disabled.
// The identifier is public metadata, never a worker credential.
const config={workerId:'a4218222-7fb4-460e-afc4-d55f19bd4ea9',notBefore:'2026-11-24T02:00:00Z',expiresAt:'2026-11-24T08:00:00Z'};
function enabled(worker){return !!config.workerId&&worker.id===config.workerId&&Number.isFinite(Date.parse(config.notBefore))&&Date.now()>=Date.parse(config.notBefore)&&Date.now()<Date.parse(config.expiresAt);}
async function claim(db,worker,checked){
 if(!enabled(worker))return null;
 const active=checked(await db.from('content_pixeling_requests').select('*').eq('desktop_worker_id',worker.id).eq('state','working').maybeSingle());
 if(active)return active; // The bridge resumes its durable record; never sends twice.
 const candidates=checked(await db.from('content_pixeling_requests').select('*').eq('state','submitted').is('desktop_worker_id',null).gte('created_at',config.notBefore).order('created_at',{ascending:true}).limit(50));
 for(const candidate of candidates){
  if(candidate.project_id){
   const project=checked(await db.from('content_studio_projects').select('deleted_at').eq('id',candidate.project_id).maybeSingle());
   if(!project||project.deleted_at)continue;
  }
  const claimed=checked(await db.from('content_pixeling_requests').update({desktop_worker_id:worker.id,desktop_stage:'claimed',state:'working',updated_at:new Date().toISOString()}).eq('id',candidate.id).eq('state','submitted').is('desktop_worker_id',null).select('*').maybeSingle());
  if(claimed)return claimed;
 }
 return null;
}
module.exports={config,enabled,claim};
