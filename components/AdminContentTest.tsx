import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
type Result = { name: string; type: string; url: string };
type Order = { id: string; kind: string; status: string; message: string; created_at: string; results: Result[] };
type Settings = { industry: string; style: string; length: string; cardCount: string; request: string; script: string };
const labels: Record<string,string> = { uploading:'원본 업로드 중',queued:'작업자 대기',running:'픽셀링 제작 중',completed:'완료',failed:'실패' };
export default function AdminContentTest({ files, kind, settings }: { files: File[]; kind: 'video'|'cards'; settings: Settings }) {
  const [orders,setOrders]=useState<Order[]>([]);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false); const [loaded,setLoaded]=useState(false);
  async function api(body?:object) {
    const { data }=await supabase.auth.getSession();
    const response=await fetch('/.netlify/functions/content-test-orders',{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json',...(data.session?{Authorization:`Bearer ${data.session.access_token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json(); if(!response.ok) throw Error(result.error||'테스트 요청 실패'); return result;
  }
  async function refresh() {try{const result=await api();setOrders(result.orders);setReady(result.enabled&&result.bridgeReady);setError('');}catch(e){setError((e as Error).message);setReady(false);}finally{setLoaded(true);}}
  useEffect(()=>{let active=true; const update=()=>{if(active) void refresh();};update();const timer=setInterval(update,5000);return()=>{active=false;clearInterval(timer);};},[]);
  async function submit() {
    setBusy(true);setError('');
    try{
      const prepared=await api({action:'prepare',kind,settings,files:files.map(f=>({name:f.name,type:f.type,size:f.size}))});
      for(let i=0;i<files.length;i++) {
        const target=prepared.uploads[i];
        const {error:uploadError}=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(target.path,target.token,files[i],{contentType:files[i].type});
        if(uploadError) throw Error('원본 업로드 실패: '+uploadError.message);
      }
      await api({action:'submit',id:prepared.id});await refresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="shorts-section shorts-admin-test"><span className="shorts-tag">ADMIN TEST</span><h2>실제 제작 테스트</h2><p>위에서 선택한 원본과 제작 설정을 테스트 주문으로 전달합니다. 이 테스트는 사이트 크레딧을 차감하지 않지만, 픽셀링에서 실행하면 실제 AI 비용이 발생할 수 있습니다.</p><button className="shorts-test-submit" disabled={!ready||busy||!files.length} onClick={submit}>{busy?'원본 업로드·주문 접수 중…':`${kind==='video'?'영상':'카드뉴스'} 테스트 제작 · 원본 ${files.length}개`}</button>{error&&<p role="alert" className="shorts-test-error">{error}</p>}{loaded&&!ready&&!error&&<p role="status">픽셀링 작업자 연결과 테스트 활성화 설정을 기다리고 있습니다.</p>}<div className="shorts-test-orders">{orders.map(order=><article key={order.id}><div className="shorts-section-heading"><strong>{order.kind==='video'?'영상':'카드뉴스'} · {order.id.slice(0,8)}</strong><span className="shorts-tag">{labels[order.status]||order.status}</span></div><p>{order.message}</p><small>{new Date(order.created_at).toLocaleString('ko-KR')}</small><div className="shorts-test-results">{order.status==='completed'&&order.results.map(result=><div key={result.url}>{result.type.startsWith('video/')?<video src={result.url} controls playsInline/>:<img src={result.url} alt={result.name}/>}<a href={result.url} target="_blank" rel="noreferrer">{result.name} 열기·저장 ↗</a></div>)}</div></article>)}</div></section>;
}
