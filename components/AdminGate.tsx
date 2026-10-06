import React,{useEffect,useState} from 'react';
import { Link } from 'react-router-dom';
import { verifyAdminSession } from '../adminSession';
export default function AdminGate({children}:{children:React.ReactNode}) {
  const [allowed,setAllowed]=useState<boolean|null>(null);
  useEffect(()=>{let active=true;verifyAdminSession().then(value=>{if(active)setAllowed(value);}).catch(()=>{if(active)setAllowed(false);});return()=>{active=false;};},[]);
  if(allowed===null)return <div role="status">관리자 권한을 확인하고 있습니다.</div>;
  if(!allowed)return <div className="p-12 text-center"><p>서버에서 확인된 관리자 로그인이 필요합니다.</p><Link to="/login">로그인하기</Link></div>;
  return <>{children}</>;
}
