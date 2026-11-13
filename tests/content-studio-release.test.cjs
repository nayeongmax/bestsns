const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../netlify/lib/content-ai.cjs'),m=require('../netlify/lib/content-members.cjs'),release=require('../netlify/lib/content-studio-release.cjs');
test('test deployment denies guests and members even with public environment flags',async()=>{
 const old={db:h.db,admin:h.admin,member:m.member,origin:h.originAllowed},flag=process.env.CONTENT_PIXELING_REQUESTS_ENABLED;
 try{
  assert.deepEqual(release,{adminOnly:true,productionEnabled:false});process.env.CONTENT_PIXELING_REQUESTS_ENABLED='true';
  h.db=()=>({});h.admin=async()=>false;h.originAllowed=()=>true;
  for(const owner of [null,'member']){m.member=async()=>owner;
   for(const file of ['content-pixeling','content-studio-library','content-studio-presets']){
    const {handler}=require('../netlify/functions/'+file+'.js');
    for(const method of ['GET','POST'])assert.equal((await handler({httpMethod:method,headers:{},body:JSON.stringify({action:'request',role:'admin'})})).statusCode,403,file+' '+method);
   }
  }
  h.admin=async()=>true;m.member=async()=>null;
  const result=await require('../netlify/functions/content-pixeling.js').handler({httpMethod:'GET',headers:{}});
  assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).admin,true);assert.equal(JSON.parse(result.body).accepting,false);
  m.member=async()=>'admin';const blocked=await require('../netlify/functions/content-pixeling.js').handler({httpMethod:'POST',headers:{},body:'{"action":"request"}'});assert.equal(blocked.statusCode,503);
 }finally{h.db=old.db;h.admin=old.admin;h.originAllowed=old.origin;m.member=old.member;if(flag===undefined)delete process.env.CONTENT_PIXELING_REQUESTS_ENABLED;else process.env.CONTENT_PIXELING_REQUESTS_ENABLED=flag;}
});
