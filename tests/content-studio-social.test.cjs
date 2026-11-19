const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs');
const studio=require('../netlify/lib/content-social-studio.cjs'),release=require('../netlify/lib/content-studio-release.cjs');
function dbFor(rows){return {from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},maybeSingle:async()=>({data:rows.find(r=>filters.every(f=>f(r)))||null})};return q;}};}
test('studio publisher resolves only owned, completed, retained MP4 results',async()=>{
 const row={id:'job',owner_id:'owner',state:'completed',result_path:'desktop/job/output.mp4',result_size:123};
 const db=dbFor([row]),post={request_id:'job',owner_id:'owner',result_path:row.result_path};
 assert.equal((await studio.result(db,post)).size,123);
 assert.equal(await studio.result(db,{...post,owner_id:'other'}),null);
 assert.equal(await studio.result(db,{...post,result_path:'other.mp4'}),null);
 row.state='working';assert.equal(await studio.result(db,post),null);
 row.state='completed';row.result_deleted_at='2026-11-19';assert.equal(await studio.result(db,post),null);
});
test('operator exemption is restricted to studio jobs while member entitlement remains enforced',async()=>{
 const previous={subscription:m.subscription,enabled:m.enabled,adminOnly:release.adminOnly};
 try{
  m.subscription=async()=>({canPublish:false});m.enabled=()=>true;release.adminOnly=true;
  assert.equal(await studio.canPublish({}, {request_id:'job',metadata:{}}),false);
  assert.equal(await studio.canPublish({}, {chat_id:'chat',metadata:{_operatorTest:true}}),false);
  assert.equal(await studio.canPublish({}, {request_id:'job',metadata:{_operatorTest:true}}),true);
  release.adminOnly=false;
  assert.equal(await studio.canPublish({}, {request_id:'job',metadata:{_operatorTest:true}}),false);
  m.subscription=async()=>({canPublish:true});assert.equal(await studio.canPublish({}, {request_id:'job',metadata:{}}),true);
  m.enabled=()=>false;assert.equal(await studio.canPublish({}, {request_id:'job',metadata:{}}),false);
 }finally{m.subscription=previous.subscription;m.enabled=previous.enabled;release.adminOnly=previous.adminOnly;}
});
test('studio routes reject a member without operator authentication during private testing',async()=>{
 const old={db:h.db,admin:h.admin,origin:h.originAllowed,member:m.member};
 try{h.db=()=>({});h.admin=async()=>false;h.originAllowed=()=>true;m.member=async()=>'ordinary-member';
  const {handler}=require('../netlify/functions/content-social.js');
  for(const method of ['GET','POST'])assert.equal((await handler({httpMethod:method,queryStringParameters:{studio:'1'},headers:{},body:JSON.stringify({action:'connect',provider:'youtube'})})).statusCode,403);
 }finally{h.db=old.db;h.admin=old.admin;h.originAllowed=old.origin;m.member=old.member;}
});
test('SNS schema initializes without the obsolete chat service, restricts source and protects tokens',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs');const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create table content_pixeling_requests(id uuid primary key);');
  await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations/20261119_content_studio_social.sql'),'utf8'));
  const id='11111111-1111-4111-8111-111111111111';await db.query('insert into content_pixeling_requests values($1)',[id]);
  await db.query("insert into content_social_posts(id,owner_id,request_id,provider,channel_id,result_path,metadata) values($1,'owner',$1,'youtube','channel','file.mp4','{}')",[id]);
  await assert.rejects(()=>db.query('update content_social_posts set chat_id=$1 where id=$1',[id]),/content_social_result_source/);
  assert.equal((await db.query("select has_table_privilege('authenticated','content_social_connections','SELECT') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
