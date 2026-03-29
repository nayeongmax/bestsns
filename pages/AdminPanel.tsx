
import React, { useState, useEffect } from 'react';
/**
 * Fixed: Removed .ts extension from import
 */
import { EbookProduct, ChannelProduct, SiteNotification, SMMProvider, SMMProduct, SMMOrder, UserProfile, ChannelOrder, StoreOrder, Coupon, NotificationType, GradeConfig, Review } from '@/types';
import { useConfirm } from '@/contexts/ConfirmContext';
import { fetchChannelOrders } from '../channelDb';
import SnsAdmin from '../components/admin/SnsAdmin.tsx';
import ChannelAdmin from '../components/admin/ChannelAdmin.tsx';
import StoreAdmin from '../components/admin/StoreAdmin.tsx';
import MemberAdmin from '../components/admin/MemberAdmin.tsx';
import MarketingAdmin from '../components/admin/MarketingAdmin.tsx';
import PartTimeAdmin from '../components/admin/PartTimeAdmin.tsx';
import AiConsultAdmin from '../components/admin/AiConsultAdmin.tsx';

interface Props {
  user: UserProfile | null;
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  channels: ChannelProduct[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelProduct[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  smmProviders: SMMProvider[];
  setSmmProviders: React.Dispatch<React.SetStateAction<SMMProvider[]>>;
  smmProducts: SMMProduct[];
  setSmmProducts: React.Dispatch<React.SetStateAction<SMMProduct[]>>;
  onDeleteSmmProducts?: (ids: string[]) => void;
  smmOrders: SMMOrder[];
  setSmmOrders: React.Dispatch<React.SetStateAction<SMMOrder[]>>;
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  channelOrders: ChannelOrder[];
  setChannelOrders?: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
  storeOrders: StoreOrder[];
  onIssueCoupons?: (targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => void;
  /** 회원 목록(profiles) 다시 불러오기 - 판매자 승인 대기 목록 갱신용 */
  onRefreshMembers?: () => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  gradeConfigs: GradeConfig[];
  setGradeConfigs: React.Dispatch<React.SetStateAction<GradeConfig[]>>;
  reviews?: Review[];
  setReviews?: React.Dispatch<React.SetStateAction<Review[]>>;
  onUpdateUser?: (u: UserProfile) => void;
}

/**
 * Fixed: Added addNotif to component destructuring
 */
const AdminPanel: React.FC<Props> = ({ 
  user, ebooks, setEbooks, channels, setChannels, setNotifications,
  smmProviders, setSmmProviders, smmProducts, setSmmProducts, onDeleteSmmProducts, smmOrders, setSmmOrders,
  members, setMembers, channelOrders, setChannelOrders, storeOrders, onIssueCoupons, onRefreshMembers, addNotif,
  gradeConfigs, setGradeConfigs, reviews = [], setReviews, onUpdateUser
}) => {
  const { showAlert } = useConfirm();
  const ADMIN_STORAGE_KEY = 'admin_logged_in';
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem(ADMIN_STORAGE_KEY));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'sns' | 'channel' | 'ebook' | 'member' | 'marketing' | 'parttime' | 'aiconsult'>('sns');

  const panelPassword = (import.meta as any).env?.VITE_ADMIN_PANEL_PASSWORD ?? (import.meta as any).env?.VITE_ADMIN_PASSWORD ?? 'admin123';

  // 회원 및 권한 관리 탭 열 때마다 profiles에서 회원 목록 재조회 → 판매자 승인 대기 반영
  useEffect(() => {
    if (activeTab === 'member' && onRefreshMembers) onRefreshMembers();
  }, [activeTab, onRefreshMembers]);

  // 채널 거래 탭 열 때마다 channel_orders 재조회 → 결제/취소 상태 최신화
  useEffect(() => {
    if (activeTab === 'channel') {
      fetchChannelOrders()
        .then((orders) => setChannelOrders?.(orders))
        .catch((e) => console.warn('채널 주문 재로드 실패:', e));
    }
  }, [activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (panelPassword && password === panelPassword) {
      sessionStorage.setItem(ADMIN_STORAGE_KEY, '1');
      setIsLoggedIn(true);
    } else showAlert({ description: '비밀번호가 올바르지 않습니다.' });
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-32 px-4">
        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-gray-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl mb-8">🔐</div>
          <h2 className="text-2xl font-black text-gray-900 mb-8 italic uppercase underline decoration-blue-500">관리자 인증 센터</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[24px] text-center font-black outline-none focus:ring-2 focus:ring-blue-50" placeholder="비밀번호를 입력하세요" />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black shadow-xl hover:bg-blue-700 transition-all">로그인</button>
            <p className="text-xs text-gray-500">운영자 전용. .env에 VITE_ADMIN_PASSWORD 설정 시 해당 비밀번호 사용.</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-32 md:space-y-12 md:px-8">

      {/* 모바일 전용: 헤더 타이틀 + 탭 메뉴 섹션 */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="text-xl">🛡️</span>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-1">운영 총괄 대시보드</h2>
        </div>
        <div className="bg-white border-y border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="overflow-x-auto px-3 py-2" style={{WebkitOverflowScrolling: 'touch'}}>
            <div className="flex gap-1 w-max">
              <button onClick={() => setActiveTab('sns')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'sns' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>SNS 활성화</button>
              <button onClick={() => setActiveTab('channel')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'channel' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>채널 거래</button>
              <button onClick={() => setActiveTab('ebook')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'ebook' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>N잡 스토어</button>
              <button onClick={() => setActiveTab('member')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'member' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400'}`}>회원 관리</button>
              <button onClick={() => setActiveTab('marketing')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'marketing' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-400'}`}>마케팅</button>
              <button onClick={() => setActiveTab('parttime')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'parttime' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400'}`}>누구나알바</button>
              <button onClick={() => setActiveTab('aiconsult')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'aiconsult' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400'}`}>AI 상담</button>
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱 전용: 원본 헤더 + 탭 */}
      <div className="hidden md:flex flex-row justify-between items-center bg-white p-5 rounded-[40px] shadow-sm border border-gray-100 gap-6">
         <div className="flex items-center gap-4 px-4">
            <span className="text-3xl">🛡️</span>
            <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">운영 총괄 대시보드</h2>
         </div>
         <div className="w-full overflow-x-auto" style={{WebkitOverflowScrolling: 'touch'}}>
           <div className="flex flex-nowrap items-center gap-2 bg-gray-50 p-2 rounded-[28px] w-max min-w-full">
             <button onClick={() => setActiveTab('sns')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'sns' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>SNS 활성화 관리</button>
             <button onClick={() => setActiveTab('channel')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'channel' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>채널 거래 관리</button>
             <button onClick={() => setActiveTab('ebook')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'ebook' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>N잡 스토어 관리</button>
             <button onClick={() => setActiveTab('member')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'member' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>회원 및 권한 관리</button>
             <button onClick={() => setActiveTab('marketing')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'marketing' ? 'bg-rose-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>마케팅 캠페인</button>
             <button onClick={() => setActiveTab('parttime')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'parttime' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>누구나알바</button>
             <button onClick={() => setActiveTab('aiconsult')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'aiconsult' ? 'bg-purple-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>AI 상담 이력</button>
           </div>
         </div>
      </div>

      <main className="min-h-screen px-3 md:px-0 mt-3 md:mt-0">
        {activeTab === 'sns' && (
          <SnsAdmin
            smmProviders={smmProviders} setSmmProviders={setSmmProviders}
            smmProducts={smmProducts} setSmmProducts={setSmmProducts}
            onDeleteSmmProducts={onDeleteSmmProducts}
            smmOrders={smmOrders}
            setSmmOrders={setSmmOrders}
            addNotif={addNotif}
          />
        )}
        {activeTab === 'channel' && <ChannelAdmin channels={channels} setChannels={setChannels} channelOrders={channelOrders} setChannelOrders={setChannelOrders} />}
        {/**
         * Fixed: Passed addNotif down to StoreAdmin
         */}
        {activeTab === 'ebook' && <StoreAdmin ebooks={ebooks} setEbooks={setEbooks} setNotifications={setNotifications} storeOrders={storeOrders} members={members} addNotif={addNotif} />}
        {activeTab === 'member' && (
          <MemberAdmin 
            members={members} 
            setMembers={setMembers} 
            setNotifications={setNotifications}
            smmOrders={smmOrders}
            channelOrders={channelOrders}
            storeOrders={storeOrders}
            ebooks={ebooks}
            setEbooks={setEbooks}
            channels={channels}
            gradeConfigs={gradeConfigs}
            setGradeConfigs={setGradeConfigs}
            reviews={reviews}
            setReviews={setReviews}
            addNotif={addNotif}
            currentUser={user}
            onUpdateUser={onUpdateUser}
            onRefreshMembers={onRefreshMembers}
          />
        )}
        {activeTab === 'marketing' && <MarketingAdmin user={user} members={members} onIssueCoupons={onIssueCoupons} />}
        {activeTab === 'parttime' && <PartTimeAdmin addNotif={addNotif} members={members} />}
        {activeTab === 'aiconsult' && <AiConsultAdmin />}
      </main>
    </div>
  );
};

export default AdminPanel;
