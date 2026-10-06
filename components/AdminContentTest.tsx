import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
type Media = { name:string; type:string; url:string; path?:string };
type Settings = { industry:string; style:string; length:string; cardCount:string; request:string; script:string; revision?:string; parentOrderId?:string };
type Order = { id:string; kind:string; status:string; message:string; created_at:string; results:Media[]; assets:Media[]; settings:Settings };
const labels:Record<string,string>={uploading:'원본 업로드 중',queued:'작업자 대기',running:'픽셀링 제작 중',completed:'제작 완료',failed:'제작 실패'};
export default function AdminContentTest({files,kind,settings,setup,options}:{files:File[];kind:'video'|'cards';settings:Settings;setup:React.ReactNode;options:React.ReactNode}) {
 const [orders,setOrders]=useState<Order[]>([]),[selected,setSelected]=useState('');
 const [connection,setConnection]=useState('연결 상태 확인 중…'),[ready,setReady]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const [draft,setDraft]=useState('');
 const [localMedia,setLocalMedia]=useState<Media[]>([]),[mediaTab,setMediaTab]=useState<'results'|'inputs'>('inputs'),[mediaIndex,setMediaIndex]=useState(0);
 const mediaCache=useRef(new Map<string,{url:string;at:number}>());
 const pollBusy=useRef(false),alive=useRef(true),chatEnd=useRef<HTMLDivElement>(null);
 async function api(body?:object) {
  const {data}=await supabase.auth.getSession();
  const response=await fetch('/.netlify/functions/content-test-orders',{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json',...(data.session?{Authorization:'Bearer '+data.session.access_token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({error:'서버 응답을 확인하지 못했습니다.'}));
  if(!response.ok)throw Error(result.error||'테스트 요청 실패');return result;
 }
 async function refresh() {
  if(pollBusy.current)return;pollBusy.current=true;
  try {const result=await api();if(!alive.current)return;const rows:Order[]=result.orders;
   for(const row of rows)for(const group of [row.assets||[],row.results||[]])for(const item of group){
    if(!item.url||!item.path)continue;
    const cached=mediaCache.current.get(item.path);
    if(cached&&Date.now()-cached.at<8*60*1000)item.url=cached.url;
    else mediaCache.current.set(item.path,{url:item.url,at:Date.now()});
   }
   setOrders(rows);setReady(result.enabled);setConnection(!result.enabled?'관리자 테스트 접수가 중지되어 있습니다.':!result.bridgeReady?'원본 업로드·주문 접수 가능 · 픽셀링 작업자 미연결: 자동 제작 대기':'원본 업로드·주문 접수 가능 · 픽셀링 작업자 설정 확인');}
  catch(e){if(alive.current){setConnection((e as Error).message);setReady(false);}}
  finally{pollBusy.current=false;}
 }
 useEffect(()=>{alive.current=true;void refresh();const timer=setInterval(()=>{void refresh();},5000);return()=>{alive.current=false;clearInterval(timer);};},[]);
 useEffect(()=>{const previews=files.map(f=>({name:f.name,type:f.type,url:URL.createObjectURL(f)}));setLocalMedia(previews);setMediaIndex(0);return()=>previews.forEach(p=>URL.revokeObjectURL(p.url));},[files]);
 const order=orders.find(o=>o.id===selected);
 useEffect(()=>{setMediaIndex(0);setMediaTab(order?.status==='completed'?'results':'inputs');},[selected,order?.status]);
 useEffect(()=>{if(selected||error||progress)chatEnd.current?.scrollIntoView({block:'nearest'});},[selected,order?.status,error,progress]);
 async function submit() {
  if(selected)return;
  if(!files.length){setError('원본 파일을 먼저 선택해 주세요.');return;}
  if(!ready){setError(connection);return;}
  const originals=[...files];const snapshot={...settings};if(draft.trim())snapshot.request=(snapshot.request+'\n'+draft.trim()).trim();
  setBusy(true);setError('');setProgress('원본 업로드 준비 중…');
  try {
   const prepared=await api({action:'prepare',kind,settings:snapshot,files:originals.map(f=>({name:f.name,type:f.type,size:f.size}))});
   for(let i=0;i<originals.length;i++){setProgress('원본 업로드 '+(i+1)+' / '+originals.length);const target=prepared.uploads[i];const result=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(target.path,target.token,originals[i],{contentType:originals[i].type});if(result.error)throw Error('원본 업로드 실패: '+result.error.message);}
   await api({action:'submit',id:prepared.id});setSelected(prepared.id);setDraft('');await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);setProgress('');}
 }
 async function revise() {
  if(!order||!draft.trim())return;
  if(!ready){setError(connection);return;}
  setBusy(true);setError('');setProgress('수정 요청 접수 중…');
  try{const result=await api({action:'revise',id:order.id,request:draft.trim()});setSelected(result.id);setDraft('');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);setProgress('');}
 }
 const media=mediaTab==='results'?(order?.status==='completed'?order.results:[]):order?(order.assets||[]).filter(a=>a.url):localMedia;
 const current=media[mediaIndex]||media[0];
 return <div className="content-chat-workspace">
  <div className="content-chat-main"><div className="content-chat-toolbar"><strong>콘텐츠 제작 대화</strong><button onClick={()=>{setSelected('');setDraft('');setError('');setMediaTab('inputs');}} disabled={busy}>+ 새 주문</button></div>
   <div className="content-chat-scroll">
    <div className="content-system-message"><span>BESTSNS</span><p>원본을 첨부하고 아래 대화창에 원하는 콘텐츠를 설명해 주세요. 업종·스타일·길이·대본은 필요할 때 선택할 수 있습니다. 완료된 콘텐츠는 오른쪽에서 확인하고, 아래 대화창으로 수정 요청을 보낼 수 있습니다.</p></div>
    <div className="content-connection" role="status"><i className={ready?'is-ready':''}/>{connection}</div>
    {!selected&&<fieldset disabled={busy} className="content-settings-fieldset">{setup}</fieldset>}
    {!selected&&<fieldset disabled={busy} className="content-settings-fieldset">{options}</fieldset>}
    {order&&<><div className="content-user-message"><span>내 제작 요청 · {order.id.slice(0,8)}</span><p>{order.settings.revision||order.settings.request||'선택한 설정으로 제작해 주세요.'}</p><small>{order.settings.industry} · {order.settings.style} · {order.kind==='video'?order.settings.length:order.settings.cardCount}</small>{order.settings.script&&<details><summary>입력한 대본</summary><p>{order.settings.script}</p></details>}</div><div className="content-system-message"><span>BESTSNS · {labels[order.status]||order.status}</span><p>{order.message||labels[order.status]}</p>{order.status==='completed'&&<button onClick={()=>setMediaTab('results')}>오른쪽에서 결과 보기 →</button>}</div></>}
    {orders.length>0&&<div className="content-order-history"><label htmlFor="content-order-history">이전 주문·수정본</label><select id="content-order-history" value={selected} onChange={e=>{setSelected(e.target.value);setError('');}}><option value="">새 주문</option>{orders.map(o=><option key={o.id} value={o.id}>{o.settings.parentOrderId?'수정본':'첫 제작'} · {o.id.slice(0,8)} · {labels[o.status]}</option>)}</select></div>}
    {progress&&<div className="content-system-message" role="status"><p>{progress}</p></div>}{error&&<div className="content-chat-error" role="alert">{error}</div>}<div ref={chatEnd}/>
   </div>
   <form className="content-chat-composer" onSubmit={e=>{e.preventDefault();void(order?revise():submit());}}><label htmlFor="content-chat-draft">{order?'수정 요청':'제작 요청'}</label><textarea id="content-chat-draft" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={10000} rows={3} disabled={busy} placeholder={order?'예: 첫 장면을 음식 클로즈업으로 바꾸고 자막을 더 크게 해 주세요.':'원하는 구성이나 강조할 내용을 적어 주세요.'}/><div><small>{order&&order.status!=='completed'?'제작 완료 후 수정 요청 가능':'원본을 업로드하고 주문을 접수합니다. 작업자 연결 전에는 제작되지 않습니다.'}</small><button type="submit" disabled={busy||(order?order.status!=='completed'||!draft.trim():!files.length||!!selected)}>{busy?'처리 중…':order?'수정 요청 ↑':'테스트 주문 접수 ↑'}</button></div></form>
  </div>
  <aside className="content-result-panel"><div className="content-panel-heading"><strong>미리보기</strong><span>{current?mediaIndex+1:0} / {media.length}</span></div><div className="shorts-tabs">{(['inputs','results'] as const).map(t=><button key={t} aria-pressed={mediaTab===t} onClick={()=>{setMediaTab(t);setMediaIndex(0);}}>{t==='inputs'?'원본 파일':'제작 결과'}</button>)}</div>
   <div className="content-media-stage">{current?current.type.startsWith('video/')?<video key={selected+mediaTab+mediaIndex} src={current.url} controls playsInline/>:<img src={current.url} alt={current.name}/>:<div className="content-panel-empty"><span>▷</span><p>{mediaTab==='results'?'완성된 영상·카드뉴스가 여기에 표시됩니다.':'원본을 선택하면 여기서 바로 확인할 수 있습니다.'}</p></div>}</div>
   {current&&<p className="content-media-name">{current.name}</p>}{current&&mediaTab==='results'&&<a className="content-download" href={current.url} target="_blank" rel="noreferrer">결과 열기·다운로드 ↗</a>}
   <div className="content-media-list">{media.map((m,i)=><button key={m.url} aria-pressed={mediaIndex===i} onClick={()=>setMediaIndex(i)}><span>{m.type.startsWith('video/')?'영상':'이미지'} {i+1}</span><small>{m.name}</small></button>)}</div>
   <p className="content-panel-note">{mediaTab==='inputs'&&!order?'선택한 원본의 로컬 미리보기입니다. 제작 시작 전에는 업로드되지 않습니다.':'주문별 원본과 결과를 확인합니다.'}</p>
  </aside>
 </div>;
}
