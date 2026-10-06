import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile } from '../types';
import { useShortsAccess } from '../hooks/useShortsAccess';
import './ShortsStudio.css';
import AdminContentTest from '../components/AdminContentTest';

const industries = ['음식점·카페', '뷰티·미용', '운동·피트니스', '쇼핑·브랜드', '교육·학원', '인플루언서', '맛집', '기타 업종'];
const foodImage = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=700&q=85';
const showcaseExamples = [
  { industry: '맛집', title: '한 입에 반하는 순간', caption: '오늘의 메뉴를, 오늘의 주인공으로.', image: foodImage, video: 'https://assets.mixkit.co/videos/4678/4678-720.mp4', kind: '릴스 예시', color: '#d89b56' },
  { industry: '음식점·카페', title: '커피 한 잔의 여유', caption: '우리 동네에서 찾은 작은 쉼표.', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=85', video: 'https://assets.mixkit.co/videos/43941/43941-720.mp4', kind: '쇼츠 예시', color: '#b69b79' },
  { industry: '맛집', title: '꼭 저장해 둘 맛집', caption: '메뉴부터 분위기까지, 한 장씩.', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=85', kind: '카드뉴스 예시', color: '#a29bbf' },
  { industry: '맛집', title: '오늘의 시그니처', caption: '맛있는 순간을 짧고 생생하게.', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=85', video: 'https://assets.mixkit.co/videos/2430/2430-720.mp4', kind: '릴스 예시', color: '#98b6a6' },
  { industry: '쇼핑·브랜드', title: '새로운 취향의 발견', caption: '보여 주고 싶은 브랜드의 순간.', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=85', kind: '카드뉴스 예시', color: '#cba6a0' },
];
function ShowcaseVideo({ src, paused, label }: { src: string; paused: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !paused) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.15 });
    observer.observe(video);
    if (paused) video.pause();
    return () => { observer.disconnect(); video.pause(); };
  }, [paused]);
  return <><video ref={ref} src={src} muted loop playsInline preload="metadata" aria-label={label} onError={() => setFailed(true)} />{failed && <span className="shorts-video-error">영상을 불러오지 못했습니다. 새로고침해 주세요.</span>}</>;
}
function ContentShowcase() {
  const [paused, setPaused] = useState(false);
  const [examples] = useState(() => {
    const shuffled = [...showcaseExamples];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  return <section className="shorts-showcase" aria-label="콘텐츠 제작 예시">
    <div className="shorts-section shorts-showcase-heading"><div><span className="shorts-eyebrow">MADE FOR YOUR FEED</span><h2>우리 가게도 이렇게.</h2><p>쇼츠·릴스부터 카드뉴스까지, 콘텐츠의 분위기를 둘러보세요.</p></div><button className="shorts-carousel-toggle" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? '자동 넘김 재생 ▷' : '자동 넘김 일시정지 Ⅱ'}</button></div>
    <div className={'shorts-carousel' + (paused ? ' is-paused' : '')}><div className="shorts-carousel-track">{[0, 1].map(copy => <div className="shorts-carousel-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>{examples.map((item, index) => <article className="shorts-result-card" key={item.title} style={{ '--card-accent': item.color } as React.CSSProperties}><div className="shorts-result-photo">{'video' in item && item.video ? <ShowcaseVideo src={item.video} paused={paused} label={item.industry + ' 실제 샘플 영상'} /> : <img src={item.image} alt={copy === 0 ? item.industry + ' 카드뉴스 디자인 예시' : ''} loading="lazy"/>}<span className="shorts-result-kind">{item.kind}</span><div className="shorts-result-overlay"><span>{item.industry}</span><h3>{item.title}</h3>{item.kind.includes('카드뉴스') ? <div className="shorts-card-dots"><i/><i/><i/><span>01 / 05</span></div> : <span className="shorts-result-duration">음소거 자동 재생 · 영상 예시</span>}</div></div><div className="shorts-result-description"><span>CONCEPT 0{index + 1}</span><p>{item.caption}</p></div></article>)}</div>)}</div></div>
    <p className="shorts-showcase-note">쇼츠·릴스는 실제 샘플 영상으로 재생됩니다. 카드뉴스는 디자인 예시이며, 고객 제작 결과물은 아닙니다.</p>
  </section>;
}
export default function ShortsStudio({ user }: { user: UserProfile | null }) {
  const access = useShortsAccess(user);
  const [contentType, setContentType] = useState('쇼츠·릴스');
  const [cardCount, setCardCount] = useState('5장');
  const [industry, setIndustry] = useState(industries[0]);
  const [style, setStyle] = useState('매장 소개');
  const [length, setLength] = useState('30초');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [request, setRequest] = useState('');
  const [script, setScript] = useState('');
  const legacyAdmin = false;
  const allowed = access.published || access.preview || legacyAdmin;
  if (access.loading) return <div className="shorts-gate" role="status">접근 권한을 확인하고 있습니다.</div>;
  if (!allowed) return <section className="shorts-gate"><span className="shorts-tag">PRIVATE PREVIEW</span><h1>콘텐츠 제작을 준비하고 있어요.</h1><p>개발 중인 페이지는 운영자만 확인할 수 있습니다.</p>{!user && <Link to="/login">운영자 계정으로 로그인 →</Link>}<Link to="/sns">기존 서비스로 돌아가기 →</Link></section>;
  return <div className="shorts-page">
    <div className="shorts-notice" role="status">개발 중 · 화면 미리보기 전용 · 일반 이용 불가 · 관리자 테스트만 별도 설정 후 가능 · 결제·크레딧 차감 비활성</div>
    <section className="shorts-hero"><span className="shorts-tag">BESTSNS CONTENT STUDIO</span><h1>매장에서 찍은 순간이<br/><em>우리 가게의 홍보</em>가 되도록.</h1><p>영상·사진과 원하는 분위기만 준비하세요.<br/>쇼츠·릴스와 카드뉴스 제작부터 수정 요청까지 한곳에서.</p><div className="shorts-actions"><a className="shorts-primary" href="#/shorts" onClick={e => { e.preventDefault(); document.getElementById("shorts-workspace")?.scrollIntoView({ behavior: "smooth" }); }}>제작 화면 둘러보기 <span>↗</span></a><a className="shorts-secondary" href="#/shorts" onClick={e => { e.preventDefault(); document.getElementById("shorts-how")?.scrollIntoView({ behavior: "smooth" }); }}>어떻게 만들어지나요?</a></div><div className="shorts-chips"><span>내 영상·사진으로 제작</span><span>업종별 제작 스타일</span><span>구독 크레딧 방식 준비 중</span></div></section>
    <section className="shorts-section" id="shorts-how"><span className="shorts-eyebrow">FROM YOUR STORE TO YOUR FEED</span><h2>촬영은 사장님이.<br/>제작과 수정은 한곳에서.</h2><div className="shorts-steps">{[['01','우리 가게를 선택','업종과 홍보 목적에 맞는 스타일을 고릅니다.'],['02','소재와 제작 요청','매장·상품의 영상과 사진, 제작 요청을 준비합니다.'],['03','결과 확인과 수정','완성본을 확인하고 수정하거나 다운로드합니다.']].map(([n,t,d]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
    <ContentShowcase />
    <section className="shorts-section shorts-conversation-section" id="shorts-workspace"><div className="shorts-section-heading"><div><span className="shorts-eyebrow">YOUR CONTENT WORKSPACE</span><h2>대화로 만드는 우리 가게 콘텐츠.</h2></div><span className="shorts-tag">ADMIN TEST</span></div>{access.preview ? <AdminContentTest files={files} kind={contentType==='카드뉴스'?'cards':'video'} settings={{industry,style,length,cardCount,request,script}} options={<div className="shorts-editor"><label htmlFor="shorts-industry">업종</label><select id="shorts-industry" value={industry} onChange={e=>setIndustry(e.target.value)}>{industries.map(i=><option key={i}>{i}</option>)}</select><label>제작 스타일</label><div className="shorts-options">{['매장 소개','상품·메뉴 소개','이벤트 홍보'].map(s=><button key={s} aria-pressed={style===s} onClick={()=>setStyle(s)}>{s}</button>)}</div><label>{contentType === '카드뉴스' ? '카드뉴스 장수' : '영상 길이'}</label><div className="shorts-options">{(contentType === '카드뉴스' ? ['3장','5장','7장'] : ['15초','30초','60초']).map(s=><button key={s} aria-pressed={(contentType === '카드뉴스' ? cardCount : length)===s} onClick={()=>contentType === '카드뉴스' ? setCardCount(s) : setLength(s)}>{s}</button>)}</div><label htmlFor="shorts-script">대본 <span className="shorts-optional">선택</span></label><textarea id="shorts-script" value={script} onChange={e=>setScript(e.target.value)} maxLength={10000} placeholder={contentType === '카드뉴스' ? '카드별 제목과 본문을 입력해 주세요. 비워 두어도 됩니다.' : '원하는 내레이션이나 자막 대본을 입력해 주세요. 비워 두어도 됩니다.'} rows={5} aria-describedby="shorts-script-help"/><p id="shorts-script-help" className="shorts-input-help">입력한 대본은 제작 시 우선 반영하도록 준비합니다. 비워 두면 업종·소재·제작 요청을 바탕으로 구성합니다. 실제 테스트 제작을 시작하면 원본과 함께 전달됩니다.</p></div>} setup={<div className="shorts-editor"><label>제작 유형</label><div className="shorts-options">{['쇼츠·릴스','카드뉴스'].map(type => <button key={type} aria-pressed={contentType===type} onClick={() => { setContentType(type); setFiles([]); setFileError(''); }}>{type}</button>)}</div><label htmlFor="shorts-file" className="shorts-upload"><strong>{files.length ? `원본 ${files.length}개 선택됨` : contentType === '카드뉴스' ? '+ 원본 사진 선택' : '+ 원본 영상 선택'}</strong><span>최대 10개 · 파일당 500MB · 테스트 제작 시 업로드</span><input id="shorts-file" key={contentType} type="file" multiple accept={contentType === '카드뉴스' ? 'image/*' : 'video/*'} onChange={e=>{ const selected=Array.from(e.target.files||[]); const merged=[...files]; for(const f of selected) if(!merged.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified)) merged.push(f); if(merged.length>10||merged.some(f=>f.size>500*1024*1024)||merged.reduce((n,f)=>n+f.size,0)>1024*1024*1024){setFileError('최대 10개, 파일당 500MB, 총 1GB까지 선택할 수 있습니다.');}else{setFiles(merged);setFileError('');} e.target.value=''; }}/></label>{fileError&&<p role="alert" className="shorts-test-error">{fileError}</p>}<ul className="shorts-source-list">{files.map((f,index)=><li key={f.name+f.size+f.lastModified}><span>{f.name} · {(f.size/1024/1024).toFixed(1)}MB</span><button type="button" aria-label={f.name+' 제거'} onClick={()=>setFiles(files.filter((_,i)=>i!==index))}>제거</button></li>)}</ul><div className="shorts-cost"><span>예상 차감 크레딧</span><strong>요금 정책 준비 중</strong></div></div>}/> : <p>실제 제작 테스트는 서버에서 인증한 관리자만 이용할 수 있습니다.</p>}</section>
    <section className="shorts-section shorts-subscription"><span className="shorts-eyebrow">A ROUTINE FOR YOUR BUSINESS</span><h2>꾸준한 홍보를 위한 구독.</h2><p>월 구독으로 제작 크레딧을 받고, 쇼츠·릴스와 카드뉴스 제작·수정에 필요한 만큼 사용하도록 준비하고 있습니다.</p><div className="shorts-chips"><span>제작 전 차감량 확인</span><span>작업 실행 후 크레딧 반환 없음</span><span>수정본별 이력 관리</span></div><p className="shorts-input-help">작업 실행으로 AI 사용 비용이 발생하면, 결과나 게시 상태와 관계없이 사용한 크레딧은 반환되지 않습니다. 제작 시작 전에 차감량과 정책을 안내합니다.</p><button className="shorts-disabled" disabled>구독 요금제 · 준비 중</button></section>
    <section className="shorts-section shorts-existing"><h2>기존 BESTSNS 서비스도 함께.</h2><div>{[['/sns','마케팅주문'],['/channels','채널판매'],['/ebooks','N잡스토어'],['/part-time','누구나알바']].map(([url,label])=><Link key={url} to={url}>{label} ↗</Link>)}</div></section>
  </div>;
}
