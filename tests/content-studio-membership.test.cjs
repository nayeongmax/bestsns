const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs'),release=require('../netlify/lib/content-studio-release.cjs');
test('active starter grants creation entitlement but never social publishing',async()=>{
 let row;const db={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:row,error:null})})};
 for(const plan of ['starter','pro','business']){row={plan,valid_until:new Date(Date.now()+60000).toISOString(),auto_upload_opt_in:true};const s=await m.subscription(db,'member');assert.equal(s.active,true);assert.equal(s.canPublish,plan!=='starter');}
 for(const value of [null,{plan:'pro',valid_until:'invalid'},{plan:'pro',valid_until:'2020-01-01'},{plan:'unknown',valid_until:'2099-01-01'}]){row=value;assert.equal((await m.subscription(db,'member')).active,false);}
});
test('entry status uses authenticated member, preserves private launch gate and fails closed',async()=>{
 const old={db:h.db,admin:h.admin,member:m.member,subscription:m.subscription,origin:h.originAllowed,adminOnly:release.adminOnly};let admin=false,owner='member-a';
 try{
 h.originAllowed=()=>true;h.admin=async()=>admin;m.member=async()=>owner;
 h.db=()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})})});
 m.subscription=async(db,id)=>{assert.equal(id,'member-a');return{active:true,plan:'starter',validUntil:'2099-01-01'};};
 const {handler}=require('../netlify/functions/content-studio-membership.js');const get=()=>handler({httpMethod:'GET',headers:{}});
 release.adminOnly=true;assert.equal((await get()).statusCode,403);
 release.adminOnly=false;const result=JSON.parse((await get()).body);assert.equal(result.active,true);assert.equal(result.operator,false);assert.equal(result.billingEnabled,false);
 owner=null;assert.equal((await get()).statusCode,401);admin=true;const op=JSON.parse((await get()).body);assert.equal(op.active,false);assert.equal(op.operator,true);
 h.db=()=>{throw Error('unavailable');};assert.equal((await get()).statusCode,503);
 }finally{h.db=old.db;h.admin=old.admin;m.member=old.member;m.subscription=old.subscription;h.originAllowed=old.origin;release.adminOnly=old.adminOnly;}
});
