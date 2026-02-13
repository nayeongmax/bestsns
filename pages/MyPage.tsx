
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
/**
 * Fixed: Imported missing NotificationType
 */
import { UserProfile, EbookProduct, ChannelProduct, ChannelOrder, SMMOrder, Review, StoreOrder, NotificationType, GradeConfig, getUserGrade } from '../types';
import UserInfoSection from '@/components/mypage/UserInfoSection';
import BuyerDashboard from '@/components/mypage/BuyerDashboard';
import SellerDashboard from '@/components/mypage/SellerDashboard';
import FreelancerDashboard from '@/components/mypage/FreelancerDashboard';

interface Props {
  user: UserProfile;
  members?: UserProfile[];
  onUpdate: (updated: UserProfile) => void;
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  channels: ChannelProduct[];
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  onAddReview: (review: Review) => void;
  onUpdateReview: (review: Review) => void;
  reviews: Review[];
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  /** 마이페이지 진입 시 로그인 사용자 프로필 재조회 (승인 직후 판매자 워크스페이스 즉시 반영) */
  onRefetchProfile?: () => void;
  gradeConfigs?: GradeConfig[];
}

type MainTab = 'buyer' | 'seller' | 'freelancer' | 'settings';
type NicknameStatus = 'idle' | 'available' | 'unavailable';

/**
 * Fixed: Added addNotif to component destructuring
 */
const MyPage: React.FC<Props> = ({ user, members = [], onUpdate, ebooks, setEbooks, channels, smmOrders, channelOrders, storeOrders, onAddReview, onUpdateReview, reviews, addNotif, onRefetchProfile, gradeConfigs = [] }) => {
  const displayUser = useMemo(() => {
    if (!user) return null;
    const m = members.find((x) => x.id === user.id);
    return m ? { ...user, ...m } : user;
  }, [user, members]);
  const effectiveUser = displayUser || user;
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    onRefetchProfile?.();
  }, [onRefetchProfile]);

  const [activeMainTab, setActiveMainTab] = useState<MainTab>(() => {
    const s = location.state as { activeTab?: MainTab } | null;
    return (s?.activeTab && ['buyer', 'seller', 'freelancer', 'settings'].includes(s.activeTab)) ? s.activeTab : 'settings';
  });
  
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'expert' | 'notif' | 'pw' | 'quit'>(() => {
    return (location.state as any)?.openExpert ? 'expert' : 'profile';
  });

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNicknameValue, setEditNicknameValue] = useState(() => effectiveUser.nickname);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');

  const availableCouponCount = useMemo(() => {
    return effectiveUser.coupons?.filter(c => c.status === 'available').length || 0;
  }, [effectiveUser.coupons]);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ ...effectiveUser, profileImage: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const checkNicknameDuplicate = () => {
    const trimmedValue = editNicknameValue.trim();
    if (!trimmedValue) return alert('닉네임을 입력해주세요.');
    if (trimmedValue === effectiveUser.nickname) {
      setNicknameStatus('available');
      return;
    }
    const takenNicknames = ['admin', '관리자', '운영자', 'THEBEST', '마케터이', '김마케터'];
    if (takenNicknames.includes(trimmedValue)) {
      setNicknameStatus('unavailable');
    } else {
      setNicknameStatus('available');
    }
  };

  const handleNicknameUpdate = () => {
    if (nicknameStatus !== 'available') return alert('중복 확인을 통해 수정 가능 여부를 확인해주세요.');
    onUpdate({ ...effectiveUser, nickname: editNicknameValue.trim() });
    setIsEditingNickname(false);
    setNicknameStatus('idle');
    alert('닉네임이 성공적으로 변경되었습니다.');
  };

  const goToExpertRegistration = () => {
    setActiveMainTab('settings');
    setSettingsSubTab('expert');
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-32 px-4 lg:px-8 space-y-10 animate-in fade-in duration-500">
      {/* 1. 상단 프로필 영역 */}
      <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group w-28 h-28 cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
            <img src={effectiveUser.profileImage} className="w-full h-full rounded-[36px] object-cover border-4 border-blue-50 shadow-xl" alt="profile" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[36px] transition-all">
              <span className="text-white text-xs font-black">변경</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfileImageChange} />
          </div>
          
          <div className="text-center md:text-left space-y-2">
            {isEditingNickname ? (
              <div className="space-y-2">
                <input value={editNicknameValue} onChange={(e) => { setEditNicknameValue(e.target.value); setNicknameStatus('idle'); }} className="w-full p-3 bg-gray-50 rounded-xl font-black text-center md:text-left outline-none border border-blue-100" autoFocus />
                <div className="flex gap-2">
                  <button type="button" onClick={checkNicknameDuplicate} className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all ${ nicknameStatus === 'available' ? 'bg-green-500 text-white' : nicknameStatus === 'unavailable' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500' }`}> 중복확인 </button>
                  <button type="button" onClick={handleNicknameUpdate} disabled={nicknameStatus !== 'available'} className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all ${ nicknameStatus === 'available' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-300 cursor-not-allowed' }`}> 변경 </button>
                  <button type="button" onClick={() => { setIsEditingNickname(false); setEditNicknameValue(effectiveUser.nickname); setNicknameStatus('idle'); }} className="px-3 py-2 bg-gray-50 text-gray-400 rounded-lg text-[11px] font-black">X</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsEditingNickname(true)} className="group flex flex-col items-center md:items-start gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors italic">{effectiveUser.nickname}</h2>
                  <span className="text-[14px] opacity-30 group-hover:opacity-100 transition-opacity">✏️</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                   {(() => { const g = getUserGrade(effectiveUser, gradeConfigs); return g ? <span className={`${g.color} text-white text-[10px] font-black px-2.5 py-0.5 rounded-full italic uppercase tracking-wider`}>{g.name}</span> : null; })()}
                   {(!gradeConfigs.length || !getUserGrade(effectiveUser, gradeConfigs)) && <span className="text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded italic uppercase tracking-widest">Standard Member</span>}
                   {effectiveUser.sellerStatus === 'approved' && <span className="text-[11px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded italic uppercase tracking-widest">Expert ✓</span>}
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="bg-gray-50 p-6 rounded-[32px] flex items-center gap-6 min-w-[200px]">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm">💰</div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase italic">Points</p>
              <h3 className="text-xl font-black text-gray-900 italic">{(effectiveUser.points || 0).toLocaleString()} P</h3>
            </div>
            <Link to="/payment/point" className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[11px] shadow-lg hover:bg-black transition-all">충전</Link>
          </div>
          <div className="bg-gray-50 p-6 rounded-[32px] flex items-center gap-6 min-w-[200px]">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm">🎫</div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase italic">Coupons</p>
              <h3 className="text-xl font-black text-gray-900 italic">{availableCouponCount} 장</h3>
            </div>
            <Link to="/coupons" className="ml-auto bg-gray-900 text-white px-4 py-2 rounded-xl font-black text-[11px] shadow-lg hover:bg-blue-600 transition-all">내역</Link>
          </div>
        </div>
      </div>

      <div className="bg-gray-100/50 p-2 rounded-[32px] flex flex-wrap gap-2 w-full max-w-5xl mx-auto shadow-inner">
        {[
          { id: 'buyer', label: '🖥️ 구매자 대시보드', color: 'text-blue-600' },
          { id: 'seller', label: '👨‍🏫 판매자 워크페이스', color: 'text-orange-600' },
          { id: 'freelancer', label: '👷 프리랜서 워크페이스', color: 'text-emerald-600' },
          { id: 'settings', label: '⚙️ 계정 및 정보 관리', color: 'text-gray-900' }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setActiveMainTab(mode.id as MainTab)}
            className={`flex-1 min-w-[140px] py-5 rounded-[24px] font-black text-[14px] md:text-[16px] transition-all duration-300 relative ${
              activeMainTab === mode.id 
              ? 'bg-white shadow-xl scale-[1.02] ' + mode.color 
              : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {mode.label}
            {mode.id === 'seller' && effectiveUser.sellerStatus !== 'approved' && <span className="ml-2 opacity-50">🔒</span>}
          </button>
        ))}
      </div>

      <div className="w-full">
        {activeMainTab === 'settings' && (
          <UserInfoSection 
            user={effectiveUser} 
            onUpdate={onUpdate} 
            forcedTab={settingsSubTab} 
            onTabChange={(tab) => setSettingsSubTab(tab as any)}
            /**
             * Fixed: Passed addNotif down to UserInfoSection
             */
            addNotif={addNotif}
          />
        )}
        {activeMainTab === 'buyer' && <BuyerDashboard user={effectiveUser} smmOrders={smmOrders} channelOrders={channelOrders} storeOrders={storeOrders} ebooks={ebooks} onAddReview={onAddReview} initialSubTab={(location.state as any)?.buyerSubTab} />}
        {activeMainTab === 'freelancer' && <FreelancerDashboard user={effectiveUser} onUpdate={onUpdate} />}
        {activeMainTab === 'seller' && (
          <SellerDashboard 
            user={effectiveUser} 
            ebooks={ebooks} 
            setEbooks={setEbooks}
            channels={channels} 
            storeOrders={storeOrders}
            onApplySeller={goToExpertRegistration}
            reviews={reviews}
            onUpdateReview={onUpdateReview}
          />
        )}
      </div>
    </div>
  );
};

export default MyPage;
