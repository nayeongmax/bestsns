
import React, { useState, useEffect } from 'react';
/**
 * Fixed: Removed .ts extension from import
 */
import { EbookProduct, ChannelProduct, SiteNotification, SMMProvider, SMMProduct, SMMOrder, UserProfile, ChannelOrder, StoreOrder, Coupon, NotificationType } from '../types';
import SnsAdmin from '../components/admin/SnsAdmin.tsx';
import ChannelAdmin from '../components/admin/ChannelAdmin.tsx';
import StoreAdmin from '../components/admin/StoreAdmin.tsx';
import MemberAdmin from '../components/admin/MemberAdmin.tsx';
import MarketingAdmin from '../components/admin/MarketingAdmin.tsx';

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
  smmOrders: SMMOrder[];
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  onIssueCoupons?: (targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => void;
  /** 회원 목록(profiles) 다시 불러오기 - 판매자 승인 대기 목록 갱신용 */
  onRefreshMembers?: () => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

/**
 * Fixed: Added addNotif to component destructuring
 */
const AdminPanel: React.FC<Props> = ({ 
  user, ebooks, setEbooks, channels, setChannels, setNotifications,
  smmProviders, setSmmProviders, smmProducts, setSmmProducts, smmOrders,
  members, setMembers, channelOrders, storeOrders, onIssueCoupons, onRefreshMembers, addNotif
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'sns' | 'channel' | 'ebook' | 'member' | 'marketing'>('sns');

  const panelPassword = import.meta.env.VITE_ADMIN_PANEL_PASSWORD ?? import.meta.env.VITE_ADMIN_PASSWORD;

  // 회원 및 권한 관리 탭 열 때마다 profiles에서 회원 목록 재조회 → 판매자 승인 대기 반영
  useEffect(() => {
    if (activeTab === 'member' && onRefreshMembers) onRefreshMembers();
  }, [activeTab, onRefreshMembers]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (panelPassword && password === panelPassword) setIsLoggedIn(true);
    else alert('비밀번호가 올바르지 않습니다.');
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-32 px-4">
        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-gray-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl mb-8">🔐</div>
          <h2 className="text-2xl font-black text-gray-900 mb-8 italic uppercase underline decoration-blue-500">관리자 인증 센터</h2>
          {!panelPassword ? (
            <p className="text-sm text-amber-600 font-bold">관리자 패널 비밀번호가 설정되지 않았습니다.<br />.env 및 Netlify 환경 변수에 VITE_ADMIN_PASSWORD 또는 VITE_ADMIN_PANEL_PASSWORD를 설정하세요.</p>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[24px] text-center font-black outline-none focus:ring-2 focus:ring-blue-50" placeholder="비밀번호를 입력하세요" />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black shadow-xl hover:bg-blue-700 transition-all">로그인</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-32 px-8">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-[40px] shadow-sm border border-gray-100 gap-6">
         <div className="flex items-center gap-4 px-4">
            <span className="text-3xl">🛡️</span>
            <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">운영 총괄 대시보드</h2>
         </div>
         <div className="flex flex-wrap gap-2 justify-center bg-gray-50 p-2 rounded-[28px]">
           <button onClick={() => setActiveTab('sns')} className={`px-8 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'sns' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>SNS 활성화 관리</button>
           <button onClick={() => setActiveTab('channel')} className={`px-8 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'channel' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>채널 거래 관리</button>
           <button onClick={() => setActiveTab('ebook')} className={`px-8 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'ebook' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>N잡 스토어 관리</button>
           <button onClick={() => setActiveTab('member')} className={`px-8 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'member' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>회원 및 권한 관리</button>
           <button onClick={() => setActiveTab('marketing')} className={`px-8 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'marketing' ? 'bg-rose-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>마케팅 캠페인</button>
         </div>
      </div>

      <main className="min-h-screen">
        {activeTab === 'sns' && (
          <SnsAdmin 
            smmProviders={smmProviders} setSmmProviders={setSmmProviders} 
            smmProducts={smmProducts} setSmmProducts={setSmmProducts} 
            smmOrders={smmOrders}
          />
        )}
        {activeTab === 'channel' && <ChannelAdmin channels={channels} setChannels={setChannels} channelOrders={channelOrders} />}
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
            channels={channels}
          />
        )}
        {activeTab === 'marketing' && <MarketingAdmin user={user} members={members} onIssueCoupons={onIssueCoupons} />}
      </main>
    </div>
  );
};

export default AdminPanel;
