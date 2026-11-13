const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),s=require('../netlify/lib/content-studio-settings.cjs');
test('display pricing is admin-only, persistent and cannot enable billing or starter uploads',async()=>{
 const old={db:h.db,admin:h.admin,origin:h.originAllowed};let allowed=false,saved=null;
 try{h.originAllowed=()=>true;h.admin=async()=>allowed;h.db=()=>({from(){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:saved?{settings:saved}:null,error:null}),upsert:async row=>{saved=row.settings;return{data:null,error:null};}};}});
 const {handler}=require('../netlify/functions/content-studio-settings.js');const req=body=>handler({httpMethod:body?'POST':'GET',headers:{},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await req()).statusCode,403);assert.equal((await req({settings:s.defaults})).statusCode,403);allowed=true;
 assert.deepEqual(JSON.parse((await req()).body).settings,s.defaults);
 const settings=structuredClone(s.defaults);settings.videoPrice=15000;settings.plans[1].monthlyPrice=59000;
 assert.equal((await req({settings:{...settings,billingEnabled:true,private_prompt:'secret'}})).statusCode,200);
 const result=JSON.parse((await req()).body);assert.equal(result.settings.videoPrice,15000);assert.equal(result.settings.plans[1].monthlyPrice,59000);assert.equal(result.billingEnabled,false);assert.equal('private_prompt' in result.settings,false);
 settings.plans[0].autoUpload=true;assert.equal((await req({settings})).statusCode,400);settings.plans[0].autoUpload=false;settings.videoPrice=-1;assert.equal((await req({settings})).statusCode,400);
 }finally{h.db=old.db;h.admin=old.admin;h.originAllowed=old.origin;}
});
