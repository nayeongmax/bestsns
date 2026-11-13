import React,{useEffect,useRef} from 'react';
export type Preset={id:string;name:string;group:string;version:number;format:string;size:string;fps:string;thumbnail:string|null;previewUrl?:string};
export default function PreviewDialog({preset,onClose,onChoose}:{preset:Preset;onClose:()=>void;onChoose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [failed,setFailed]=React.useState(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus();};},[]);
 return <dialog ref={dialog} className="pixel-preview-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby="studio-preview-title"><div className="pixel-preview-body"><header><div><small>{preset.format==='short'?'숏폼 · 릴스':'롱폼'}</small><h2 id="studio-preview-title">{preset.name}</h2></div><button onClick={onClose} aria-label="미리보기 닫기">✕</button></header><div className={'pixel-preview-screen '+preset.format}>{preset.previewUrl&&!failed?<video controls autoPlay muted playsInline preload="metadata" poster={preset.thumbnail||undefined} src={preset.previewUrl} onError={()=>setFailed(true)}/>:<div>{preset.thumbnail&&<img src={preset.thumbnail} alt={preset.name+' 썸네일'}/>}<p>{failed?'샘플 영상을 불러오지 못했습니다.':'이 프리셋의 샘플 영상은 준비 중입니다.'}</p></div>}</div><footer><p>{preset.previewUrl&&!failed?'최대 12초 샘플 · 소리를 켜서 확인할 수 있어요.':'썸네일로 스타일을 확인하고 선택할 수 있습니다.'}</p><button onClick={onChoose}>이 스타일로 만들기 →</button></footer></div></dialog>;
}

