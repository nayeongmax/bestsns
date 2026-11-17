// Exercise future member workflows separately from the locked deployment gate.
Object.assign(require('../netlify/lib/content-studio-release.cjs'),{adminOnly:false,productionEnabled:true});
const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs'),f=require('../netlify/lib/content-studio-files.cjs');
function database(tables){return{from(table){const rows=tables[table]||=[];let filters=[],one=false,patch,insert;const q={select(){return q;},order(){return q;},limit(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(x){insert=x;return q;},update(x){patch=x;return q;},then(resolve){if(insert)rows.push({...insert,created_at:new Date().toISOString()});const found=insert?[rows.at(-1)]:rows.filter(r=>filters.every(fn=>fn(r)));if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:one?found[0]||null:found,error:null});}};return q;}};}

test('library mutations isolate owners and keep presets private after result deletion',async()=>{
 const old={db:h.db,originAllowed:h.originAllowed},member=m.member;
 const id='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222';
 const tables={content_pixeling_requests:[{id,owner_id:'me',state:'completed',result_path:'private/result.mp4',text:'exact text',preset_id:'source'}],content_studio_projects:[{id:pid,owner_id:'me',title:'old'}]};let owner='other';
 const db=database(tables);db.storage={from(){return{async createSignedUrl(){return{data:{signedUrl:'https://signed.example/video'}};}}}};
 try{h.db=()=>db;h.originAllowed=()=>true;m.member=async()=>owner;
 const {handler}=require('../netlify/functions/content-studio-library.js');const send=d=>handler({httpMethod:'POST',body:JSON.stringify(d)});
 for(const action of ['delete-result','personal-preset'])assert.equal((await send({action,id,name:'mine',format:'short'})).statusCode,404);
 assert.equal((await send({action:'rename-project',id:pid,name:'other'})).statusCode,404);
 owner='me';assert.equal((await send({action:'personal-preset',id,name:'mine',format:'short'})).statusCode,200);
 assert.equal((await send({action:'personal-preset',id,name:'mine',format:'short'})).statusCode,200);assert.equal(tables.content_studio_personal_presets.length,1);
 const personalId='personal_'+tables.content_studio_personal_presets[0].id;
 const presets=require('../netlify/lib/content-studio-presets.cjs');assert.equal(await presets.find(db,personalId,'other'),null);assert.equal((await presets.find(db,personalId,'me')).referenceId,id);
 assert.equal((await send({action:'rename-project',id,name:'기존 대화'})).statusCode,200);assert.equal(tables.content_studio_projects.find(p=>p.id===id).title,'기존 대화');
 assert.equal((await send({action:'rename-project',id:pid,name:'renamed'})).statusCode,200);assert.equal(tables.content_studio_projects[0].title,'renamed');
 assert.equal((await send({action:'delete-project',id:pid})).statusCode,200);assert.ok(tables.content_studio_projects[0].deleted_at);assert.equal(tables.content_pixeling_requests[0].state,'completed');
 assert.equal((await send({action:'delete-result',id})).statusCode,200);assert.ok(tables.content_pixeling_requests[0].result_deleted_at);
 assert.equal((await send({action:'personal-preset',id,name:'new',format:'short'})).statusCode,409);
 const data=JSON.parse((await handler({httpMethod:'GET'})).body);assert.equal(data.items.length,1);assert.equal(data.items[0].group,'personal');assert.equal(JSON.stringify(data).includes('private/result'),false);assert.equal(JSON.stringify(data).includes('exact text'),false);
 owner='other';const other=JSON.parse((await handler({httpMethod:'GET'})).body);assert.equal(other.items.length,0);assert.equal(other.projects.length,0);
 }finally{Object.assign(h,old);m.member=member;}
});
test('personal preset migration denies direct member reads',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path');const db=new PGlite();
 try{await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 for(const name of ['20261113_content_pixeling.sql','20261113_content_studio_attachments.sql','20261113_content_studio_projects_presets.sql','20261113_content_studio_library.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'));
 assert.equal((await db.query("select has_table_privilege('authenticated','content_studio_personal_presets','SELECT') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

test('cookie-only operator can rename and soft-delete their project',async()=>{
 const release=require('../netlify/lib/content-studio-release.cjs');const old={db:h.db,admin:h.admin,member:m.member,origin:h.originAllowed,locked:release.adminOnly};
 const id='33333333-3333-4333-8333-333333333333';const tables={content_studio_projects:[{id,owner_id:'__operator_smoke__',title:'새 영상'}]};
 try{release.adminOnly=true;h.db=()=>database(tables);h.admin=async()=>true;m.member=async()=>null;h.originAllowed=()=>true;
 const handler=require('../netlify/functions/content-studio-library.js').handler;
 for(const action of ['rename-project','delete-project'])assert.equal((await handler({httpMethod:'POST',body:JSON.stringify({action,id,name:'운영자 프로젝트'})})).statusCode,200);
 assert.equal(tables.content_studio_projects[0].title,'운영자 프로젝트');assert.ok(tables.content_studio_projects[0].deleted_at);
 }finally{release.adminOnly=old.locked;h.db=old.db;h.admin=old.admin;m.member=old.member;h.originAllowed=old.origin;}
});

test('operator test intake preserves text, generic title and request idempotency',async()=>{
 const release=require('../netlify/lib/content-studio-release.cjs');const old={db:h.db,admin:h.admin,member:m.member,origin:h.originAllowed,locked:release.adminOnly,production:release.productionEnabled};
 const id='44444444-4444-4444-8444-444444444444',projectId='55555555-5555-4555-8555-555555555555';const tables={};
 try{release.adminOnly=true;release.productionEnabled=false;h.db=()=>database(tables);h.admin=async()=>true;m.member=async()=>null;h.originAllowed=()=>true;
 const handler=require('../netlify/functions/content-pixeling.js').handler;
 const presetId=require('../netlify/data/content-pixeling-catalog.json').items[0].id;
 const body={action:'request',id,projectId,presetId,text:'이 문장은 제목에 노출하지 않습니다.',files:[],confirmed:true};
 for(let i=0;i<2;i++)assert.equal((await handler({httpMethod:'POST',body:JSON.stringify(body)})).statusCode,200);
 assert.equal(tables.content_pixeling_requests.length,1);assert.equal(tables.content_pixeling_requests[0].text,body.text);assert.equal(tables.content_pixeling_requests[0].state,'submitted');assert.equal(tables.content_studio_projects[0].title,'새 영상 555555');
 }finally{release.adminOnly=old.locked;release.productionEnabled=old.production;h.db=old.db;h.admin=old.admin;m.member=old.member;h.originAllowed=old.origin;}
});
