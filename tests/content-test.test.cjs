const { test } = require('node:test');
const assert = require('node:assert/strict');
const helper = require('../netlify/lib/content-test.cjs');
const session = require('../netlify/functions/content-admin-session.js');
const event = (body,headers={}) => ({httpMethod:'POST',headers:{host:'test.example',origin:'https://test.example',...headers},body:JSON.stringify(body)});
test('real content test authentication rejects forged users and credentials',async()=>{
  const original={...process.env};
  try{
    process.env.ADMIN_PASSWORD='test-password';process.env.CONTENT_ADMIN_SESSION_SECRET='s'.repeat(40);
    assert.equal((await session.handler(event({id:'admin',password:'wrong'}))).statusCode,403);
    assert.equal((await session.handler(event({id:'admin',password:'한글'.repeat(7)}))).statusCode,403);
    assert.equal((await session.handler(event({id:'admin',password:'test-password'},{origin:'https://attacker.example'}))).statusCode,403);
    const result=await session.handler(event({id:'admin',password:'test-password'}));
    assert.equal(result.statusCode,200);assert.match(result.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
    assert.equal(await helper.admin({headers:{cookie:result.headers['Set-Cookie']}},{}),'admin');
    assert.equal(await helper.admin({headers:{cookie:'content_admin=forged.fake'}},{}),null);
    assert.equal(await helper.admin({headers:{}},{}),null);
  }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});
test('orders cannot run without verified admin and explicit bridge readiness',async()=>{
  const oldDb=helper.db,oldAdmin=helper.admin;const env={...process.env};
  try{
    helper.db=()=>({});helper.admin=async()=>null;
    const modulePath=require.resolve('../netlify/functions/content-test-orders.js');delete require.cache[modulePath];
    let orders=require(modulePath);
    assert.equal((await orders.handler(event({action:'prepare',owner_id:'admin'}))).statusCode,403);
    helper.admin=async()=>'admin';delete require.cache[modulePath];orders=require(modulePath);
    delete process.env.CONTENT_TEST_ENABLED;delete process.env.CONTENT_PIXELING_BRIDGE_READY;
    assert.equal((await orders.handler(event({action:'prepare'}))).statusCode,503);
    process.env.CONTENT_TEST_ENABLED='true';process.env.CONTENT_PIXELING_BRIDGE_READY='true';
    assert.equal((await orders.handler(event({action:'prepare',kind:'video',files:[]}))).statusCode,400);
    assert.equal((await orders.handler(event({action:'prepare',kind:'video',files:Array(11).fill({})}))).statusCode,400);
    const settings={length:'30초',cardCount:'5장',industry:'맛집',style:'매장 소개',request:'',script:''};
    assert.equal((await orders.handler(event({action:'prepare',kind:'video',settings,files:[{name:'x.exe',type:'application/octet-stream',size:10}]}))).statusCode,400);
    assert.equal((await orders.handler(event({action:'prepare',kind:'cards',settings,files:[{name:'x.mp4',type:'video/mp4',size:10}]}))).statusCode,400);
    assert.equal((await orders.handler(event({action:'prepare',kind:'video',settings,files:[{name:'x.mp4',type:'video/mp4',size:524288001}]}))).statusCode,400);
  }finally{helper.db=oldDb;helper.admin=oldAdmin;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
test('worker credentials are separate from frontend identity',()=>{
  const original=process.env.CONTENT_WORKER_KEY;
  try{process.env.CONTENT_WORKER_KEY='w'.repeat(40);assert.equal(helper.workerAllowed({headers:{authorization:'Bearer fake'}}),false);assert.equal(helper.workerAllowed({headers:{authorization:'Bearer '+'w'.repeat(40)}}),true);}finally{if(original===undefined)delete process.env.CONTENT_WORKER_KEY;else process.env.CONTENT_WORKER_KEY=original;}
});
