const m=require('../lib/content-members.cjs');
const h=require('../lib/content-ai.cjs'),y=require('../lib/content-youtube.cjs');
const clear='content_youtube_oauth=; Path=/.netlify/functions/content-youtube-callback; Max-Age=0; Secure; HttpOnly; SameSite=Lax';
exports.handler=async event=>{
 if(event.httpMethod!=='GET'||!y.config().enabled)return h.json(404,{error:'Not found'});
 try{const q=event.queryStringParameters||{},cookie=(event.headers?.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('content_youtube_oauth='))?.slice('content_youtube_oauth='.length);
 if(!q.state||!cookie||q.state.length>200||cookie.length>200)throw Error('STATE');
 const db=h.db(),rows=h.checked(await db.from('content_social_oauth').delete().eq('state_hash',y.digest(q.state)).eq('cookie_hash',y.digest(cookie)).gt('expires_at',new Date().toISOString()).select('*'));
 if(rows.length!==1||!q.code||q.error)throw Error('STATE');const row=rows[0];
 if(!(await m.subscription(db,row.owner_id)).canPublish)throw Error('PLAN');
 const tokens=await y.token({grant_type:'authorization_code',code:q.code,code_verifier:h.decrypt(row.verifier)});
 if(!tokens.refresh_token||!tokens.scope?.split(' ').includes('https://www.googleapis.com/auth/youtube.upload'))throw Error('SCOPE');
 const channel=await y.channel(tokens.access_token);h.checked(await db.from('content_social_connections').upsert({owner_id:row.owner_id,provider:'youtube',channel_id:channel.id,channel_name:channel.name,tokens:h.encrypt(JSON.stringify({refresh_token:tokens.refresh_token})),updated_at:new Date().toISOString()}));
 return{statusCode:302,headers:{Location:y.config().base+'/#/shorts','Set-Cookie':clear,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'},body:''};
 }catch(e){return h.json(400,{error:'유튜브 연결을 완료하지 못했습니다. 사이트에서 다시 연결해 주세요.'},{'Set-Cookie':clear,'Referrer-Policy':'no-referrer'});}
};
