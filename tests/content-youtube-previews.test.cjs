const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../netlify/data/content-pixeling-catalog.json').items;
const previews=require('../netlify/data/content-youtube-previews.json');
const policy=require('../netlify/data/content-preview-policy.json');
const {compatible,buildCatalog}=require('../netlify/lib/content-preview-catalog.cjs');
const resolved=buildCatalog({items:catalog},previews,policy).items;

test('reference previews belong to real presets without replacing uploaded sample videos',()=>{
 const allowed=new Set(['videoId','title','channel','channelUrl','duration','embeddable','verifiedAt','kind','width','height']);
 for(const [id,p] of Object.entries(previews)){
  const preset=catalog.find(x=>x.id===id);
  assert.ok(preset,id);
  assert.ok(!preset.previewUrl,'keep the original MP4: '+preset.name);
  assert.match(p.videoId,/^[A-Za-z0-9_-]{11}$/);
  assert.equal(p.embeddable,true);
  assert.ok(p.title&&p.channel);
  assert.match(p.channelUrl,/^https:\/\/www\.youtube\.com\/(channel\/|@)/);
  assert.ok(p.duration>0);
  assert.ok(compatible(preset,p),'format must match: '+preset.name);
  assert.ok(['channel-reference','preset-reference','similar-style'].includes(p.kind));
  assert.match(p.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
  for(const key of Object.keys(p))assert.ok(allowed.has(key),'only public preview metadata: '+key);
  if(p.width!==undefined)assert.ok(p.width>0&&p.height>0);
 }
});

test('reported missing community cards have playable references',()=>{
 for(const name of ['노빠꾸패밀리 채널(일본쇼츠)','닭강정(쇼츠)','먹보너구리(관찰영)','검술포착 채널']){
  const matching=resolved.filter(x=>x.name===name);
  assert.ok(matching.length,name);
  for(const preset of matching)assert.ok(preset.previewUrl||previews[preset.id],name);
 }
});

test('portrait presets reject landscape, unknown dimensions, and overlong references',()=>{
 const short={format:'short'};
 const video={videoId:'icOO3aByOC0',embeddable:true,width:1080,height:1920,duration:29};
 assert.equal(compatible(short,video),true);
 for(const patch of [{width:1920,height:1080},{width:0},{height:0},{duration:181},{embeddable:false}]) {
  assert.equal(compatible(short,{...video,...patch}),false);
  const result=buildCatalog({items:[{id:'bad',...short}]},{bad:{...video,...patch}}).items[0];
  assert.equal(result.previewStatus,'pending');assert.equal(result.youtube,undefined);
 }
 assert.equal(compatible({format:'long'},video),false);
});

test('reported white-caption preset plays; broadcast documentaries stay out of the gallery',()=>{
 const white=resolved.find(p=>p.name==='승인화이트 3단계(쇼츠)');
 assert.equal(white.youtube.videoId,'icOO3aByOC0');
 for(const name of ['생물 다큐 v2','과학탐구(롱폼)']){
  const p=resolved.find(p=>p.name===name);
  assert.equal(p.previewStatus,'pending');assert.equal(p.youtube,undefined);assert.equal(p.previewUrl,undefined);
 }
 for(const p of resolved.filter(p=>p.previewStatus==='ready'))assert.ok(p.previewUrl||p.youtube);
 for(const [id,target] of Object.entries(policy.sampleAliases)){
  const source=catalog.find(p=>p.id===target),preset=resolved.find(p=>p.id===id);
  assert.ok(source.previewUrl);assert.equal(source.format,preset.format);
  assert.equal(preset.previewUrl,source.previewUrl);assert.ok(preset.sampleSourceName);
 }
});
