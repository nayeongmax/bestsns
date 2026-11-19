const {test}=require('node:test');
const assert=require('node:assert/strict');
const s=require('../netlify/lib/content-short-social.cjs');
const h=require('../netlify/lib/content-ai.cjs');

test('Unified Login exchanges Meta code and binds exactly one shared Instagram account',async()=>{
 const keys={CONTENT_AI_KEY_SECRET:'test-only-key-'.repeat(4),INSTAGRAM_CONFIG_ID:'123',INSTAGRAM_CLIENT_ID:'456',INSTAGRAM_CLIENT_SECRET:'test-secret',INSTAGRAM_GRAPH_VERSION:'v27.0',CONTENT_INSTAGRAM_ENABLED:'true',URL:'https://bestsns.com'};
 const previous=Object.fromEntries(Object.keys(keys).map(k=>[k,process.env[k]])),savedFetch=global.fetch,savedDecrypt=h.decrypt;
 Object.assign(process.env,keys);
 try{
  let accounts=[{id:'789',username:'test_instagram'}],calls=[];
  global.fetch=async(input,options)=>{
   const url=new URL(input);calls.push(url.pathname);
   assert.equal(url.hostname,'graph.facebook.com');assert.equal(options.redirect,'error');
   if(url.pathname.endsWith('/oauth/access_token')){assert.equal(url.searchParams.get('redirect_uri'),'https://bestsns.com/.netlify/functions/content-social-callback');return Response.json({access_token:'test-access',expires_in:5184000});}
   assert.equal(options.headers.Authorization,'Bearer test-access');
   if(url.pathname.endsWith('/assigned_instagram_accounts'))return Response.json({data:accounts});
   return Response.json({id:'system-user',client_business_id:'999'});
  };
  const account=await s.exchange('instagram','test-code');
  assert.equal(account.id,'789');assert.equal(account.tokens.client_business_id,'999');assert.equal(account.tokens.config_id,'123');assert.equal(account.tokens.login_mode,'unified');assert.ok(account.tokens.expires_at>Date.now());
  assert.deepEqual(calls,['/v27.0/oauth/access_token','/v27.0/me','/v27.0/me/assigned_instagram_accounts']);
  for(const list of [[],[{id:'789',username:'a'},{id:'790',username:'b'}]]){accounts=list;await assert.rejects(()=>s.exchange('instagram','test-code'),/ACCOUNT_SELECTION/);}
  h.decrypt=()=>JSON.stringify(account.tokens);calls=[];
  assert.equal(await s.access({}, {provider:'instagram',tokens:'encrypted'}),'test-access');assert.equal(calls.length,0,'SUAT must not use the legacy Instagram refresh API');
  h.decrypt=()=>JSON.stringify({...account.tokens,expires_at:Date.now()-1});await assert.rejects(()=>s.access({}, {provider:'instagram',tokens:'encrypted'}),/TOKEN_EXPIRED/);
  h.decrypt=()=>JSON.stringify({...account.tokens,config_id:'other'});await assert.rejects(()=>s.access({}, {provider:'instagram',tokens:'encrypted'}),/TOKEN_EXPIRED/);
  let stateRow;
  const db={from:()=>({insert:async row=>{stateRow=row;return{data:row,error:null};}})};
  const response=await s.connect(db,'owner','instagram');const login=new URL(JSON.parse(response.body).url);
  assert.equal(login.origin,'https://www.facebook.com');assert.equal(login.searchParams.get('config_id'),'123');assert.equal(login.searchParams.get('prompt'),'login');assert.ok(login.searchParams.get('state'));assert.ok(stateRow.state_hash);assert.equal(login.searchParams.has('client_secret'),false);assert.equal(login.searchParams.has('scope'),false);assert.match(response.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);
 }finally{global.fetch=savedFetch;h.decrypt=savedDecrypt;for(const [k,v] of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;}
});
