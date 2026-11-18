const {test}=require('node:test'),assert=require('node:assert/strict');
const execution=require('../netlify/lib/content-operator-execution.cjs');
test('operator queue excludes old and deleted projects and resumes one assigned job',async()=>{
 const old={...execution.config},worker={id:'test-worker'};
 const tables={content_studio_projects:[{id:'deleted',deleted_at:'2026-11-18'}],content_pixeling_requests:[
  {id:'old',state:'submitted',desktop_worker_id:null,created_at:'2026-11-17T00:00:00Z'},
  {id:'removed',project_id:'deleted',state:'submitted',desktop_worker_id:null,created_at:'2026-11-18T06:00:00Z'},
  {id:'new',state:'submitted',desktop_worker_id:null,created_at:'2026-11-18T06:00:00Z'}]};
 const db={from(table){let filters=[],patch,one=false;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){return q.eq(k,v)},gte(k,v){filters.push(r=>r[k]>=v);return q},order(){return q},limit(){return q},maybeSingle(){one=true;return q},update(v){patch=v;return q},then(resolve){const rows=tables[table].filter(r=>filters.every(f=>f(r)));if(patch)rows.forEach(r=>Object.assign(r,patch));resolve({data:one?rows[0]||null:rows});}};return q;}};
 try{
  assert.equal(execution.enabled(worker),false);
  Object.assign(execution.config,{workerId:worker.id,notBefore:'2026-11-18T05:00:00Z',expiresAt:new Date(Date.now()+60000).toISOString()});
  assert.equal(execution.enabled({id:'other'}),false);
  assert.equal((await execution.claim(db,worker,r=>r.data)).id,'new');
  assert.equal((await execution.claim(db,worker,r=>r.data)).id,'new');
  assert.equal(tables.content_pixeling_requests[0].state,'submitted');
  assert.equal(tables.content_pixeling_requests[1].state,'submitted');
  execution.config.expiresAt='2026-11-18T05:00:00Z';
  assert.equal(execution.enabled(worker),false);
  assert.equal(await execution.claim(db,worker,r=>r.data),null);
 }finally{Object.assign(execution.config,old);}
});
