
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
/**
 * Fixed: Imported missing NotificationType
 */
import { UserProfile, EbookProduct, ChannelProduct, ChannelOrder, SMMOrder, Review, StoreOrder, NotificationType, GradeConfig, getUserGrade } from '../types';
import UserInfoSection from '@/components/mypage/UserInfoSection';
import { updateProfile } from '../profileDb';
import { compressImageForStorage } from '../constants';
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
  setStoreOrders?: React.Dispatch<React.SetStateAction<StoreOrder[]>>;
  setChannelOrders?: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
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
const MyPage: React.FC<Props> = ({ user, members = [], onUpdate, ebooks, setEbooks, channels, smmOrders, channelOrders, storeOrders, setStoreOrders, setChannelOrders, onAddReview, onUpdateReview, reviews, addNotif, onRefetchProfile, gradeConfigs = [] }) => {
  const displayUser = useMemo(() => {
    if (!user) return null;
    const m = members.find((x) => x.id === user.id);
    return m ? { ...user, ...m } : user;
  }, [user, members]);
  const effectiveUser = displayUser || user;

  // 환불/취소 반영 실시간 계산: profiles에 저장된 누적값 대신 실제 주문 데이터로 정확한 금액 산출
  const accurateEffectiveUser = useMemo(() => {
    const uid = effectiveUser.id;
    const nickname = effectiveUser.nickname;

    const activePurchaseStore = storeOrders.filter(o => o.userId === uid && o.status !== '취소').reduce((s, o) => s + o.price, 0);
    const activePurchaseChannel = channelOrders.filter(o => o.userId === uid && o.status !== 'refunded').reduce((s, o) => s + o.price, 0);
    const activePurchaseSmm = smmOrders.filter(o => o.userId === uid).reduce((s, o) => s + o.sellingPrice * o.quantity, 0);

    const activeSales = storeOrders.filter(o => o.sellerNickname === nickname && o.status !== '취소').reduce((s, o) => s + o.price, 0);

    return {
      ...effectiveUser,
      totalPurchaseAmount: activePurchaseStore + activePurchaseChannel + activePurchaseSmm,
      totalSalesAmount: activeSales,
    };
  }, [effectiveUser, storeOrders, channelOrders, smmOrders]);
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    onRefetchProfile?.();
  }, [onRefetchProfile]);

  const [activeMainTab, setActiveMainTab] = useState<MainTab>(() => {
    const s = location.state as { activeTab?: MainTab } | null;
    return (s?.activeTab && ['buyer', 'seller', 'freelancer', 'settings'].includes(s.activeTab)) ? s.activeTab : 'buyer';
  });
  
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'expert' | 'notif' | 'pw' | 'quit'>(() => {
    return (location.state as any)?.openExpert ? 'expert' : 'profile';
  });
  const [expertRegistrationFor, setExpertRegistrationFor] = useState<'seller' | 'freelancer' | null>(null);

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNicknameValue, setEditNicknameValue] = useState(() => effectiveUser.nickname);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');

  const availableCouponCount = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    return effectiveUser.coupons?.filter(c => c.status === 'available' && c.expiry >= now).length || 0;
  }, [effectiveUser.coupons]);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result as string;
      let imageToSave = raw;
      try {
        imageToSave = await compressImageForStorage(raw, 200, 0.8);
      } catch {
        // 압축 실패 시 원본 사용
      }
      onUpdate({ ...effectiveUser, profileImage: imageToSave });
      updateProfile(effectiveUser.id, { profileImage: imageToSave }).catch((err) =>
        console.warn('프로필 이미지 DB 저장 실패:', err)
      );
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
    const reservedNicknames = ['admin', '관리자', '운영자', 'THEBEST', '마케터이', '김마케터'];
    const isTaken =
      reservedNicknames.includes(trimmedValue) ||
      members.some((m) => m.id !== effectiveUser.id && m.nickname === trimmedValue);
    if (isTaken) {
      setNicknameStatus('unavailable');
    } else {
      setNicknameStatus('available');
    }
  };

  const handleNicknameUpdate = async () => {
    if (nicknameStatus !== 'available') return alert('중복 확인을 통해 수정 가능 여부를 확인해주세요.');
    const newNickname = editNicknameValue.trim();
    try {
      await updateProfile(effectiveUser.id, { nickname: newNickname });
      onUpdate({ ...effectiveUser, nickname: newNickname });
      setIsEditingNickname(false);
      setNicknameStatus('idle');
      alert('닉네임이 성공적으로 변경되었습니다.');
    } catch {
      alert('닉네임 변경 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const goToExpertRegistration = (from?: 'seller' | 'freelancer') => {
    if (from) setExpertRegistrationFor(from);
    setActiveMainTab('settings');
    setSettingsSubTab('expert');
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-32 px-4 lg:px-8 space-y-10 animate-in fade-in duration-500">
      {/* 1. 상단 프로필 영역 */}
      <div className="bg-white p-5 sm:p-8 md:p-10 rounded-[32px] sm:rounded-[48px] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-8">
        <div className="flex flex-row md:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
          <div className="relative group w-20 h-20 sm:w-28 sm:h-28 cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
            <img src={effectiveUser.profileImage} className="w-full h-full rounded-[24px] sm:rounded-[36px] object-cover border-4 border-blue-50 shadow-xl" alt="profile" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[24px] sm:rounded-[36px] transition-all">
              <span className="text-white text-xs font-black">변경</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfileImageChange} />
          </div>

          <div className="text-left space-y-1.5 sm:space-y-2 flex-1">
            {isEditingNickname ? (
              <div className="space-y-2">
                <input value={editNicknameValue} onChange={(e) => { setEditNicknameValue(e.target.value); setNicknameStatus('idle'); }} className="w-full p-2.5 sm:p-3 bg-gray-50 rounded-xl font-black text-left outline-none border border-blue-100 text-sm sm:text-base" autoFocus />
                <div className="flex gap-2">
                  <button type="button" onClick={checkNicknameDuplicate} className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${ nicknameStatus === 'available' ? 'bg-green-500 text-white' : nicknameStatus === 'unavailable' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500' }`}> 중복확인 </button>
                  <button type="button" onClick={handleNicknameUpdate} disabled={nicknameStatus !== 'available'} className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${ nicknameStatus === 'available' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-300 cursor-not-allowed' }`}> 변경 </button>
                  <button type="button" onClick={() => { setIsEditingNickname(false); setEditNicknameValue(effectiveUser.nickname); setNicknameStatus('idle'); }} className="px-2.5 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-[11px] font-black">X</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsEditingNickname(true)} className="group flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors italic whitespace-nowrap">{effectiveUser.nickname}</h2>
                  <span className="text-[14px] opacity-30 group-hover:opacity-100 transition-opacity">✏️</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                   {(() => { const g = getUserGrade(effectiveUser, gradeConfigs); return g ? <span className={`${g.color} text-white text-[10px] font-black px-2 py-0.5 rounded-full italic uppercase tracking-wider`}>{g.name}</span> : null; })()}
                   {(!gradeConfigs.length || !getUserGrade(effectiveUser, gradeConfigs)) && <span className="text-[10px] sm:text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded italic uppercase tracking-widest">Standard</span>}
                   {effectiveUser.sellerStatus === 'approved' && <span className="text-[10px] sm:text-[11px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded italic uppercase tracking-widest">Expert ✓</span>}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* 크레딧 & 쿠폰 가로형식 섹션 */}
        <div className="flex flex-row gap-3 w-full md:min-w-[440px] md:max-w-[520px]">
          {/* 크레딧 */}
          <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-[20px] sm:rounded-[24px] flex-1 overflow-hidden shadow-lg">
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)'}} />
            <div className="relative px-4 sm:px-5 py-3 sm:py-4 flex flex-row items-center justify-between gap-3 h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">💰</span>
                  <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest">크레딧</p>
                  <span className="text-[9px] font-black text-blue-200 bg-blue-500/40 px-2 py-0.5 rounded-full whitespace-nowrap">마케팅 전용</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {(effectiveUser.points || 0).toLocaleString()}
                  </span>
                  <span className="text-blue-200 text-sm font-black">C</span>
                </div>
              </div>
              <Link to="/credit/apply" className="shrink-0 inline-flex items-center gap-1 bg-white text-blue-600 px-3 py-1.5 rounded-xl font-black text-[11px] shadow hover:bg-blue-50 transition-all whitespace-nowrap">
                구매 <span className="text-blue-400">→</span>
              </Link>
            </div>
          </div>

          {/* 쿠폰 */}
          <div className="bg-gray-50 border border-gray-100 rounded-[20px] sm:rounded-[24px] flex-1 shadow-sm">
            <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-row items-center justify-between gap-3 h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🎫</span>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">쿠폰</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-gray-900">
                    {availableCouponCount}
                  </span>
                  <span className="text-gray-400 text-sm font-black">장</span>
                </div>
              </div>
              <Link to="/coupons" className="shrink-0 inline-flex items-center gap-1 bg-gray-900 text-white px-3 py-1.5 rounded-xl font-black text-[11px] hover:bg-blue-600 transition-all whitespace-nowrap">
                내역 <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100/50 p-1.5 sm:p-2 rounded-[20px] sm:rounded-[32px] grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 w-full max-w-5xl mx-auto shadow-inner">
        {[
          { id: 'buyer', label: '🖥️ 구매자 대시보드', color: 'text-blue-600' },
          { id: 'seller', label: '👨‍🏫 판매자 워크스페이스', color: 'text-orange-600' },
          { id: 'freelancer', label: '👷 프리랜서 워크스페이스', color: 'text-emerald-600' },
          { id: 'settings', label: '⚙️ 계정 및 정보 관리', color: 'text-gray-900' }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setActiveMainTab(mode.id as MainTab)}
            className={`flex-1 py-2 sm:py-5 rounded-[16px] sm:rounded-[24px] font-black text-[11px] sm:text-[14px] md:text-[16px] transition-all duration-300 relative leading-snug ${
              activeMainTab === mode.id
              ? 'bg-white shadow-xl scale-[1.02] ' + mode.color
              : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {mode.label}
            {mode.id === 'seller' && effectiveUser.sellerStatus !== 'approved' && <span className="ml-1 opacity-50">🔒</span>}
          </button>
        ))}
      </div>

      <div className="w-full">
        {activeMainTab === 'settings' && (
          <UserInfoSection
            user={accurateEffectiveUser}
            onUpdate={onUpdate}
            forcedTab={settingsSubTab}
            onTabChange={(tab) => setSettingsSubTab(tab as any)}
            expertRegistrationFor={expertRegistrationFor}
            onExpertRegistrationDone={() => setExpertRegistrationFor(null)}
            addNotif={addNotif}
          />
        )}
        {activeMainTab === 'buyer' && <BuyerDashboard user={effectiveUser} members={members} smmOrders={smmOrders} channelOrders={channelOrders} channelProducts={channels} storeOrders={storeOrders} setStoreOrders={setStoreOrders} setChannelOrders={setChannelOrders} ebooks={ebooks} onAddReview={onAddReview} initialSubTab={(location.state as any)?.buyerSubTab} initialSnsSubTab={(location.state as any)?.snsSubTab} />}
        {activeMainTab === 'freelancer' && <FreelancerDashboard user={effectiveUser} onUpdate={onUpdate} onApplyFreelancer={() => goToExpertRegistration('freelancer')} initialSubTab={(location.state as any)?.freelancerSubTab} addNotif={addNotif} />}
        {activeMainTab === 'seller' && (
          <SellerDashboard
            user={effectiveUser}
            members={members}
            ebooks={ebooks}
            setEbooks={setEbooks}
            channels={channels}
            storeOrders={storeOrders}
            smmOrders={smmOrders}
            channelOrders={channelOrders}
            onApplySeller={() => goToExpertRegistration('seller')}
            reviews={reviews}
            onUpdateReview={onUpdateReview}
          />
        )}
      </div>
    </div>
  );
};

export default MyPage;
