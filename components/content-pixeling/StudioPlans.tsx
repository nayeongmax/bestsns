import React,{useState} from 'react';
import {money,type StudioSettings} from './studioSettings';
export default function StudioPlans({settings}:{settings:StudioSettings|null}){
 const [annual,setAnnual]=useState(false);
 return <section className="studio-plans" id="content-pricing">
 <div className="studio-section-title"><span className="studio-kicker">나에게 맞는 구독</span><h2 id="studio-subscription-title">구독하고 영상 제작을 시작하세요</h2><p>스타일 선택부터 완성 영상까지, 나에게 맞는 플랜으로.</p><div className="studio-billing-toggle" role="group" aria-label="결제 주기"><button aria-pressed={!annual} onClick={()=>setAnnual(false)}>월간 결제</button><button aria-pressed={annual} onClick={()=>setAnnual(true)}>연간 결제 <span>30% 할인</span></button></div><p className="studio-billing-note">최종 결제금액 기준 · 연간은 12개월 일괄 결제</p></div>
 {settings?<><div className="studio-plan-grid">{settings.plans.map(p=>{const yearly=p.monthlyPrice===null?null:Math.round(p.monthlyPrice*12*0.7);const monthly=annual&&yearly!==null?Math.round(yearly/12):p.monthlyPrice;return <article key={p.id} className={p.id==='pro'?'featured':''}>
 {p.id==='pro'&&<span className="studio-plan-badge">제작 + SNS 업로드</span>}<h3>{p.name}</h3><p>{p.description}</p><strong>{money(monthly)}<small> / 월{annual?' 환산':''}</small></strong><p className="studio-billed-total">{annual?`연 ${money(yearly)} 일괄 결제`:`매월 ${money(p.monthlyPrice)} 결제`}</p>
 {annual&&yearly!==null&&<div className="studio-plan-saving">월간 12회 대비 <b>{money(p.monthlyPrice!*12-yearly)} 절약</b></div>}
 <ul><li>월 제공 크레딧 산정 중</li><li>프리셋으로 대화하며 영상 제작</li><li>완성 영상 수정 요청</li><li>다운로드 · 결과물 보관</li><li className={!p.autoUpload?'excluded':''}>{p.autoUpload?'SNS 자동 업로드 포함':'SNS 자동 업로드 미포함'}</li></ul><button className="studio-plan-cta" disabled>구독 결제 준비 중</button></article>;})}</div>
 <div className="studio-plan-comparison"><h3>요금제별로 무엇이 다른가요?</h3><div className="studio-comparison-scroll"><table><thead><tr><th scope="col">기능</th>{settings.plans.map(p=><th scope="col" key={p.id}>{p.name}</th>)}</tr></thead><tbody><tr><th scope="row">월 제작 크레딧</th>{settings.plans.map(p=><td key={p.id}>산정 중</td>)}</tr>{['프리셋 선택 · 대화형 제작','완성 영상 수정 요청','다운로드 · 결과물 보관'].map(label=><tr key={label}><th scope="row">{label}</th>{settings.plans.map(p=><td key={p.id}>포함</td>)}</tr>)}<tr><th scope="row">SNS 자동 업로드</th>{settings.plans.map(p=><td key={p.id}>{p.autoUpload?'포함':'미포함'}</td>)}</tr></tbody></table></div></div></>:<p role="status">요금제를 불러오고 있습니다.</p>}
 <p className="studio-plan-note">영상마다 차감 크레딧이 달라 제공량과 차감 기준을 산정 중입니다. 프로·비즈니스의 추가 혜택은 확정 후 안내합니다. 구독 결제는 준비 중이며, SNS 업로드는 플랫폼 연결과 승인 후 이용할 수 있습니다.</p></section>;
}
