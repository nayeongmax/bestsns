const h=require('../lib/content-ai.cjs'),m=require('../lib/content-members.cjs'),y=require('../lib/content-youtube.cjs'),s=require('../lib/content-short-social.cjs');const {randomBytes,createHash}=require('node:crypto');
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return h.json(405,{error:'Method not allowed'});
 if(!h.originAllowed(event))return h.json(403,{error:'Forbidden'});
 if(!m.enabled())return h.json(503,{error:'회원 서비스를 준비하고 있습니다.'});
 try{const db=h.db(),owner=await m.member(event,db);if(!owner)return h.json(401,{error:'로그인 후 이용해 주세요.'});const config=y.config();const subscription=await m.subscription(db,owner);
 if(event.httpMethod==='GET'){
  const connection=h.checked(await db.from('content_social_connections').select('provider,channel_id,channel_name').eq('owner_id',owner));
  const posts=h.checked(await db.from('content_social_posts').select('id,provider,chat_id,result_path,status,video_id,public_url,privacy,message').eq('owner_id',owner).order('updated_at',{ascending:false}).limit(100));return h.json(200,{youtubeEnabled:config.enabled,providers:{youtube:config.enabled,instagram:s.config('instagram').enabled,tiktok:s.config('tiktok').enabled},subscription,connections:connection,posts});
 }
 const d=JSON.parse(event.body||'{}');
 if(d.action==='preference'){if(typeof d.enabled!=='boolean'||d.enabled&&!subscription.eligible)return h.json(403,{error:'자동 업로드는 유효한 프로·비즈니스 구독에서 사용할 수 있습니다.'});h.checked(await db.from('content_subscriptions').update({auto_upload_opt_in:d.enabled}).eq('owner_id',owner));return h.json(200,{saved:true});}
 if(!subscription.canPublish&&d.action!=='disconnect')return h.json(403,{error:'프로·비즈니스 구독과 자동 업로드 사용 설정이 필요합니다.'});
 const provider=d.provider||'youtube';if(!['youtube','instagram','tiktok'].includes(provider))return h.json(400,{error:'지원하지 않는 SNS입니다.'});
 if(provider!=='youtube')return await shortAction(db,owner,provider,d);
 if(!config.enabled&&d.action!=='disconnect')return h.json(503,{error:'유튜브 연결을 준비하고 있습니다.'});
 if(d.action==='connect'){
  const state=randomBytes(32).toString('base64url'),cookie=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  h.checked(await db.from('content_social_oauth').insert({state_hash:y.digest(state),owner_id:owner,cookie_hash:y.digest(cookie),verifier:h.encrypt(verifier),expires_at:new Date(Date.now()+10*60000).toISOString()}));
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'consent select_account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return h.json(200,{url:url.href},{'Set-Cookie':'content_youtube_oauth='+cookie+'; Path=/.netlify/functions/content-youtube-callback; Max-Age=600; Secure; HttpOnly; SameSite=Lax'});
 }
 if(d.action==='disconnect'){h.checked(await db.from('content_social_connections').delete().eq('owner_id',owner).eq('provider','youtube'));return h.json(200,{disconnected:true});}
 if(d.action!=='publish'||!m.uuid(d.id)||!m.uuid(d.chatId)||typeof d.path!=='string'||!y.validMetadata(d)||d.confirmed!==true)return h.json(400,{error:'영상·제목·공개 범위·아동용 여부·합성 콘텐츠 여부를 확인해 주세요.'});
 const chat=h.checked(await db.from('content_ai_chats').select('results').eq('id',d.chatId).eq('owner_id',owner).eq('member',true).single());
 const result=chat?.results?.find(r=>r.path===d.path&&r.type==='video/mp4');if(!result)return h.json(404,{error:'게시할 완성 영상을 찾을 수 없습니다.'});
 const connection=h.checked(await db.from('content_social_connections').select('channel_id').eq('owner_id',owner).eq('provider','youtube').single());if(!connection)return h.json(400,{error:'유튜브를 먼저 연결해 주세요.'});
 const prior=h.checked(await db.from('content_social_posts').select('id,status').eq('owner_id',owner).eq('provider','youtube').eq('result_path',result.path).maybeSingle());if(prior)return h.json(200,{id:prior.id,status:prior.status,existing:true});
 const inserted=await db.from('content_social_posts').insert({id:d.id,owner_id:owner,chat_id:d.chatId,provider:'youtube',channel_id:connection.channel_id,result_path:result.path,metadata:y.metadata(d)});
 if(inserted.error){if(inserted.error.code==='23505')return h.json(409,{error:'이미 접수된 영상입니다. 게시 내역을 확인해 주세요.'});throw Error('INSERT');}
 try{await y.dispatch(d.id);}catch(e){return h.json(202,{id:d.id,status:'queued'});}return h.json(200,{id:d.id,status:'queued'});
 }catch(e){return h.json(503,{error:'SNS 요청을 처리하지 못했습니다. 연결과 게시 내역을 확인해 주세요.'});}
};

async function shortAction(db,owner,provider,d){
 if(d.action==='disconnect'){h.checked(await db.from('content_social_connections').delete().eq('owner_id',owner).eq('provider',provider));return h.json(200,{disconnected:true});}
 if(!s.config(provider).enabled)return h.json(503,{error:'해당 SNS 연결을 준비하고 있습니다.'});
 if(d.action==='connect')return s.connect(db,owner,provider);
 const connection=h.checked(await db.from('content_social_connections').select('*').eq('owner_id',owner).eq('provider',provider).single());if(!connection)return h.json(400,{error:'SNS 계정을 먼저 연결해 주세요.'});
 let creator=null;if(provider==='tiktok'){const token=await s.access(db,connection);const info=await s.tik(token,'post/publish/creator_info/query/',{});creator=info.data;}
 if(d.action==='creator'&&creator)return h.json(200,{creator});
 if(d.action!=='publish'||!m.uuid(d.id)||!m.uuid(d.chatId)||typeof d.path!=='string'||!s.validMetadata(provider,d,creator)||d.confirmed!==true)return h.json(400,{error:'영상·계정·문구·공개 범위·게시 옵션을 확인해 주세요.'});
 const chat=h.checked(await db.from('content_ai_chats').select('results').eq('id',d.chatId).eq('owner_id',owner).eq('member',true).single());const result=chat?.results.find(r=>r.path===d.path&&r.type==='video/mp4');if(!result)return h.json(404,{error:'완성 영상을 찾을 수 없습니다.'});
 const prior=h.checked(await db.from('content_social_posts').select('id,status').eq('owner_id',owner).eq('provider',provider).eq('result_path',result.path).maybeSingle());if(prior)return h.json(200,{...prior,existing:true});
 const metadata={caption:(d.title+'\n'+d.description).trim(),privacy:d.privacy,synthetic:d.synthetic,comments:d.comments,duet:d.duet,stitch:d.stitch,ownBrand:d.ownBrand,paidBrand:d.paidBrand};
 const inserted=await db.from('content_social_posts').insert({id:d.id,owner_id:owner,chat_id:d.chatId,provider,channel_id:connection.channel_id,result_path:result.path,metadata});if(inserted.error){if(inserted.error.code==='23505')return h.json(409,{error:'이미 접수된 영상입니다. 게시 내역을 확인해 주세요.'});throw Error('INSERT');}
 await s.dispatch(d.id).catch(()=>{});return h.json(202,{id:d.id,status:'queued'});
}
