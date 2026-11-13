const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs'),f=require('../netlify/lib/content-studio-files.cjs');
function database(tables){return{from(table){const rows=tables[table]||=[];let filters=[],one=false,patch,insert;const q={select(){return q;},order(){return q;},limit(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(x){insert=x;return q;},update(x){patch=x;return q;},then(resolve){if(insert)rows.push({...insert,created_at:new Date().toISOString()});const found=insert?[rows.at(-1)]:rows.filter(r=>filters.every(fn=>fn(r)));if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:one?found[0]||null:found,error:null});}};return q;}};}
test('public preset schema excludes private prompts and storage paths',()=>{
 const p=require('../netlify/lib/content-studio-presets.cjs').publicPreset({id:'id',name:'카페 소개',description:'샘플',format:'short',private_prompt:'PRIVATE',video_path:'secret/path'},'https://example.com/video','https://example.com/image');
 assert.equal(p.id,'studio_id');assert.equal(p.group,'original');assert.equal(p.private_prompt,undefined);assert.equal(p.video_path,undefined);assert.equal(JSON.stringify(p).includes('PRIVATE'),false);
});
test('projects preserve request grouping and reject another member project',async()=>{
 const old={db:h.db,admin:h.admin,originAllowed:h.originAllowed},member=m.member,flag=process.env.CONTENT_PIXELING_REQUESTS_ENABLED;
 const projectId='11111111-1111-4111-8111-111111111111',tables={content_studio_projects:[{id:projectId,owner_id:'other'}]};let owner='me';
 try{h.db=()=>database(tables);h.admin=async()=>false;h.originAllowed=()=>true;m.member=async()=>owner;process.env.CONTENT_PIXELING_REQUESTS_ENABLED='true';
  const {handler}=require('../netlify/functions/content-pixeling.js');const input={action:'request',id:'22222222-2222-4222-8222-222222222222',projectId,presetId:require('../netlify/data/content-pixeling-catalog.json').items[0].id,text:'첫 번째 대화',confirmed:true};const send=d=>handler({httpMethod:'POST',body:JSON.stringify(d)});
  assert.equal((await send(input)).statusCode,403);assert.equal(tables.content_pixeling_requests.length,0);
  input.projectId='33333333-3333-4333-8333-333333333333';const result=await send(input);assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).request.projectId,input.projectId);assert.equal(tables.content_studio_projects.at(-1).owner_id,'me');
  assert.equal((await send({...input,projectId})).statusCode,409);
 }finally{Object.assign(h,old);m.member=member;if(flag===undefined)delete process.env.CONTENT_PIXELING_REQUESTS_ENABLED;else process.env.CONTENT_PIXELING_REQUESTS_ENABLED=flag;}
});
test('preset publication requires admin and verified uploaded media',async()=>{
 const old={db:h.db,admin:h.admin,originAllowed:h.originAllowed},verify=f.verify;let admin=false,valid=false;
 const id='44444444-4444-4444-8444-444444444444',tables={content_studio_presets:[{id,name:'새 프리셋',private_prompt:'secret',published:false,video_path:'v',video_size:10,thumbnail_path:'t',thumbnail_size:10}]};
 try{h.db=()=>database(tables);h.admin=async()=>admin;h.originAllowed=()=>true;f.verify=async()=>valid;const {handler}=require('../netlify/functions/content-studio-presets.js');const send=action=>handler({httpMethod:'POST',body:JSON.stringify({action,id})});
  assert.equal((await send('publish')).statusCode,403);assert.equal((await send('prompt')).statusCode,403);
  admin=true;assert.equal((await send('publish')).statusCode,400);assert.equal(tables.content_studio_presets[0].published,false);
  valid=true;assert.equal((await send('publish')).statusCode,200);assert.equal(tables.content_studio_presets[0].published,true);
  assert.equal((await send('hide')).statusCode,200);assert.equal(tables.content_studio_presets[0].published,false);
 }finally{Object.assign(h,old);f.verify=verify;}
});
test('project and preset migrations keep prompts and upload bucket private',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path');const db=new PGlite();
 try{await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 for(const name of ['20261113_content_pixeling.sql','20261113_content_studio_attachments.sql','20261113_content_studio_projects_presets.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'));
 for(const table of ['content_studio_projects','content_studio_presets'])assert.equal((await db.query(`select has_table_privilege('authenticated','${table}','SELECT') as allowed`)).rows[0].allowed,false);
 assert.equal((await db.query("select public from storage.buckets where id='content-studio-presets'")).rows[0].public,false);
 }finally{await db.close();}
});
