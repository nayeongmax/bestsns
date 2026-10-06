const {test}=require('node:test');const assert=require('node:assert/strict');
const helper=require('../netlify/lib/content-test.cjs');let role='user',validJwt=false;
helper.db=()=>({auth:{getUser:async token=>({data:{user:validJwt&&token==='verified'?{id:'account'}:null},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role},error:null})})})})});
const auth=require('../netlify/lib/admin-auth.cjs');const session=require('../netlify/functions/admin-session.js');
const event=(method='GET',headers={},body={})=>({httpMethod:method,headers:{host:'site.example',origin:'https://site.example',...headers},body:JSON.stringify(body)});
test('server auth rejects exposed keys, forged JWTs, non-admins and foreign origins',async()=>{
 const env={...process.env};try{
  process.env.ADMIN_PASSWORD='new-server-password';process.env.VITE_ADMIN_PASSWORD='old-exposed-password';process.env.ADMIN_SESSION_SECRET='s'.repeat(40);
  assert.equal(await auth.authorized(event('GET',{'x-admin-key':'old-exposed-password'})),false);
  assert.equal(await auth.authorized(event('GET',{'x-admin-key':'new-server-password'})),false);
  validJwt=true;assert.equal(await auth.authorized(event('GET',{authorization:'Bearer verified'})),false);
  role='admin';assert.equal(await auth.authorized(event('GET',{authorization:'Bearer verified'})),true);
  assert.equal(await auth.authorized(event('GET',{authorization:'Bearer forged'})),false);
  const login=await session.handler(event('POST',{}, {id:'admin',password:'new-server-password'}));assert.equal(login.statusCode,200);
  const cookie=login.headers['Set-Cookie'];assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(await auth.authorized(event('POST',{cookie})),true);
  assert.equal(await auth.authorized(event('POST',{cookie,origin:'https://attacker.example'})),false);
  assert.equal((await session.handler(event('POST',{}, {id:'admin',password:'old-exposed-password'}))).statusCode,403);
  assert.match((await session.handler(event('DELETE',{cookie}))).headers['Set-Cookie'],/Max-Age=0/);
  process.env.ADMIN_PASSWORD='old-exposed-password';assert.equal((await session.handler(event('POST',{}, {id:'admin',password:'old-exposed-password'}))).statusCode,503);
  for(const name of ['smm-admin','store-admin','freelancer-admin'])assert.equal((await require('../netlify/functions/'+name+'.js').handler(event('POST',{'x-admin-key':'old-exposed-password'},{action:'pay'}))).statusCode,401,name);
  assert.equal(await auth.authorized(event('GET',{cookie:'content_admin=abc.'+'가'.repeat(43)})),false);
 }finally{for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);validJwt=false;role='user';}
});
test('seller cannot edit another product or approve its own',async()=>{
 const env={...process.env},oldFetch=global.fetch;try{
  process.env.SUPABASE_URL='https://db.example';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';validJwt=true;role='user';
  const seller=require('../netlify/functions/store-seller.js');let posted,existing=[{author_id:'other'}];
  global.fetch=async(url,options)=>url.includes('/auth/')?{ok:true,json:async()=>({id:'account'})}:options?.method==='POST'?(posted=JSON.parse(options.body),{ok:true}):{ok:true,json:async()=>existing};
  const request=event('POST',{authorization:'Bearer verified'},{action:'upsertProduct',product:{id:'p',author_id:'account',status:'approved'}});
  assert.equal((await seller.handler(request)).statusCode,403);
  existing=[];assert.equal((await seller.handler(request)).statusCode,200);assert.equal(posted.status,'pending');
 }finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);validJwt=false;}
});
