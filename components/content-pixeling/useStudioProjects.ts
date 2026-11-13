import {useEffect,useState} from 'react';
export type StudioProject={id:string;title:string;draft:string;presetId:string;updatedAt:string};
export function useStudioProjects(owner:string){
 const key='bestsns.studio.projects.v1.'+owner;
 const [projects,setProjects]=useState<StudioProject[]>(()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&typeof p.draft==='string'&&typeof p.presetId==='string'&&typeof p.updatedAt==='string').slice(0,50):[];}catch{return [];}});
 const [activeId,setActiveId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(projects.slice(0,50)));}catch{}},[projects,key]);
 function save(patch:Partial<Omit<StudioProject,'id'>>){setProjects(items=>{const existing=items.find(p=>p.id===activeId)||{id:activeId,title:'새 영상',draft:'',presetId:'',updatedAt:''};return[{...existing,...patch,updatedAt:new Date().toISOString()},...items.filter(p=>p.id!==activeId)].slice(0,50);});}
 function start(){const id=crypto.randomUUID();setActiveId(id);setProjects(items=>[{id,title:'새 영상',draft:'',presetId:'',updatedAt:new Date().toISOString()},...items].slice(0,50));return id;}
 return{projects,activeId,save,start,select:setActiveId};
}
