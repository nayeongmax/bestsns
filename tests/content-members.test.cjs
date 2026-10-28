const {test}=require('node:test');const assert=require('node:assert/strict');const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs');
test('paid generation transactions enforce prices, parent ownership, idempotent debits and refunds',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role;');
 for(const name of ['20261006_content_ai.sql','20261028_content_members.sql','20261028_content_social.sql','20261028_content_subscriptions.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'));
 const preset=randomUUID(),project=randomUUID(),chat=randomUUID(),otherChat=randomUUID(),parent=randomUUID(),version='2026-10-28T00:00:00.000Z';
 await db.query("insert into content_video_presets(id,name,prompt,sample,price,revision_price,published,updated_at) values($1,'style','SECRET_OPERATOR_PROMPT','{}',100,30,true,$2)",[preset,version]);
 await db.query("insert into content_ai_projects(id,owner_id,name) values($1,'owner','test')",[project]);
 await db.query("insert into content_ai_chats(id,owner_id,project_id,title,member,preset_id,assets) values($1,'owner',$2,'새 제작 대화',true,$3,'[{\"role\":\"source\"}]'),($4,'owner',$2,'other',true,$3,'[{\"role\":\"source\"}]')",[chat,project,preset,otherChat]);
 const grant=()=>db.query("select grant_content_credits('owner',200,'verified-payment-1')");await grant();await grant();
 const balance=async()=>Number((await db.query("select balance from content_wallets where owner_id='owner'")).rows[0].balance);
 assert.equal(await balance(),200);
 await assert.rejects(()=>db.query("select grant_content_credits('another',200,'verified-payment-1')"),/REFERENCE_CONFLICT/);
 const enqueue=(id,expected=100,base=null,selectedChat=chat,v=version,owner='owner')=>db.query('select enqueue_paid_content_job($1,$2,$3,$4,$5,$6,$7,$8) as result',[id,owner,selectedChat,preset,v,expected,base,JSON.stringify({text:'user request',assets:[],messages:[],previousResults:[]})]);
 await assert.rejects(()=>enqueue(randomUUID(),1),/PRICE_CHANGED/);assert.equal(await balance(),200);
 await assert.rejects(()=>enqueue(randomUUID(),100,null,chat,'2026-10-27T00:00:00Z'),/PRICE_CHANGED/);
 await assert.rejects(()=>enqueue(randomUUID(),100,null,chat,version,'intruder'),/NOT_FOUND/);
 let response=await enqueue(parent);assert.equal(response.rows[0].result.created,true);assert.equal(await balance(),100);
 response=await enqueue(parent);assert.equal(response.rows[0].result.created,false);assert.equal(await balance(),100);
 await assert.rejects(()=>enqueue(randomUUID()),/JOB_ACTIVE/);assert.equal(await balance(),100);
 await db.query("update content_ai_jobs set status='running' where id=$1",[parent]);
 const snapshot=(await db.query('select snapshot from content_ai_jobs where id=$1',[parent])).rows[0].snapshot;assert.equal(snapshot.policy.instructions,'SECRET_OPERATOR_PROMPT');
 await db.query('select finish_content_ai_job($1,$2,$3,$4)',[parent,'owner',JSON.stringify([{jobId:parent,path:'result.mp4'}]),JSON.stringify({role:'assistant',text:'done'})]);
 assert.equal((await db.query('select fail_paid_content_job($1) as refunded',[parent])).rows[0].refunded,false);assert.equal(await balance(),100);
 await assert.rejects(()=>enqueue(randomUUID()),/PARENT_REQUIRED/);
 await assert.rejects(()=>enqueue(randomUUID(),30,parent,otherChat),/INVALID_PARENT/);
 const revision=randomUUID();await enqueue(revision,30,parent);assert.equal(await balance(),70);
 await db.query('select fail_paid_content_job($1)',[revision]);await db.query('select fail_paid_content_job($1)',[revision]);assert.equal(await balance(),100);
 await db.query("update content_wallets set balance=0 where owner_id='owner'");
 const noFunds=randomUUID();await assert.rejects(()=>enqueue(noFunds,30,parent),/INSUFFICIENT_CREDITS/);
 assert.equal((await db.query('select count(*)::int as count from content_ai_jobs where id=$1',[noFunds])).rows[0].count,0);
 assert.equal((await db.query("select count(*)::int as count from content_credit_ledger where reference like 'refund:%'")).rows[0].count,1);
 await db.query('update content_video_presets set price=null,revision_price=null where id=$1',[preset]);
 await assert.rejects(()=>enqueue(randomUUID(),100,null,otherChat),/PRICE_CHANGED/);
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select prompt from content_video_presets'),/permission denied/);
 await assert.rejects(()=>db.query('select snapshot from content_ai_jobs'),/permission denied/);
 await assert.rejects(()=>db.query("select grant_content_credits('owner',100,'untrusted-reference')"),/permission denied/);
 }finally{await db.close();}
});

test('member responses whitelist metadata and never return prompts, raw AI prose or snapshots',async()=>{
 const original={db:h.db,member:m.member};const flag=process.env.CONTENT_MEMBERS_ENABLED;const id=randomUUID(),preset=randomUUID();
 try{process.env.CONTENT_MEMBERS_ENABLED='true';m.member=async()=>'owner';
 const tables={content_video_presets:[{id:preset,name:'Style',description:'Public description',price:100,revision_price:30,published:true,updated_at:'version',prompt:'SECRET_OPERATOR_PROMPT',sample:{path:'presets/sample.mp4'}}],content_wallets:[{owner_id:'owner',balance:200}],content_ai_chats:[{id,owner_id:'owner',member:true,preset_id:preset,title:'Style',status:'idle',assets:[],results:[],messages:[{id:'u',role:'user',text:'my request'},{id:'a',role:'assistant',text:'SECRET_MODEL_PROSE'}]}],content_ai_jobs:[{id:'j',chat_id:id,owner_id:'owner',charge:100,status:'completed',snapshot:{prompt:'SECRET_JOB_SNAPSHOT'}}]};
 h.db=()=>({from(name){let cols='*';const filters=[];let single=false;const q={select(c){cols=c;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},then(resolve){const rows=tables[name].filter(r=>filters.every(f=>f(r))).map(r=>cols==='*'?{...r}:Object.fromEntries(cols.split(',').map(k=>[k,r[k]])));resolve({data:single?rows[0]||null:rows});}};return q;},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://storage.example/sample'}})})}});
 const {handler}=require('../netlify/functions/content-member.js');const response=await handler({httpMethod:'GET',headers:{},queryStringParameters:{chat:id}});assert.equal(response.statusCode,200);
 for(const marker of ['SECRET_OPERATOR_PROMPT','SECRET_MODEL_PROSE','SECRET_JOB_SNAPSHOT','snapshot','instructions'])assert.ok(!response.body.includes(marker),marker);
 assert.equal(JSON.parse(response.body).chat.requests[0].text,'my request');
 m.member=async()=>'intruder';const denied=await handler({httpMethod:'GET',headers:{},queryStringParameters:{chat:id}});assert.notEqual(denied.statusCode,200);assert.ok(!denied.body.includes('my request'));
 m.member=async()=>null;assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,401);
 }finally{Object.assign(h,{db:original.db});m.member=original.member;flag===undefined?delete process.env.CONTENT_MEMBERS_ENABLED:process.env.CONTENT_MEMBERS_ENABLED=flag;}
});
