import React, { useEffect, useRef, useState } from 'react';

const plans = [
  { id: 'starter', name: '스타터', price: 29900, description: '콘텐츠 제작부터 시작하는 사장님', schedule: false },
  { id: 'pro', name: '프로', price: 59900, description: '제작부터 예약 발행까지 한곳에서', schedule: true },
  { id: 'business', name: '비즈니스', price: 199000, description: '꾸준히 많은 콘텐츠를 운영하는 브랜드', schedule: true },
];
const features = [
  ['🎬', '쇼츠·릴스 제작', '여러 원본으로 만드는 우리 가게 영상', false],
  ['▤', '카드뉴스 제작', '메뉴·매장·이벤트를 카드로 소개', false],
  ['✎', '대화형 수정', '대화로 요청하고 수정본을 확인', false],
  ['↓', '결과 다운로드', '완성본을 저장해 직접 업로드', false],
  ['↗', '트렌드 탐색', '공식 채널에서 최신 흐름 확인', false],
  ['◷', '예약 발행', '연결한 SNS에 정한 시간에 게시', true],
] as const;
export default function ContentMembership() {
  const [tab, setTab] = useState<'plans'|'topup'>('plans');
  const [selected, setSelected] = useState<string|null>(null);
  const [amount, setAmount] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!selected)return;
    const previous=document.activeElement as HTMLElement|null;
    const handle=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setSelected(null);return;}
      if(e.key==='Tab'){
        const buttons=dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled])');
        if(!buttons?.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('keydown',handle);previous?.focus();};
  },[selected]);
  const plan = plans.find(p => p.id === selected);
  const topup = selected === 'topup';
  return <section className="shorts-section content-membership" id="content-pricing">
    <span className="shorts-eyebrow">YOUR CREATIVE ROUTINE</span><h2>우리 가게에 맞는 구독.</h2>
    <p>제작만 필요할 때도, 발행까지 맡기고 싶을 때도.</p>
    <div className="content-pricing-tabs" role="group" aria-label="요금제 종류"><button aria-pressed={tab==='plans'} onClick={()=>setTab('plans')}>월 구독</button><button aria-pressed={tab==='topup'} onClick={()=>setTab('topup')}>추가 충전</button></div>
    {tab==='plans' ? <div className="content-plan-grid">{plans.map(p=><article key={p.id} className={'content-plan-card'+(p.id==='pro'?' is-featured':'')}>
      {p.id==='pro'&&<span className="content-plan-highlight">제작 + 예약 발행</span>}
      <h3>{p.name}</h3><p>{p.description}</p><div className="content-plan-price"><small>월</small> {p.price.toLocaleString('ko-KR')}<small>원</small></div>
      <span className="content-credit-note">월 제공 크레딧 · 원가 테스트 후 확정</span>
      <ul><li>쇼츠·릴스 + 카드뉴스 제작</li><li>원본 여러 개 첨부 · 선택 대본</li><li>대화로 수정 요청 · 결과 다운로드</li><li>트렌드 탐색</li><li className={p.schedule?'':'is-unavailable'}>{p.schedule?'예약 발행 포함 · SNS 연결 후 이용':'직접 다운로드하여 게시'}</li></ul>
      {p.id==='business'&&<p className="content-plan-detail">프로 기능 포함 · 월 크레딧 확대 구성 예정</p>}
      <button onClick={()=>setSelected(p.id)}>{p.name} 선택 →</button>
    </article>)}</div> : <div className="content-topup"><h3>필요한 만큼 추가 충전</h3><p>월 제공량을 다 쓴 뒤 제작·수정에 사용할 크레딧을 추가합니다. 추가 충전으로 예약 발행 권한이 바뀌지는 않습니다.</p><label htmlFor="content-topup-amount">추가 결제 금액</label><div className="content-topup-input"><input id="content-topup-amount" type="number" min="1000" step="1000" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="금액 입력"/><span>원</span></div><p className="content-credit-note">크레딧 환산율 · 최소 결제 금액은 확정 예정입니다.</p><button disabled={!Number.isSafeInteger(Number(amount))||Number(amount)<1000} onClick={()=>setSelected('topup')}>충전 내역 확인 →</button></div>}
    <div className="content-feature-section"><h3>구독으로 이용하는 기능</h3><div className="content-feature-grid">{features.map(([icon,title,description,pro])=><article key={title}><span className="content-feature-icon">{icon}</span>{pro&&<small>프로 · 비즈니스</small>}<h4>{title}</h4><p>{description}</p></article>)}</div></div>
    <p className="content-pricing-disclosure">관리자 개발 미리보기입니다. 실제 결제·구독 활성화·크레딧 지급은 진행되지 않습니다. 예약 발행은 SNS 계정 연결과 발행 작업자 구현 후 제공하며, 제공 크레딧·제작별 차감량·결제 조건을 확정한 뒤 공개합니다.</p>
    <p className="content-pricing-disclosure">AI 작업 실행으로 비용이 발생한 경우 사용한 제작 크레딧은 반환되지 않습니다. 제작·수정 전 차감량을 안내할 예정입니다.</p>
    {selected&&<div className="content-checkout-backdrop" onClick={()=>setSelected(null)}><div ref={dialogRef} className="content-checkout" role="dialog" aria-modal="true" aria-labelledby="content-checkout-title" onClick={e=>e.stopPropagation()}><button className="content-checkout-close" aria-label="결제 내역 닫기" autoFocus onClick={()=>setSelected(null)}>닫기 ×</button><h3 id="content-checkout-title">{topup?'추가 충전 내역':plan?.name+' 구독 내역'}</h3><strong>{Number(topup?amount:plan?.price).toLocaleString('ko-KR')}원{!topup&&' / 월'}</strong><p>{topup?'충전 크레딧 환산율은 확정 예정입니다.':plan?.schedule?'콘텐츠 제작 + 예약 발행':'콘텐츠 제작 + 다운로드'}</p><p>현재는 결제 화면 구성 미리보기입니다. 실제 청구나 구독 변경은 발생하지 않습니다.</p><button className="shorts-disabled" disabled>결제 연결 준비 중</button></div></div>}
  </section>;
}
