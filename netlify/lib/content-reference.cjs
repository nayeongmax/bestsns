function reference(value){
 if(!value)return null;
 const u=new URL(typeof value==='string'?value:value.url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2000)throw Error('REFERENCE');
 const host=u.hostname.toLowerCase();let platform,id,url;
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host)){
  id=host==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v');
  if(!/^[\w-]{11}$/.test(id||''))throw Error('REFERENCE');platform='youtube';url='https://www.youtube.com/watch?v='+id;
 }else if(['instagram.com','www.instagram.com'].includes(host)){
  const match=u.pathname.match(/^\/(reel|p)\/([\w-]+)\/?$/);if(!match)throw Error('REFERENCE');platform='instagram';url='https://www.instagram.com/'+match[1]+'/'+match[2]+'/';
 }else if(['clip.naver.com','m.clip.naver.com','tv.naver.com','m.tv.naver.com'].includes(host)&&u.pathname!=='/'){
  platform='naver';u.hash='';u.search='';url=u.href;
 }else throw Error('REFERENCE');
 return{platform,url,...(id?{videoId:id}:{})};
}
function seconds(iso){const m=String(iso).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0;}
async function discover({query='',format='all'}={}){
 const key=process.env.YOUTUBE_DATA_API_KEY;if(!key)throw Error('KEY');
 if(typeof query!=='string'||query.length>100||!['all','short','long'].includes(format))throw Error('INPUT');
 async function get(resource,params){const u=new URL('https://www.googleapis.com/youtube/v3/'+resource);u.search=new URLSearchParams({...params,key});const r=await fetch(u,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('YOUTUBE');return r.json();}
 let ids;
 if(query.trim()){const data=await get('search',{part:'snippet',type:'video',q:query.trim(),order:'viewCount',publishedAfter:new Date(Date.now()-30*86400000).toISOString(),regionCode:'KR',maxResults:'24'});ids=(data.items||[]).map(i=>i.id?.videoId).filter(id=>/^[\w-]{11}$/.test(id||''));if(!ids.length)return{items:[],scope:'최근 30일 검색 결과 · 조회수순',fetchedAt:new Date().toISOString()};}
 const data=await get('videos',{part:'snippet,contentDetails,statistics,status',...(ids?{id:ids.join(',')}:{chart:'mostPopular',regionCode:'KR',maxResults:'24'})});
 const items=(data.items||[]).filter(i=>i.status?.embeddable&&i.snippet?.liveBroadcastContent==='none'&&/^[\w-]{11}$/.test(i.id)).map(i=>({id:i.id,title:i.snippet.title,channel:i.snippet.channelTitle,url:'https://www.youtube.com/watch?v='+i.id,thumbnail:'https://i.ytimg.com/vi/'+i.id+'/mqdefault.jpg',duration:seconds(i.contentDetails?.duration),views:String(i.statistics?.viewCount||'0')})).filter(i=>i.duration>0&&(format==='all'||(format==='short'?i.duration<=180:i.duration>180)));
 return{items,scope:ids?'최근 30일 검색 결과 · 조회수순':'한국 인기 차트 · API 제공 범위',fetchedAt:new Date().toISOString()};
}
module.exports={reference,seconds,discover};
