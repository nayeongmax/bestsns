const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs');
const catalog=require('../netlify/data/content-pixeling-catalog.json');
function memory(rows){return{from(){let filters=[],inserted,patch;let one=false;const q={select(){return q;},order(){return q;},limit(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,vs){filters.push(r=>vs.includes(r[k]));return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(v){inserted={state:'submitted',created_at:new Date().toISOString(),...v};return q;},update(v){patch=v;return q;},then(resolve){if(inserted)rows.push(inserted);const found=inserted?[inserted]:rows.filter(r=>filters.every(f=>f(r)));if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:one?found[0]||null:found,error:null});}};return q;}};}
test('catalog contains real shared identities and no prompts, private presets or local paths',()=>{
 assert.equal(catalog.items.filter(p=>p.group==='community').length,103);assert.equal(catalog.items.filter(p=>p.group==='pixeling').length,40);
 assert.equal(new Set(catalog.items.map(p=>p.id)).size,143);
 for(const p of catalog.items){assert.match(p.id,/^cloud_[a-f0-9-]{36}_\d+$/);assert.deepEqual(Object.keys(p).sort(),['id','name','group','version','format','size','fps','thumbnail',...(p.previewUrl?['previewUrl']:[])].sort());if(p.thumbnail)assert.ok(p.thumbnail.startsWith('data:image/jpeg;base64,'));}
});
test('requests preserve exact text, isolate customers, reject wrong parents and do not call AI',async()=>{
 const old={db:h.db,admin:h.admin,originAllowed:h.originAllowed,apiJSON:h.apiJSON},member=m.member,flag=process.env.CONTENT_PIXELING_REQUESTS_ENABLED;const rows=[];let owner='customer-a',isAdmin=false;
 try{h.db=()=>memory(rows);h.admin=async()=>isAdmin;h.originAllowed=()=>true;h.apiJSON=()=>{throw Error('Must not run AI');};m.member=async()=>owner;const {handler}=require('../netlify/functions/content-pixeling.js');
 const send=d=>handler({httpMethod:'POST',body:JSON.stringify(d)});const data={action:'request',id:'11111111-1111-4111-8111-111111111111',presetId:catalog.items[0].id,text:'  고객 요청\n문구 그대로  ',confirmed:true};
 delete process.env.CONTENT_PIXELING_REQUESTS_ENABLED;assert.equal((await send(data)).statusCode,503);assert.equal(rows.length,0);
 process.env.CONTENT_PIXELING_REQUESTS_ENABLED='true';assert.equal((await send(data)).statusCode,200);assert.equal(rows[0].text,data.text);assert.equal((await send(data)).statusCode,200);assert.equal(rows.length,1);
 owner='customer-b';assert.equal((await send(data)).statusCode,409);const list=JSON.parse((await handler({httpMethod:'GET',queryStringParameters:{manage:'1'}})).body);assert.equal(list.requests.length,0);
 assert.equal((await send({...data,id:'22222222-2222-4222-8222-222222222222',parentId:data.id})).statusCode,400);
 assert.equal((await send({action:'working',id:data.id})).statusCode,403);
 isAdmin=true;assert.equal((await send({action:'working',id:data.id})).statusCode,200);assert.equal(rows[0].state,'working');assert.equal((await send({action:'working',id:data.id})).statusCode,409);
 }finally{Object.assign(h,old);m.member=member;if(flag===undefined)delete process.env.CONTENT_PIXELING_REQUESTS_ENABLED;else process.env.CONTENT_PIXELING_REQUESTS_ENABLED=flag;}
});
test('pixeling tables deny direct member reads and permit service role storage',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),path=require('node:path');const db=new PGlite();try{await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261113_content_pixeling.sql'),'utf8'));const result=await db.query("select has_table_privilege('authenticated','content_pixeling_requests','SELECT') as member,has_table_privilege('service_role','content_pixeling_requests','SELECT') as service");assert.equal(result.rows[0].member,false);assert.equal(result.rows[0].service,true);}finally{await db.close();}
});

test('attachments are bounded and checked by content signatures',()=>{
 const files=require('../netlify/lib/content-studio-files.cjs');
 assert.equal(files.valid([{name:'source.mp4',type:'video/mp4',size:500}]),true);
 assert.equal(files.valid([{name:'../secret.mp4',type:'video/mp4',size:500}]),false);
 assert.equal(files.valid(Array(9).fill({name:'image.png',type:'image/png',size:1})),false);
 assert.equal(files.valid([{name:'big.mp4',type:'video/mp4',size:101*1024*1024}]),false);
 assert.equal(files.valid([{name:'script.html',type:'text/html',size:10}]),false);
 assert.equal(files.signature(Buffer.from('%PDF-1.7'),'application/pdf'),true);
 assert.equal(files.signature(Buffer.from('<script>bad</script>'),'video/mp4'),false);
 assert.equal(files.signature(Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),true);
});

test('upload ownership, incomplete uploads, sealed attachments and operator progress',async()=>{
 const files=require('../netlify/lib/content-studio-files.cjs');
 const old={db:h.db,admin:h.admin,originAllowed:h.originAllowed},member=m.member,verify=files.verify,flag=process.env.CONTENT_PIXELING_REQUESTS_ENABLED;
 let owner='customer-a',isAdmin=false,verified=false,issued=0;const rows=[];
 try{
  h.db=()=>({...memory(rows),storage:{from(){return{createSignedUploadUrl:async()=>{issued++;return{data:{token:'test-token'},error:null};}};}}});
  h.admin=async()=>isAdmin;h.originAllowed=()=>true;m.member=async()=>owner;files.verify=async()=>verified;process.env.CONTENT_PIXELING_REQUESTS_ENABLED='true';
  const {handler}=require('../netlify/functions/content-pixeling.js');const send=d=>handler({httpMethod:'POST',body:JSON.stringify(d)});
  const id='33333333-3333-4333-8333-333333333333';
  const input={action:'request',id,presetId:catalog.items[0].id,text:'영상 만들어 주세요',confirmed:true,files:[{name:'source.mp4',type:'video/mp4',size:30}]};
  const response=await send(input);assert.equal(response.statusCode,200);assert.equal(rows[0].state,'uploading');
  const file=JSON.parse(response.body).request.attachments[0];assert.equal(file.path,undefined);
  owner='customer-b';assert.equal((await send({action:'attachment-upload',id,fileId:file.id})).statusCode,404);assert.equal(issued,0);
  owner='customer-a';assert.equal((await send({action:'attachment-upload',id,fileId:file.id})).statusCode,200);assert.equal(issued,1);
  assert.equal((await send({action:'attachments-ready',id})).statusCode,400);
  isAdmin=true;assert.equal((await send({action:'working',id})).statusCode,409);
  verified=true;assert.equal((await send({action:'attachments-ready',id})).statusCode,200);assert.equal(rows[0].state,'submitted');
  assert.equal((await send({action:'attachment-upload',id,fileId:file.id})).statusCode,409);
  assert.equal((await send({action:'working',id})).statusCode,200);
  isAdmin=false;assert.equal((await send({action:'progress',id,message:'자막을 확인하고 있습니다.'})).statusCode,403);
  isAdmin=true;assert.equal((await send({action:'progress',id,message:'자막을 확인하고 있습니다.'})).statusCode,200);
  assert.equal(rows[0].progress_events[0].text,'자막을 확인하고 있습니다.');
  assert.equal((await send({...input,files:[]})).statusCode,409);
 }finally{Object.assign(h,old);m.member=member;files.verify=verify;if(flag===undefined)delete process.env.CONTENT_PIXELING_REQUESTS_ENABLED;else process.env.CONTENT_PIXELING_REQUESTS_ENABLED=flag;}
});

test('attachments migration preserves private storage and request RLS',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),path=require('node:path');const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
  for(const f of ['20261113_content_pixeling.sql','20261113_content_studio_attachments.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',f),'utf8'));
  assert.equal((await db.query("select public from storage.buckets where id='content-studio-input'")).rows[0].public,false);
  assert.equal((await db.query("select has_table_privilege('authenticated','content_pixeling_requests','SELECT') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

