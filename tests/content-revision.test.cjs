const {test}=require('node:test');const assert=require('node:assert/strict');
const helper=require('../netlify/lib/content-test.cjs');
test('revisions reuse server-owned original files and require a completed order',async()=>{
 const oldDb=helper.db,oldAdmin=helper.admin,env={...process.env};
 try{
  process.env.CONTENT_TEST_ENABLED='true';process.env.CONTENT_PIXELING_BRIDGE_READY='true';
  const parent={id:'parent',kind:'video',status:'completed',settings:{request:'original',script:'provided'},assets:[{path:'parent/inputs/original'}]};let inserted;const filters=[];
  helper.admin=async()=>'verified-owner';
  helper.db=()=>({from:()=>({select(){return this;},eq(key,value){filters.push([key,value]);return this;},single:async()=>({data:parent,error:null}),insert:async row=>(inserted=row,{error:null})})});
  const file=require.resolve('../netlify/functions/content-test-orders.js');delete require.cache[file];const {handler}=require(file);
  const event=request=>({httpMethod:'POST',headers:{host:'site.example',origin:'https://site.example'},body:JSON.stringify(request)});
  assert.equal((await handler(event({action:'revise',id:'parent',request:''}))).statusCode,400);
  assert.equal((await handler(event({action:'revise',id:'parent',request:'make subtitles larger',owner_id:'attacker',assets:[]}))).statusCode,200);
  assert.equal(inserted.owner_id,'verified-owner');assert.deepEqual(inserted.assets,parent.assets);assert.equal(inserted.settings.parentOrderId,parent.id);assert.equal(inserted.settings.script,'provided');assert.equal(inserted.settings.revision,'make subtitles larger');assert.equal(inserted.status,'queued');assert.ok(filters.some(([k,v])=>k==='owner_id'&&v==='verified-owner'));
  parent.status='running';assert.equal((await handler(event({action:'revise',id:'parent',request:'another revision'}))).statusCode,409);
 }finally{helper.db=oldDb;helper.admin=oldAdmin;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
