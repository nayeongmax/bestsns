const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../netlify/data/content-pixeling-catalog.json').items;
const previews=require('../netlify/data/content-youtube-previews.json');

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
  assert.ok(['channel-reference','preset-reference','similar-style'].includes(p.kind));
  assert.match(p.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
  for(const key of Object.keys(p))assert.ok(allowed.has(key),'only public preview metadata: '+key);
  if(p.width!==undefined)assert.ok(p.width>0&&p.height>0);
 }
});

test('reported missing community cards have playable references',()=>{
 for(const name of ['노빠꾸패밀리 채널(일본쇼츠)','닭강정(쇼츠)','먹보너구리(관찰영)','검술포착 채널']){
  const matching=catalog.filter(x=>x.name===name);
  assert.ok(matching.length,name);
  for(const preset of matching)assert.ok(preset.previewUrl||previews[preset.id],name);
 }
});
