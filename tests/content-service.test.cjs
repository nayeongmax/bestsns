const {test}=require('node:test');const assert=require('node:assert/strict');
const helper=require('../netlify/lib/content-test.cjs');
test('custom requests validate files, gate operator actions and bind approval to an exact quote',async()=>{
 const previous={db:helper.db,admin:helper.admin};
 try{
  const row={id:'request',owner_id:'owner',status:'submitted',quote_version:0,quote_credits:null,assets:[],results:[]};let owner='owner';let patch;
  helper.admin=async()=>owner;
  helper.db=()=>({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{...row}}),update(p){patch=p;return this;},then(resolve){resolve({data:[{id:row.id}]});}})});
  delete require.cache[require.resolve('../netlify/functions/content-service-requests.js')];const f=require('../netlify/functions/content-service-requests.js');
  const request=data=>f.handler({httpMethod:'POST',headers:{host:'site.example',origin:'https://site.example'},body:JSON.stringify({id:row.id,...data})});
  assert.equal(f.validFiles([{name:'a.mp4',size:1,type:'video/mp4'}]),true);
  assert.equal(f.validFiles([{name:'a.html',size:1,type:'text/html'}]),false);
  assert.equal(f.validFiles(Array.from({length:51},()=>({name:'a',size:1,type:'video/mp4'}))),false);
  const details={name:'name',contact:'phone',industry:'cafe',business:'shop',kind:'video',request:'make it',references:['javascript:alert(1)']};assert.equal(f.validDetails(details),false);details.references=['https://example.com/video'];assert.equal(f.validDetails(details),true);
  assert.equal((await request({action:'start'})).statusCode,409);
  assert.equal((await request({action:'quote',credits:10,note:'scope'})).statusCode,200);assert.equal(patch.quote_version,1);
  row.status='quoted';row.quote_version=1;row.quote_credits=10;
  assert.equal((await request({action:'approve',version:0,credits:10})).statusCode,409);
  assert.equal((await request({action:'approve',version:1,credits:9})).statusCode,409);
  owner='other-admin';assert.equal((await request({action:'approve',version:1,credits:10})).statusCode,403);
  owner='owner';assert.equal((await request({action:'approve',version:1,credits:10})).statusCode,200);assert.equal(patch.status,'approved');assert.ok(patch.approved_at);
  row.status='approved';assert.equal((await request({action:'quote',credits:20,note:'changed'})).statusCode,409);
  row.status='completed';assert.equal((await request({action:'start'})).statusCode,409);
  helper.admin=async()=>null;assert.equal((await request({action:'quote',credits:10,note:'scope'})).statusCode,403);
 }finally{helper.db=previous.db;helper.admin=previous.admin;}
});
