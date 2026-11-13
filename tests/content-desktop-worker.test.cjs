const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs'),f=require('../netlify/lib/content-studio-files.cjs');
function database(tables){return{from(table){const rows=tables[table]||=[];let filters=[],one=false,patch,insert;const q={select(){return q;},order(){return q;},limit(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(x){insert=x;return q;},update(x){patch=x;return q;},then(resolve){if(insert)rows.push({...insert,created_at:new Date().toISOString()});const found=insert?[rows.at(-1)]:rows.filter(r=>filters.every(fn=>fn(r)));if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:one?found[0]||null:found,error:null});}};return q;}};}

test('desktop keys are scoped, revocable and never returned on heartbeat',async()=>{
 const crypto=require('node:crypto'),old={db:h.db,admin:h.admin,originAllowed:h.originAllowed};const id='11111111-1111-4111-8111-111111111111';const token='desktop_'+id+'.'+'a'.repeat(64);const rows=[{id,name:'PC',token_hash:crypto.createHash('sha256').update(token).digest('hex'),revoked:false,expires_at:'2099-01-01'}];const tables={content_desktop_workers:rows};
 try{h.db=()=>database(tables);h.admin=async()=>false;h.originAllowed=()=>true;const {handler}=require('../netlify/functions/content-desktop-worker.js');const get=key=>handler({httpMethod:'GET',headers:{authorization:'Bearer '+key}});
 assert.equal((await get('wrong')).statusCode,403);assert.equal((await get(token.slice(0,-1)+'b')).statusCode,401);
 const result=await get(token);assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).connected,true);assert.equal(result.body.includes(token),false);assert.equal(result.body.includes('token_hash'),false);
 const post=d=>handler({httpMethod:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(d)});
 assert.equal((await post({action:'complete',id:'22222222-2222-4222-8222-222222222222'})).statusCode,404);
 rows[0].revoked=true;assert.equal((await get(token)).statusCode,401);
 }finally{Object.assign(h,old);}
});
test('SQL claims one active job per worker and never reclaims an uncertain run',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path');const db=new PGlite();
 try{await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 for(const name of ['20261113_content_pixeling.sql','20261113_content_studio_attachments.sql','20261113_content_studio_projects_presets.sql','20261113_content_studio_library.sql','20261113_content_desktop_worker.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'));
 const w1='11111111-1111-4111-8111-111111111111',w2='22222222-2222-4222-8222-222222222222',j1='33333333-3333-4333-8333-333333333333',j2='44444444-4444-4444-8444-444444444444';
 for(const id of [w1,w2])await db.query("insert into content_desktop_workers(id,name,token_hash) values ($1,'PC','hash')",[id]);
 for(const id of [j1,j2])await db.query("insert into content_pixeling_requests(id,owner_id,preset_id,preset_name,preset_version,text) values ($1,'member','preset','name',1,'original')",[id]);
 const claim=async id=>(await db.query('select content_desktop_claim($1) as job',[id])).rows[0].job;
 const first=await claim(w1),again=await claim(w1),second=await claim(w2);assert.equal(first.id,again.id);assert.notEqual(first.id,second.id);assert.equal(first.state,'working');
 await db.query("update content_pixeling_requests set desktop_stage='attention' where id=$1",[first.id]);assert.equal((await claim(w1)).id,first.id);
 await db.query('update content_desktop_workers set revoked=true where id=$1',[w1]);await assert.rejects(()=>claim(w1),/WORKER_UNAVAILABLE/);
 assert.equal((await db.query("select has_table_privilege('authenticated','content_desktop_workers','SELECT') as allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','content_desktop_claim(uuid)','EXECUTE') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('completion verifies thread, exact bytes and idempotent delivery',async()=>{
 const crypto=require('node:crypto'),old={db:h.db};
 const worker='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',token='desktop_'+worker+'.'+'a'.repeat(64);
 const bytes=Buffer.from('0000ftypisom00000000'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const row={id,desktop_worker_id:worker,state:'working',desktop_thread_id:'native:thread',result_path:'desktop/output.mp4',result_size:bytes.length,result_sha256:sha};
 const tables={content_desktop_workers:[{id:worker,token_hash:crypto.createHash('sha256').update(token).digest('hex'),expires_at:'2099-01-01'}],content_pixeling_requests:[row]};
 let actual=bytes;
 try{h.db=()=>({...database(tables),storage:{from(){return{download:async()=>({data:new Blob([actual]),error:null})};}}});
 const {handler}=require('../netlify/functions/content-desktop-worker.js');
 const post=d=>handler({httpMethod:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({action:'complete',id,threadId:'native:thread',sha256:sha,...d})});
 assert.equal((await post({threadId:'other'})).statusCode,409);
 actual=Buffer.from('0000ftypisomBADBYTES');assert.equal((await post({})).statusCode,400);assert.equal(row.state,'working');
 actual=bytes;assert.equal((await post({})).statusCode,200);assert.equal(row.state,'completed');
 assert.equal((await post({})).statusCode,200);assert.equal((await post({sha256:'b'.repeat(64)})).statusCode,409);
 }finally{Object.assign(h,old);}
});
