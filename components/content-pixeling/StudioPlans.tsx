import React,{useState} from 'react';
import {money,type StudioSettings} from './studioSettings';
export default function StudioPlans({settings}:{settings:StudioSettings|null}){
 const [annual,setAnnual]=useState(false);
 return <section className="studio-plans" id="content-pricing">
 <div className="studio-section-title"><span className="studio-kicker">나에게 맞는 이용 방식</span><h2>제작부터 게시까지, 필요한 만큼.</h2><p>표시 금액은 최종 결제금액입니다. 연간 결제 시 30% 할인됩니다.</p><div className="studio-billing-toggle" role="group" aria-label="결제 주기"><button aria-pressed={!annual} onClick={()=>setAnnual(false)}>월간 결제</button><button aria-pressed={annual} onClick={()=>setAnnual(true)}>연간 결제 <span>30% 할인</span></button></div></div>
 {settings?<div className="studio-plan-grid">{settings.plans.map(p=>{const yearly=p.monthlyPrice===null?null:Math.round(p.monthlyPrice*12*0.7);return <article key={p.id} className={p.id==='pro'?'featured':''}><h3>{p.name}</h3><p>{p.description}</p><strong>{money(annual?yearly:p.monthlyPrice)}{p.monthlyPrice!==null&&<small> / {annual?'년':'월'}</small>}</strong>{annual&&yearly!==null&&<p className="studio-annual-detail">월 환산 {money(Math.round(yearly/12))} · 연 1회 결제<br/><del>{money(p.monthlyPrice!*12)}</del> 대비 30% 할인</p>}<ul><li>{p.includedVideos===null?'월 포함 제작 수 준비 중':`월 영상 ${p.includedVideos}편 포함 예정`}</li><li>영상 샘플 선택과 제작</li><li>완성본 기반 수정 요청</li><li>결과 다운로드·보관</li><li className={!p.autoUpload?'excluded':''}>{p.autoUpload?'SNS 자동 업로드':'자동 업로드 미포함'}</li></ul></article>;})}</div>:<p className="studio-plan-note">요금 안내를 불러오고 있습니다.</p>}
 <p className="studio-plan-note">구독 결제는 준비 중입니다. SNS 자동 업로드는 프로·비즈니스에서 플랫폼 연결 및 승인 후 이용할 수 있습니다.</p></section>;
}
