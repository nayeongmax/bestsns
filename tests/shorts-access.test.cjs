const {test}=require('node:test');const assert=require('node:assert/strict');
const auth=require('../netlify/lib/admin-auth.cjs');let allowed=false;auth.authorized=async()=>allowed;
const {handler}=require('../netlify/functions/shorts-access.js');
test('preview requires server admin and publication never enables production',async()=>{
 const original=process.env.SHORTS_PUBLIC_ENABLED;try{
 delete process.env.SHORTS_PUBLIC_ENABLED;
 assert.deepEqual(JSON.parse((await handler({httpMethod:'GET'})).body),{published:false,preview:false,productionEnabled:false});
 allowed=true;assert.equal(JSON.parse((await handler({httpMethod:'GET'})).body).preview,true);
 process.env.SHORTS_PUBLIC_ENABLED='true';allowed=false;
 assert.deepEqual(JSON.parse((await handler({httpMethod:'GET'})).body),{published:true,preview:false,productionEnabled:false});
 assert.equal((await handler({httpMethod:'POST'})).statusCode,405);
 }finally{if(original===undefined)delete process.env.SHORTS_PUBLIC_ENABLED;else process.env.SHORTS_PUBLIC_ENABLED=original;}
});
