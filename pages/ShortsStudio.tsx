import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import type {UserProfile} from '../types';
import {useShortsAccess} from '../hooks/useShortsAccess';
import PixelingStudio from '../components/content-pixeling/PixelingStudio';
import StudioPlans from '../components/content-pixeling/StudioPlans';
import {studioAdminApi,type StudioSettings} from '../components/content-pixeling/studioSettings';
import './ContentStudioPage.css';
const accents=[['blue','블루'],['violet','바이올렛'],['mint','민트'],['rose','로즈'],['amber','앰버']];
function scrollToSection(event:React.MouseEvent<HTMLAnchorElement>,id:string){event.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
function saved(key:string,fallback:string){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
export default function ShortsStudio({user}:{user:UserProfile|null}){
 const access=useShortsAccess(user);
 const navigate=useNavigate(),planDialog=useRef<HTMLDialogElement>(null);
 const [membership,setMembership]=useState<{active:boolean;operator:boolean}|null>(null),[membershipError,setMembershipError]=useState(''),[plansOpen,setPlansOpen]=useState(false),[retry,setRetry]=useState(0);
 const canUse=membership?.active||membership?.operator;
 function closePlans(){if(canUse)setPlansOpen(false);else navigate('/sns');}
 useEffect(()=>{const open=()=>setPlansOpen(true);window.addEventListener('studio:plans',open);return()=>window.removeEventListener('studio:plans',open);},[]);
 useEffect(()=>{if(plansOpen&&!planDialog.current?.open)planDialog.current?.showModal();if(!plansOpen&&planDialog.current?.open)planDialog.current.close();},[plansOpen,access.loading]);

 const [mode,setMode]=useState(()=>saved('bestsns.content.mode','light')),[accent,setAccent]=useState(()=>saved('bestsns.content.accent','blue'));
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
 const [settings,setSettings]=useState<StudioSettings|null>(null);
 useEffect(()=>{if(!access.preview&&!access.published)return;let alive=true;setMembership(null);setMembershipError('');studioAdminApi('content-studio-membership').then(d=>{if(alive){setSettings(d.settings);setMembership({active:d.active===true,operator:d.operator===true});setPlansOpen(d.active!==true);}}).catch(e=>{if(alive)setMembershipError(e.message);});return()=>{alive=false;};},[access.preview,access.published,user?.id,retry]);
 useEffect(()=>{const query=window.matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{try{localStorage.setItem('bestsns.content.mode',mode);localStorage.setItem('bestsns.content.accent',accent);}catch{}},[mode,accent]);
 const dark=mode==='dark'||mode==='system'&&systemDark;
 if(access.loading)return <section className="studio-loading" role="status">콘텐츠 스튜디오를 준비하고 있어요.</section>;
 if(!access.preview&&!access.published)return <section className="studio-loading"><span>BESTSNS CONTENT STUDIO</span><h1>더 쉬운 영상 제작을 준비하고 있어요.</h1><p>샘플을 고르고, 내 영상으로 만들고, 말로 수정하는 공간.</p>{!user&&<Link to="/login">로그인</Link>}<Link to="/sns">기존 서비스로 돌아가기</Link></section>;
 return <div className="studio-page" data-mode={dark?'dark':'light'} data-accent={accents.some(a=>a[0]===accent)?accent:'blue'}>
 <div className="studio-toolbar"><a href="#studio-create" onClick={e=>scrollToSection(e,'studio-create')} className="studio-wordmark"><span>✦</span> Content studio <small>by BESTSNS</small></a><div className="studio-appearance"><button className="studio-plans-trigger" onClick={()=>setPlansOpen(true)}>구독 요금제</button>{access.preview&&<Link to="/admin?tab=contentproduction">운영 관리 ↗</Link>}<label>화면<select aria-label="화면 모드" value={mode} onChange={e=>setMode(e.target.value)}><option value="light">화이트</option><option value="dark">다크</option><option value="system">기기 설정</option></select></label><div className="studio-swatches" role="group" aria-label="강조 색상">{accents.map(([id,name])=><button key={id} data-color={id} aria-label={name} aria-pressed={accent===id} title={name} onClick={()=>setAccent(id)}>{accent===id?'✓':''}</button>)}</div></div></div>
 {access.preview&&<div className="studio-development">운영자 전용 테스트 · PC 자동 제작 연결을 검증 중입니다. 회원 공개와 결제는 비활성화되어 있습니다.</div>}
 <section className="studio-create" id="studio-create">{membershipError?<div className="studio-entry-state" role="alert"><p>{membershipError}</p><button onClick={()=>setRetry(v=>v+1)}>다시 확인</button></div>:!membership?<p className="studio-entry-state" role="status">구독 정보를 확인하고 있어요.</p>:canUse?<PixelingStudio key={user?.id||'guest'} signedIn={!!user} userId={user?.id} isAdmin={access.preview} displaySettings={settings}/>:<div className="studio-entry-state"><h1>구독하고 영상 제작을 시작하세요</h1><p>나에게 맞는 요금제를 선택해 주세요.</p><button onClick={()=>setPlansOpen(true)}>구독 요금제 보기</button></div>}</section>
 <dialog ref={planDialog} className="studio-subscription-dialog" aria-labelledby="studio-subscription-title" onCancel={e=>{e.preventDefault();closePlans();}}><div className="studio-subscription-top"><span>BESTSNS CONTENT STUDIO</span><button onClick={closePlans} aria-label={canUse?'요금제 닫기':'기존 서비스로 돌아가기'}>×</button></div><StudioPlans settings={settings}/>{membership?.operator&&<div className="studio-preview-entry"><button onClick={()=>setPlansOpen(false)}>운영자 테스트 작업실 열기 →</button></div>}</dialog>
 <footer className="studio-footer"><strong>BESTSNS CONTENT STUDIO</strong><span>내 가게와 채널을 위한 콘텐츠 작업실.</span><Link to="/sns">마케팅 서비스 보기 ↗</Link></footer>
 </div>;
}

