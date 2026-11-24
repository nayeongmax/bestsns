const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const settings=require('../netlify/lib/content-studio-settings.cjs');
test('admin concurrency defaults, edits and legacy migration remain bounded',()=>{
 const legacy=structuredClone(settings.defaults);delete legacy.workerConcurrency;
 legacy.plans.forEach(p=>delete p.maxConcurrentJobs);
 assert.equal(settings.valid(legacy),true);
 assert.deepEqual(settings.clean(legacy).plans.map(p=>p.maxConcurrentJobs),[1,2,3]);
 for(const invalid of [0,4,1.5,null,'3']){
  assert.equal(settings.valid({...legacy,workerConcurrency:invalid}),false);
  const changed=structuredClone(legacy);changed.plans[1].maxConcurrentJobs=invalid;
  assert.equal(settings.valid(changed),false);
 }
 const changed=settings.clean(legacy);changed.workerConcurrency=2;changed.plans[2].maxConcurrentJobs=1;
 assert.equal(settings.clean(changed).plans[2].maxConcurrentJobs,1);
});
test('slots enforce 1/2/3 across workers, queue excess, resume and honor admin reductions',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table content_ai_settings(owner_id text primary key,settings jsonb);create table content_subscriptions(owner_id text primary key,plan text,valid_until timestamptz);");
  for(const file of ['20261113_content_pixeling.sql','20261113_content_studio_attachments.sql','20261113_content_studio_projects_presets.sql','20261113_content_studio_library.sql','20261113_content_desktop_worker.sql','20261124_content_desktop_concurrency.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
  const workers=[randomUUID(),randomUUID()];
  for(const id of workers)await db.query("insert into content_desktop_workers(id,name,token_hash) values ($1,'PC','hash')",[id]);
  const claim=async(w,slot,after=null)=>(await db.query('select content_desktop_claim_slot($1,$2,$3) as job',[w,slot,after])).rows[0].job;
  for(const [plan,limit] of [['starter',1],['pro',2],['business',3]]){
   await db.exec('delete from content_pixeling_requests;delete from content_subscriptions;');
   await db.query("insert into content_subscriptions values ('member',$1,now()+interval '1 day')",[plan]);
   for(let n=0;n<4;n++)await db.query("insert into content_pixeling_requests(id,owner_id,preset_id,preset_name,preset_version,text) values ($1,'member','preset','name',1,'request')",[randomUUID()]);
   const first=await claim(workers[0],1);assert.equal((await claim(workers[0],1)).id,first.id);
   for(let slot=2;slot<=3;slot++)assert.equal(!!await claim(workers[0],slot),slot<=limit);
   assert.equal(await claim(workers[1],1),null);
   assert.equal((await db.query("select count(*)::int as n from content_pixeling_requests where state='submitted'")).rows[0].n,4-limit);
  }
  const custom=structuredClone(settings.defaults);custom.workerConcurrency=1;custom.plans[2].maxConcurrentJobs=1;
  await db.query("insert into content_ai_settings values ('__content_studio_display__',$1)",[JSON.stringify(custom)]);
  assert.ok(await claim(workers[0],3)); // Lowering limits preserves in-flight work.
  await db.exec("update content_pixeling_requests set state='completed' where state='working';");
  assert.equal(await claim(workers[0],2),null);
  assert.ok(await claim(workers[0],1));
  assert.equal(await claim(workers[1],1),null);
  await db.exec("update content_pixeling_requests set state='completed';delete from content_subscriptions;");
  const pending=randomUUID();await db.query("insert into content_pixeling_requests(id,owner_id,preset_id,preset_name,preset_version,text) values ($1,'operator','preset','name',1,'test')",[pending]);
  assert.equal(await claim(workers[0],1),null); // No active subscription.
  assert.equal(await claim(workers[0],1,'2099-01-01'),null); // Test window excludes old orders.
  assert.equal((await claim(workers[0],1,'2020-01-01')).id,pending);
  await assert.rejects(()=>claim(workers[0],4),/INVALID_SLOT/);
  await db.query('update content_desktop_workers set revoked=true where id=$1',[workers[0]]);
  await assert.rejects(()=>claim(workers[0],1),/WORKER_UNAVAILABLE/);
  assert.equal((await db.query("select has_function_privilege('authenticated','content_desktop_claim_slot(uuid,integer,timestamptz)','EXECUTE') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
