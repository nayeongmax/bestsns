import React,{useEffect,useState} from 'react';
import {supabase} from '../../supabase';
import type {Preset} from './PreviewDialog';
export async function presetApi(body?:object){const {data}=await supabase.auth.getSession();const response=await fetch('/.netlify/functions/content-studio-presets',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(data.session?{Authorization:'Bearer '+data.session.access_token}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw Error(result.error||'프리셋을 저장하지 못했습니다.');return result;}
async function inspectVideo(file:File){
 const url=URL.createObjectURL(file),video=document.createElement('video');video.muted=true;video.preload='auto';video.src=url;
 try{return await new Promise<{thumbnail:Blob;portrait:boolean}>((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('영상 확인 시간이 초과됐습니다. H.264 MP4로 변환해 주세요.')),20000);
  video.onerror=()=>{clearTimeout(timeout);reject(Error('브라우저에서 재생되지 않는 영상입니다. H.264 MP4로 변환해 주세요.'));};
  video.onloadeddata=()=>{if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0){clearTimeout(timeout);reject(Error('정상적으로 재생되는 MP4를 선택하세요.'));return;}
   const canvas=document.createElement('canvas'),ratio=Math.min(1,640/video.videoWidth,640/video.videoHeight);canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);canvas.getContext('2d')!.drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{clearTimeout(timeout);blob?resolve({thumbnail:blob,portrait:video.videoHeight>video.videoWidth}):reject(Error('썸네일을 만들지 못했습니다.'));},'image/jpeg',.85);
  };
 });}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
export default function StudioPresetAdmin({presets,onChanged}:{presets:Preset[];onChanged:()=>Promise<void>}){
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[prompt,setPrompt]=useState(''),[sourceId,setSourceId]=useState(''),[file,setFile]=useState<File|null>(null),[rows,setRows]=useState<any[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[editing,setEditing]=useState(''),[editPrompt,setEditPrompt]=useState('');
 async function refresh(){const d=await presetApi();setRows(d.rows||[]);setReady(d.ready);}
 useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[]);
 async function save(){if(!file)return;setBusy(true);setMessage('영상 전체 재생과 썸네일을 확인하고 있습니다.');try{
  if(file.type!=='video/mp4'||file.size>300*1024*1024)throw Error('300MB 이하 MP4를 선택하세요.');
  const {thumbnail,portrait}=await inspectVideo(file);
  const prepared=await presetApi({action:'prepare',sourceId:sourceId||null,name,description,prompt,format:portrait?'short':'long',size:file.size,thumbnailSize:thumbnail.size});
  setMessage('전체 영상을 업로드하고 있습니다.');
  const videoUpload=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.video.path,prepared.video.token,file,{contentType:'video/mp4'});if(videoUpload.error)throw videoUpload.error;
  const thumbUpload=await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.thumbnail.path,prepared.thumbnail.token,thumbnail,{contentType:'image/jpeg'});if(thumbUpload.error)throw thumbUpload.error;
  await presetApi({action:'publish',id:prepared.id});await refresh();await onChanged();setMessage('전체 영상과 프리셋을 공개했습니다.');setName('');setDescription('');setPrompt('');setSourceId('');setFile(null);
 }catch(e){setMessage((e as Error).message);await refresh().catch(()=>{});}finally{setBusy(false);}}
 async function action(body:object){setBusy(true);try{await presetApi(body);await refresh();await onChanged();setMessage('변경 내용을 저장했습니다.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <details className="pixel-preset-admin"><summary>운영자 · 영상 프리셋 등록과 관리</summary><p>직접 만든 영상 전체를 등록할 수 있습니다. 회원에게는 영상과 설명만 보이고 제작 지침은 운영자에게만 제공됩니다.</p>{!ready&&<p role="status">프리셋 저장소 설정이 필요합니다. 관리자가 프로젝트·프리셋 마이그레이션을 적용하면 등록할 수 있습니다.</p>}<label>등록 방식<select value={sourceId} onChange={e=>{setSourceId(e.target.value);const p=presets.find(p=>p.id===e.target.value);if(p)setName(p.name);}}><option value="">새 프리셋 추가</option>{presets.filter(p=>p.id.startsWith('cloud_')&&!p.previewUrl).map(p=><option key={p.id} value={p.id}>{p.name} · 영상 보충</option>)}</select></label><label>프리셋 이름<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>회원에게 보일 설명<textarea maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>비공개 제작 지침<textarea value={prompt} maxLength={20000} onChange={e=>setPrompt(e.target.value)} placeholder="장면 구성, 컷 길이, 자막, 내레이션, 음악 등 제작 규칙"/></label><label>전체 샘플 영상 · MP4 300MB 이하<input type="file" accept="video/mp4" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label><p>숏폼·롱폼은 영상 비율로 분류하고 썸네일은 영상에서 만듭니다. 공개할 수 있는 영상만 등록해 주세요.</p><button disabled={busy||!ready||!name.trim()||!prompt.trim()||!file} onClick={()=>void save()}>전체 영상 업로드하고 공개</button><p role="status">{message}</p><ul>{rows.map(row=><li key={row.id}><strong>{row.name}</strong> · {row.published?'공개':'비공개'}<button disabled={busy} onClick={()=>void action({action:row.published?'hide':'publish',id:row.id})}>{row.published?'비공개로 변경':'업로드 확인 후 공개'}</button><button disabled={busy} onClick={async()=>{try{const d=await presetApi({action:'prompt',id:row.id});setEditing(row.id);setEditPrompt(d.prompt);}catch(e){setMessage((e as Error).message);}}}>비공개 지침 수정</button>{editing===row.id&&<div><textarea aria-label="비공개 지침 수정" value={editPrompt} maxLength={20000} onChange={e=>setEditPrompt(e.target.value)}/><button disabled={busy||!editPrompt.trim()} onClick={()=>void action({action:'update-prompt',id:row.id,prompt:editPrompt})}>지침 저장</button></div>}</li>)}</ul></details>;
}
