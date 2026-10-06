import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile } from '../types';
import { useShortsAccess } from '../hooks/useShortsAccess';
import './ShortsStudio.css';

const industries = ['음식점·카페', '뷰티·미용', '운동·피트니스', '쇼핑·브랜드', '교육·학원', '기타 업종'];
export default function ShortsStudio({ user }: { user: UserProfile | null }) {
  const access = useShortsAccess(user);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [industry, setIndustry] = useState(industries[0]);
  const [style, setStyle] = useState('매장 소개');
  const [length, setLength] = useState('30초');
  const [file, setFile] = useState<File | null>(null);
  const [request, setRequest] = useState('');
  const [tab, setTab] = useState('주문 설정');
  const allowed = access.published || access.preview || unlocked;
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/shorts-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok || data.preview !== true) throw new Error();
      setUnlocked(true); setPassword('');
    } catch { setError('운영자 인증을 확인할 수 없습니다. 비밀번호 또는 서버 설정을 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  if (access.loading) return <div className="shorts-gate" role="status">접근 권한을 확인하고 있습니다.</div>;
  if (!allowed) return <section className="shorts-gate"><span className="shorts-tag">PRIVATE PREVIEW</span><h1>쇼츠 제작을 준비하고 있어요.</h1><p>개발 중인 페이지는 운영자만 확인할 수 있습니다.</p><form onSubmit={unlock}><label htmlFor="shorts-password">운영자 미리보기 비밀번호</label><input id="shorts-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" required maxLength={256}/><button disabled={busy}>{busy ? '확인 중…' : '운영자 미리보기'}</button>{error && <p role="alert">{error}</p>}</form><Link to="/sns">기존 서비스로 돌아가기 →</Link></section>;
  return <div className="shorts-page">
    <div className="shorts-notice" role="status">개발 중 · 화면 미리보기 전용 · 주문 접수, 영상 업로드, 결제 및 크레딧 차감은 진행되지 않습니다.</div>
    <section className="shorts-hero"><div className="shorts-spark" aria-hidden="true">✦</div><span className="shorts-tag">BESTSNS SHORTS STUDIO</span><h1>매장에서 찍은 영상이<br/><em>우리 가게의 홍보</em>가 되도록.</h1><p>원본 영상과 원하는 분위기만 준비하세요.<br/>쇼츠 제작부터 결과 확인, 수정 요청까지 한곳에서.</p><div className="shorts-actions"><a className="shorts-primary" href="#/shorts" onClick={e => { e.preventDefault(); document.getElementById("shorts-workspace")?.scrollIntoView({ behavior: "smooth" }); }}>제작 화면 둘러보기 <span>↗</span></a><a className="shorts-secondary" href="#/shorts" onClick={e => { e.preventDefault(); document.getElementById("shorts-how")?.scrollIntoView({ behavior: "smooth" }); }}>어떻게 만들어지나요?</a></div><div className="shorts-chips"><span>내 영상으로 제작</span><span>업종별 제작 스타일</span><span>구독 크레딧 방식 준비 중</span></div></section>
    <section className="shorts-section" id="shorts-how"><span className="shorts-eyebrow">FROM YOUR STORE TO YOUR FEED</span><h2>촬영은 사장님이.<br/>제작과 수정은 한곳에서.</h2><div className="shorts-steps">{[['01','우리 가게를 선택','업종과 홍보 목적에 맞는 스타일을 고릅니다.'],['02','원본 영상과 요청','매장·상품·서비스 영상과 제작 요청을 준비합니다.'],['03','결과 확인과 수정','완성본을 확인하고 수정하거나 다운로드합니다.']].map(([n,t,d]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
    <section className="shorts-section" id="shorts-workspace"><div className="shorts-section-heading"><div><span className="shorts-eyebrow">YOUR CONTENT WORKSPACE</span><h2>우리 가게의 다음 쇼츠.</h2></div><span className="shorts-tag">개발 중</span></div><div className="shorts-workspace"><div className="shorts-editor"><div className="shorts-tabs">{['주문 설정','결과 확인'].map(t => <button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>{tab==='주문 설정' ? <><label htmlFor="shorts-industry">업종</label><select id="shorts-industry" value={industry} onChange={e=>setIndustry(e.target.value)}>{industries.map(i=><option key={i}>{i}</option>)}</select><label>제작 스타일</label><div className="shorts-options">{['매장 소개','상품·메뉴 소개','이벤트 홍보'].map(s=><button key={s} aria-pressed={style===s} onClick={()=>setStyle(s)}>{s}</button>)}</div><label>영상 길이</label><div className="shorts-options">{['15초','30초','60초'].map(s=><button key={s} aria-pressed={length===s} onClick={()=>setLength(s)}>{s}</button>)}</div><label htmlFor="shorts-file" className="shorts-upload"><strong>{file ? file.name : '+ 원본 영상 선택'}</strong><span>미리보기용 · 파일은 서버로 전송되지 않습니다</span><input id="shorts-file" type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0] || null)}/></label><label htmlFor="shorts-request">제작 요청</label><textarea id="shorts-request" value={request} onChange={e=>setRequest(e.target.value)} placeholder="예: 음식이 가장 맛있게 보이는 장면을 앞에 넣고, 마지막에 매장명을 보여 주세요." rows={4}/><div className="shorts-cost"><span>예상 차감 크레딧</span><strong>요금 정책 준비 중</strong></div><button className="shorts-disabled" disabled>영상 제작 · 준비 중</button></> : <div className="shorts-empty"><span aria-hidden="true">▷</span><h3>완성된 영상이 이곳에 모입니다.</h3><p>아직 제작된 영상이 없습니다. 연동 완료 후 제작 상태와 버전별 결과를 확인할 수 있습니다.</p><div className="shorts-options"><button disabled>수정 요청</button><button disabled>영상 다운로드</button></div></div>}</div><aside className="shorts-preview"><div className="shorts-phone"><div className="shorts-phone-top">BESTSNS<br/><strong>우리 가게의 이야기</strong></div><div className="shorts-phone-art" aria-hidden="true"><span>✦</span><div>YOUR<br/>NEXT<br/><em>STORY.</em></div></div><p>{industry}<br/><strong>{style} · {length}</strong></p></div><p className="shorts-caption">화면 구성 예시 · 실제 생성 영상이 아닙니다</p></aside></div></section>
    <section className="shorts-section shorts-subscription"><span className="shorts-eyebrow">A ROUTINE FOR YOUR BUSINESS</span><h2>꾸준한 홍보를 위한 구독.</h2><p>월 구독으로 제작 크레딧을 받고, 제작과 수정에 필요한 만큼 사용하도록 준비하고 있습니다.</p><div className="shorts-chips"><span>제작 전 차감량 확인</span><span>실패한 작업 차감 취소</span><span>수정본별 이력 관리</span></div><button className="shorts-disabled" disabled>구독 요금제 · 준비 중</button></section>
    <section className="shorts-section shorts-existing"><h2>기존 BESTSNS 서비스도 함께.</h2><div>{[['/sns','마케팅주문'],['/channels','채널판매'],['/ebooks','N잡스토어'],['/part-time','누구나알바']].map(([url,label])=><Link key={url} to={url}>{label} ↗</Link>)}</div></section>
  </div>;
}
