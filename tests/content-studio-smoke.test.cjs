const {test}=require('node:test'),assert=require('node:assert/strict');
const s=require('../netlify/lib/content-studio-smoke.cjs');
test('single operator smoke test rejects altered content, attachments, members and expired permits',()=>{
 const now=Date.now;Date.now=()=>Date.parse('2026-11-14T00:00:00Z');
 try{const d={presetId:s.presetId,text:s.message,files:[]};
 assert.equal(s.permits(true,d),true);
 assert.equal(s.permits(false,d),false);
 for(const patch of [{text:'another video'},{presetId:'other'},{parentId:'revision'},{files:[{}]}])assert.equal(s.permits(true,{...d,...patch}),false);
 Date.now=()=>Date.parse('2026-11-14T03:50:00Z');assert.equal(s.permits(true,d),false);
 }finally{Date.now=now;}
});
