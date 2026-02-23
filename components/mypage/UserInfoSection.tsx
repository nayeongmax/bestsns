
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, SellerApplication, NotificationType, FreelancerApplication } from '@/types';
import { supabase, getSupabaseUrl } from '../../supabase';
import { compressImageForStorage } from '@/constants';
import { updateProfile } from '../../profileDb';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Props {
  user: UserProfile;
  onUpdate: (updated: UserProfile) => void;
  forcedTab?: 'profile' | 'expert' | 'notif' | 'pw' | 'quit';
  onTabChange?: (tab: string) => void;
  expertRegistrationFor?: 'seller' | 'freelancer' | null;
  onExpertRegistrationDone?: () => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

type SettingsTab = 'profile' | 'expert' | 'notif' | 'pw' | 'quit';
type SellerType = 'individual' | 'business';

const UserInfoSection: React.FC<Props> = ({ user, onUpdate, forcedTab, onTabChange, expertRegistrationFor, onExpertRegistrationDone, addNotif }) => {
  const { showConfirm, showAlert } = useConfirm();
  const [activeTab, setActiveTab] = useState<SettingsTab>(forcedTab || 'profile');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [showApplySuccessModal, setShowApplySuccessModal] = useState(false);

  // 비밀번호 변경 폼 상태
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  // 휴대폰 번호 수정 (마이페이지 개인정보)
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
    }
  }, [forcedTab]);

  const handleTabClick = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // --- 전문가 정보 폼 상태 ---
  const savedApp = user.sellerApplication;
  const savedFreelancerApp = user.freelancerApplication;
  const [sellerType, setSellerType] = useState<SellerType>(savedApp?.sellerType || 'individual');
  
  const [individualForm, setIndividualForm] = useState({
    email: savedApp?.bankInfo?.email || user.email || '',
    bankName: savedApp?.bankInfo?.bankName || savedFreelancerApp?.bankName || '',
    accountNo: savedApp?.bankInfo?.accountNo || savedFreelancerApp?.accountNo || '',
    ownerName: savedApp?.bankInfo?.ownerName || savedFreelancerApp?.ownerName || user.nickname || '',
    residentNumber: savedApp?.bankInfo?.residentNumber || savedFreelancerApp?.residentNumber || '',
    contact: savedFreelancerApp?.contact || user.phone || ''
  });

  const [businessForm, setBusinessForm] = useState({
    companyName: savedApp?.businessInfo?.companyName || '',
    registrationNo: savedApp?.businessInfo?.registrationNo || '',
    businessType: savedApp?.businessInfo?.businessType || '일반',
    repName: savedApp?.businessInfo?.repName || '',
    location: savedApp?.businessInfo?.location || '',
    taxEmail: savedApp?.bankInfo?.email || user.email || '',
    bankName: savedApp?.bankInfo?.bankName || '',
    accountNo: savedApp?.bankInfo?.accountNo || '',
    ownerName: savedApp?.bankInfo?.ownerName || ''
  });

  const [proofImages, setProofImages] = useState<{bankbook?: string, license?: string}>({
    bankbook: savedApp?.proofs?.bankbookImg,
    license: savedApp?.proofs?.licenseImg
  });

  // DB에 저장된 전문가/개인판매자 정보가 나중에 로드되면 폼에 반영 (저장된 내용이 안 보이던 문제 해결)
  const lastSyncedSellerKey = useRef<string>('');
  useEffect(() => {
    const app = user.sellerApplication;
    const fa = user.freelancerApplication;
    const key = JSON.stringify({ app, fa, e: user.email, n: user.nickname, p: user.phone });
    if (key === lastSyncedSellerKey.current) return;
    lastSyncedSellerKey.current = key;
    setSellerType((app?.sellerType as SellerType) || 'individual');
    setIndividualForm({
      email: app?.bankInfo?.email || user.email || '',
      bankName: app?.bankInfo?.bankName || fa?.bankName || '',
      accountNo: app?.bankInfo?.accountNo || fa?.accountNo || '',
      ownerName: app?.bankInfo?.ownerName || fa?.ownerName || user.nickname || '',
      residentNumber: app?.bankInfo?.residentNumber || fa?.residentNumber || '',
      contact: fa?.contact || user.phone || ''
    });
    setBusinessForm({
      companyName: app?.businessInfo?.companyName || '',
      registrationNo: app?.businessInfo?.registrationNo || '',
      businessType: app?.businessInfo?.businessType || '일반',
      repName: app?.businessInfo?.repName || '',
      location: app?.businessInfo?.location || '',
      taxEmail: app?.bankInfo?.email || user.email || '',
      bankName: app?.bankInfo?.bankName || '',
      accountNo: app?.bankInfo?.accountNo || '',
      ownerName: app?.bankInfo?.ownerName || ''
    });
    setProofImages({
      bankbook: app?.proofs?.bankbookImg,
      license: app?.proofs?.licenseImg
    });
  }, [user.id, user.email, user.nickname, user.phone, user.sellerApplication, user.freelancerApplication]);

  // --- 알림 설정 상태 (로컬 저장) ---
  const notifStorageKey = `user_notif_${user.id}`;
  const [notifMarketing, setNotifMarketing] = useState(() => {
    try {
      const s = localStorage.getItem(notifStorageKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed?.marketing) return parsed.marketing;
      }
    } catch (_) {}
    return { app: true, sms: false, email: false };
  });
  const [notifChat, setNotifChat] = useState(() => {
    try {
      const s = localStorage.getItem(notifStorageKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed?.chat === 'boolean') return parsed.chat;
      }
    } catch (_) {}
    return true;
  });
  const [notifOrderStatus, setNotifOrderStatus] = useState(() => {
    try {
      const s = localStorage.getItem(notifStorageKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed?.orderStatus === 'boolean') return parsed.orderStatus;
      }
    } catch (_) {}
    return true;
  });
  const [isProfilePublic, setIsProfilePublic] = useState(() => {
    try {
      const s = localStorage.getItem(notifStorageKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed?.profilePublic === 'boolean') return parsed.profilePublic;
      }
    } catch (_) {}
    return true;
  });
  useEffect(() => {
    localStorage.setItem(notifStorageKey, JSON.stringify({
      marketing: notifMarketing,
      chat: notifChat,
      orderStatus: notifOrderStatus,
      profilePublic: isProfilePublic
    }));
  }, [notifStorageKey, notifMarketing, notifChat, notifOrderStatus, isProfilePublic]);

  // --- 탈퇴 관련 상태 ---
  const [quitReason, setQuitReason] = useState('');
  const [quitEmail, setQuitEmail] = useState('');
  const [quitAgreed, setQuitAgreed] = useState(false);

  const isExpertFormChanged = useMemo(() => {
    if (sellerType === 'individual') {
      const base =
        individualForm.email !== (savedApp?.bankInfo?.email || user.email || '') ||
        individualForm.bankName !== (savedApp?.bankInfo?.bankName || savedFreelancerApp?.bankName || '') ||
        individualForm.accountNo !== (savedApp?.bankInfo?.accountNo || savedFreelancerApp?.accountNo || '') ||
        individualForm.ownerName !== (savedApp?.bankInfo?.ownerName || savedFreelancerApp?.ownerName || user.nickname || '') ||
        proofImages.bankbook !== savedApp?.proofs?.bankbookImg;
      if (expertRegistrationFor === 'freelancer') {
        return base || individualForm.residentNumber !== (savedFreelancerApp?.residentNumber || '') || individualForm.contact !== (savedFreelancerApp?.contact || user.phone || '');
      }
      return base;
    } else {
      return (
        businessForm.companyName !== (savedApp?.businessInfo?.companyName || '') ||
        businessForm.registrationNo !== (savedApp?.businessInfo?.registrationNo || '') ||
        businessForm.businessType !== (savedApp?.businessInfo?.businessType || '일반') ||
        proofImages.bankbook !== savedApp?.proofs?.bankbookImg ||
        proofImages.license !== savedApp?.proofs?.licenseImg ||
        businessForm.bankName !== (savedApp?.bankInfo?.bankName || '') ||
        businessForm.accountNo !== (savedApp?.bankInfo?.accountNo || '') ||
        businessForm.ownerName !== (savedApp?.bankInfo?.ownerName || '')
      );
    }
  }, [individualForm, businessForm, sellerType, savedApp, proofImages, user]);

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'bankbook' | 'license') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result as string;
      try {
        const compressed = await compressImageForStorage(raw);
        setProofImages(prev => ({ ...prev, [type]: compressed }));
      } catch {
        setProofImages(prev => ({ ...prev, [type]: raw }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCertificationRequest = async () => {
    if (expertRegistrationFor === 'freelancer') {
      if (sellerType === 'individual') {
        if (!individualForm.bankName?.trim() || !individualForm.accountNo?.trim() || !individualForm.ownerName?.trim()) {
          return void showAlert({ description: '은행명, 계좌번호, 예금주를 모두 입력해 주세요.' });
        }
        if (!individualForm.residentNumber?.trim()) {
          return void showAlert({ description: '주민등록번호를 입력해 주세요.' });
        }
        if (!proofImages.bankbook) {
          return void showAlert({ description: '통장 사본 이미지를 등록해 주세요.' });
        }
      } else {
        if (!businessForm.bankName?.trim() || !businessForm.accountNo?.trim() || !businessForm.ownerName?.trim()) {
          return void showAlert({ description: '은행명, 계좌번호, 예금주를 모두 입력해 주세요.' });
        }
        if (!proofImages.bankbook) return void showAlert({ description: '통장 사본 이미지를 등록해 주세요.' });
      }
      showConfirm({
      title: '프리랜서 등록 신청',
      description: '프리랜서 등록 신청을 제출하시겠습니까? 운영자 승인 후 누구나알바에 신청할 수 있습니다.',
      confirmLabel: '제출하기',
      cancelLabel: '취소',
      danger: false,
      onConfirm: () => doSubmitFreelancer(),
    });
    return;
  }
  async function doSubmitFreelancer() {
      const freelancerApp: FreelancerApplication = {
        appliedAt: new Date().toISOString(),
        name: sellerType === 'individual' ? individualForm.ownerName : businessForm.ownerName,
        contact: (sellerType === 'individual' ? individualForm.contact || individualForm.email : businessForm.taxEmail) || '',
        residentNumber: sellerType === 'individual' ? individualForm.residentNumber : '',
        bankName: sellerType === 'individual' ? individualForm.bankName : businessForm.bankName,
        accountNo: sellerType === 'individual' ? individualForm.accountNo : businessForm.accountNo,
        ownerName: sellerType === 'individual' ? individualForm.ownerName : businessForm.ownerName,
        bankbookImage: proofImages.bankbook,
      };
      try {
        await onUpdate({ ...user, freelancerStatus: 'pending', freelancerApplication: freelancerApp });
        await updateProfile(user.id, { freelancerStatus: 'pending', freelancerApplication: freelancerApp });
        setShowApplySuccessModal(true);
        onExpertRegistrationDone?.();
        showAlert({ description: '프리랜서 등록 신청이 완료되었습니다.\n운영자 승인 후 누구나알바에 신청할 수 있습니다.' });
      } catch (_) {}
      return;
    }

    if (sellerType === 'individual' && (!individualForm.bankName || !individualForm.accountNo || !proofImages.bankbook)) {
      return void showAlert({ description: '정산 계좌 정보와 통장 사본 이미지를 모두 등록해 주세요.' });
    }
    if (sellerType === 'business' && (!businessForm.registrationNo || !proofImages.license)) {
      return void showAlert({ description: '사업자 등록 정보와 사업자 등록증 이미지를 모두 등록해 주세요.' });
    }

    const newApp: SellerApplication = {
      sellerType,
      appliedAt: savedApp?.appliedAt || new Date().toISOString(),
      bankInfo: sellerType === 'individual' ? { 
        email: individualForm.email, 
        bankName: individualForm.bankName, 
        accountNo: individualForm.accountNo, 
        ownerName: individualForm.ownerName,
        residentNumber: individualForm.residentNumber || undefined
      } : { 
        bankName: businessForm.bankName, 
        accountNo: businessForm.accountNo, 
        ownerName: businessForm.ownerName, 
        email: businessForm.taxEmail 
      },
      businessInfo: sellerType === 'business' ? {
        companyName: businessForm.companyName,
        registrationNo: businessForm.registrationNo,
        businessType: businessForm.businessType,
        repName: businessForm.repName,
        location: businessForm.location
      } : undefined,
      proofs: {
        bankbookImg: proofImages.bankbook,
        licenseImg: proofImages.license
      }
    };
    
    if (user.sellerStatus === 'approved') {
      onUpdate({ ...user, sellerApplication: newApp });
      updateProfile(user.id, { sellerApplication: newApp }).catch((e) => console.warn('전문가 정보 DB 반영 실패:', e));
      showAlert({ description: '전문가 정보가 성공적으로 수정되었습니다.' });
    } else {
      if (user.sellerStatus === 'none') {
      showConfirm({
        title: '전문가 등록 제출',
        description: '전문가 정보에서 수익화할 내용을 작성하고, 운영자 승인을 받아야 합니다.\n제출하시겠습니까?',
        confirmLabel: '제출하기',
        cancelLabel: '취소',
        danger: false,
        onConfirm: () => submitSellerApp(),
      });
      return;
    }
    submitSellerApp();
  }
  async function submitSellerApp() {
    try {
      await onUpdate({ ...user, sellerStatus: 'pending', sellerApplication: newApp });
      await updateProfile(user.id, { sellerStatus: 'pending', sellerApplication: newApp });
      setShowApplySuccessModal(true);
    } catch (_) {
      // 저장 실패 시 App에서 이미 alert 함, 모달은 띄우지 않음
    }
  }
  };

  const handleQuit = async () => {
    if (!quitReason || quitEmail !== user.email || !quitAgreed) return;
    showConfirm({
      title: '회원 탈퇴',
      description: '정말 탈퇴하시겠습니까? 로그인 정보가 삭제되며 복구할 수 없습니다.',
      dangerLine: '삭제 후에는 복구할 수 없습니다.',
      confirmLabel: '탈퇴하기',
      cancelLabel: '취소',
      danger: true,
      onConfirm: async () => {
    const supabaseUrl = getSupabaseUrl();
    const { data: { session } } = await supabase.auth.getSession();
    if (supabaseUrl && session?.access_token) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          localStorage.removeItem('user_profile_v2');
          window.location.href = '/';
          return;
        }
      } catch (_) {
        // Edge Function 미배포/연결 실패 시에도 프로필 삭제 + 로그아웃으로 탈퇴 완료 처리
      }
    }
    await supabase.auth.signOut();
    try {
      await supabase.from('profiles').delete().eq('id', user.id);
    } catch (_) {}
    localStorage.removeItem('user_profile_v2');
    showAlert({ description: '탈퇴가 완료되었습니다.' });
    setTimeout(() => { window.location.href = '/'; }, 1200);
      },
    });
  };

  const handlePhoneSave = async () => {
    const value = (editingPhone ?? (user.phone || '')).trim();
    setSavingPhone(true);
    try {
      await updateProfile(user.id, { phone: value || '' });
      onUpdate({ ...user, phone: value || undefined });
      setEditingPhone(null);
      showAlert({ description: '휴대폰 번호가 저장되었습니다.' });
    } catch (e) {
      showAlert({ description: '저장에 실패했습니다. 다시 시도해 주세요.' });
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return void showAlert({ description: '모든 정보를 입력해 주세요.' });
    if (pwForm.next !== pwForm.confirm) return void showAlert({ description: '새 비밀번호가 일치하지 않습니다.' });
    if (pwForm.next.length < 8) return void showAlert({ description: '새 비밀번호는 8자 이상이어야 합니다.' });
    const email = user.email || (await supabase.auth.getUser()).data.user?.email;
    if (!email) return void showAlert({ description: '이메일 정보가 없어 비밀번호 변경을 할 수 없습니다.' });
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pwForm.current });
    if (signInErr) {
      showAlert({ description: '현재 비밀번호가 올바르지 않습니다.' });
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.next });
    if (updateErr) {
      showAlert({ description: '비밀번호 변경에 실패했습니다. ' + (updateErr.message || '') });
      return;
    }
    showAlert({ description: '비밀번호가 성공적으로 변경되었습니다.' });
    setPwForm({ current: '', next: '', confirm: '' });
  };

  const ToggleSwitch = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
    <div onClick={onClick} className={`w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner ${active ? 'bg-gray-900' : 'bg-gray-200'}`}>
      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 flex items-center justify-center shadow-md ${active ? 'left-7' : 'left-1'}`}>
        {active && <span className="text-[10px] text-gray-900 font-black">✓</span>}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-[56px] shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="flex border-b border-gray-50 overflow-x-auto no-scrollbar">
        {[ 
          { id: 'profile', label: '개인정보' }, 
          { id: 'expert', label: '전문가 정보' }, 
          { id: 'notif', label: '알림 설정' }, 
          { id: 'pw', label: '비밀번호 변경' }, 
          { id: 'quit', label: '회원 탈퇴' } 
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => handleTabClick(tab.id as SettingsTab)} 
            className={`flex-1 min-w-[100px] py-7 text-[15px] font-black transition-all ${activeTab === tab.id ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-8 lg:p-16">
        {/* 개인정보 관리 */}
        {activeTab === 'profile' && (
          <div className="space-y-16 animate-in fade-in duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                <div className="space-y-10">
                   <h4 className="text-[20px] font-black text-gray-900 italic">본인인증 및 연락처 관리</h4>
                   <div className="space-y-8">
                      <div className="space-y-3">
                         <div className="flex justify-between items-center px-2"><label className="text-[13px] font-bold text-gray-400 italic">이름</label><span className="text-[11px] font-black text-green-500">✓ 가입 정보</span></div>
                         <input value={user.nickname || '등록된 이름 없음'} readOnly className="w-full p-5 bg-gray-50 rounded-2xl font-black text-[15px] text-gray-700 shadow-inner outline-none" />
                         <p className="text-[11px] text-blue-500 font-bold px-2 leading-relaxed italic">* 회원가입 또는 소셜 로그인 시 연동된 이름입니다.</p>
                      </div>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center px-2"><label className="text-[13px] font-bold text-gray-400 italic">휴대폰 번호</label><span className="text-[11px] font-black text-green-500">✓ 가입 정보</span></div>
                         <div className="flex gap-3">
                           <input value={editingPhone ?? (user.phone || '')} onChange={e => setEditingPhone(e.target.value)} placeholder="등록된 번호 없음" className="flex-1 p-5 bg-gray-50 rounded-2xl font-black text-[15px] text-gray-700 shadow-inner outline-none focus:ring-2 focus:ring-blue-200" />
                           <button onClick={handlePhoneSave} disabled={savingPhone || (editingPhone ?? (user.phone || '')) === (user.phone || '')} className="px-8 py-5 border border-gray-200 rounded-2xl font-black text-[15px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">저장</button>
                         </div>
                         <p className="text-[11px] text-blue-500 font-bold px-2 leading-relaxed italic">* 가입 시 입력하신 번호입니다. 주문 및 채팅 알림 시 사용됩니다.</p>
                      </div>
                      <div className="space-y-3 pt-4">
                         <div className="flex justify-between items-center px-2"><label className="text-[13px] font-bold text-gray-400 italic">이메일 계정</label><span className="text-[11px] font-black text-green-500">✓ 가입 정보</span></div>
                         <div className="flex gap-3">
                           <input value={user.email || '등록된 이메일 없음'} readOnly className="flex-1 p-5 bg-gray-50 rounded-2xl font-black text-[15px] text-gray-700 shadow-inner outline-none" />
                           <button onClick={() => showAlert({ description: '계정 변경 기능은 준비 중입니다.' })} className="px-8 py-5 border border-gray-200 rounded-2xl font-black text-[15px] text-gray-400 hover:bg-gray-50 transition-colors">계정변경</button>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-10">
                   <h4 className="text-[20px] font-black text-gray-900 italic">회원 상태 및 등급</h4>
                   <div className="space-y-6">
                      <div className="p-8 bg-[#F4F9FF] rounded-[32px] border-l-[6px] border-blue-500 space-y-4">
                         <div className="flex justify-between items-center">
                            <h5 className="font-black text-blue-900 text-[18px]">회원 등급: {user.manualGrade || 'Standard'}</h5>
                            <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full italic">LIVE</span>
                         </div>
                         <p className="text-[13.5px] text-blue-700 font-bold leading-relaxed">
                            {user.nickname}님은 현재 THEBESTSNS의 소중한 {user.role === 'admin' ? '관리자' : '회원'}님이십니다.
                            가입일: {user.joinDate || '정보 없음'}
                         </p>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-[24px] space-y-2">
                         <p className="text-[12px] font-bold text-gray-500">누적 구매: ₩{(user.totalPurchaseAmount || 0).toLocaleString()}</p>
                         <p className="text-[12px] font-bold text-gray-500">누적 판매: ₩{(user.totalSalesAmount || 0).toLocaleString()}</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* 전문가 정보 */}
        {activeTab === 'expert' && (
          <div className="space-y-12 animate-in fade-in duration-300 relative pb-20">
             <div className="flex justify-center mb-10">
                <div className="inline-flex p-1.5 bg-gray-100 rounded-full shadow-inner">
                   <button onClick={() => setSellerType('individual')} className={`px-10 py-3 rounded-full text-[14px] font-black transition-all ${sellerType === 'individual' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}>개인 판매자</button>
                   <button onClick={() => setSellerType('business')} className={`px-10 py-3 rounded-full text-[14px] font-black transition-all ${sellerType === 'business' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}>사업 판매자</button>
                </div>
             </div>
             {sellerType === 'individual' ? (
               <div className="space-y-12">
                  <div className="bg-gray-50/50 border border-gray-100 rounded-[40px] p-10 space-y-10 shadow-inner">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-2">
                           <label className="text-[12px] font-bold text-gray-400 italic px-2">수익금 정산 알림 이메일</label>
                           <input value={individualForm.email} onChange={e => setIndividualForm({...individualForm, email: e.target.value})} placeholder="email@example.com" className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[12px] font-bold text-gray-400 italic px-2">수익금 정산 은행</label>
                           <input value={individualForm.bankName} onChange={e => setIndividualForm({...individualForm, bankName: e.target.value})} placeholder="은행명을 직접 입력하세요" className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[12px] font-bold text-gray-400 italic px-2">계좌번호</label>
                           <input value={individualForm.accountNo} onChange={e => setIndividualForm({...individualForm, accountNo: e.target.value})} placeholder="'-' 제외하고 숫자만 입력" className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[12px] font-bold text-gray-400 italic px-2">예금주명</label>
                           <input value={individualForm.ownerName} onChange={e => setIndividualForm({...individualForm, ownerName: e.target.value})} className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                        </div>
                        {sellerType === 'individual' && (
                          <>
                            <div className="space-y-2">
                              <label className="text-[12px] font-bold text-gray-400 italic px-2">주민등록번호</label>
                              <input value={individualForm.residentNumber} onChange={e => setIndividualForm({...individualForm, residentNumber: e.target.value})} placeholder="000000-0000000" className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                            </div>
                            {(expertRegistrationFor === 'freelancer' || !!user.freelancerApplication) && (
                              <div className="space-y-2">
                                <label className="text-[12px] font-bold text-gray-400 italic px-2">연락처 (급할 때 연락)</label>
                                <input value={individualForm.contact} onChange={e => setIndividualForm({...individualForm, contact: e.target.value})} placeholder="010-0000-0000" className="w-full p-5 bg-white border border-gray-100 rounded-2xl font-bold text-[15px] outline-none shadow-sm focus:border-blue-400 transition-all" />
                              </div>
                            )}
                          </>
                        )}
                     </div>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[18px] font-black text-gray-900 italic">증빙자료 등록 (통장 사본)</h4>
                     <div className="border-2 border-dashed border-gray-200 rounded-[32px] p-10 flex items-center justify-between bg-white group hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-6">
                           {proofImages.bankbook ? (
                             <img 
                               src={proofImages.bankbook} 
                               onClick={() => setZoomImage(proofImages.bankbook!)}
                               className="w-20 h-20 rounded-xl object-cover border border-gray-100 shadow-md cursor-zoom-in hover:scale-105 transition-transform" 
                               alt="bankbook" 
                             />
                           ) : (
                             <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">🏦</div>
                           )}
                           <div className="space-y-1">
                              <p className="text-gray-900 font-black text-[15px]">{proofImages.bankbook ? '통장 사본 업로드됨' : '파일을 선택해 주세요'}</p>
                              <p className="text-gray-400 text-xs font-bold italic">이미지 파일 (JPG, PNG) 권장</p>
                           </div>
                        </div>
                        <label className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-600 transition-all cursor-pointer">
                           파일 찾기
                           <input type="file" className="hidden" accept="image/*" onChange={e => handleProofUpload(e, 'bankbook')} />
                        </label>
                     </div>
                  </div>
               </div>
             ) : (
               <div className="space-y-16">
                  <div className="space-y-8">
                     <h4 className="text-[18px] font-black text-gray-900 italic underline decoration-blue-500 underline-offset-8">사업자 정보</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">상호</label><input value={businessForm.companyName} onChange={e => setBusinessForm({...businessForm, companyName: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">사업자등록번호</label><input value={businessForm.registrationNo} onChange={e => setBusinessForm({...businessForm, registrationNo: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="space-y-2">
                           <label className="text-[12px] font-bold text-gray-400 italic px-2">사업자 유형</label>
                           <select value={businessForm.businessType} onChange={e => setBusinessForm({...businessForm, businessType: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-black outline-none appearance-none">
                              <option value="개인">개인</option><option value="법인">법인</option><option value="간이">간이</option>
                           </select>
                        </div>
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">대표자명</label><input value={businessForm.repName} onChange={e => setBusinessForm({...businessForm, repName: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="md:col-span-2 space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">사업장 소재지</label><input value={businessForm.location} onChange={e => setBusinessForm({...businessForm, location: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                     </div>
                  </div>
                  <div className="space-y-8">
                     <h4 className="text-[18px] font-black text-gray-900 italic underline decoration-blue-500 underline-offset-8">정산 및 계좌 정보</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">정산 이메일</label><input value={businessForm.taxEmail} onChange={e => setBusinessForm({...businessForm, taxEmail: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">은행명</label><input value={businessForm.bankName} onChange={e => setBusinessForm({...businessForm, bankName: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">계좌번호</label><input value={businessForm.accountNo} onChange={e => setBusinessForm({...businessForm, accountNo: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                        <div className="space-y-2"><label className="text-[12px] font-bold text-gray-400 italic px-2">예금주</label><input value={businessForm.ownerName} onChange={e => setBusinessForm({...businessForm, ownerName: e.target.value})} className="w-full p-5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold outline-none" /></div>
                     </div>
                  </div>
                  <div className="space-y-8">
                     <h4 className="text-[18px] font-black text-gray-900 italic underline decoration-blue-500 underline-offset-8">증빙자료 등록</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                           <label className="text-[12px] font-black text-gray-400 italic px-2 uppercase">사업자등록증</label>
                           <div className="border-2 border-dashed border-gray-200 rounded-[32px] p-6 bg-white flex flex-col items-center gap-4 group hover:border-blue-200 transition-all min-h-[220px] justify-center">
                              {proofImages.license ? (
                                <img src={proofImages.license} onClick={() => setZoomImage(proofImages.license!)} className="w-full h-32 object-cover rounded-xl shadow-md cursor-zoom-in" alt="license" />
                              ) : (
                                <span className="text-4xl">📄</span>
                              )}
                              <label className="w-full py-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-xs text-gray-500 hover:bg-blue-600 hover:text-white transition-all text-center cursor-pointer">
                                 {proofImages.license ? '이미지 변경' : '파일 선택'}
                                 <input type="file" className="hidden" accept="image/*" onChange={e => handleProofUpload(e, 'license')} />
                              </label>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <label className="text-[12px] font-black text-gray-400 italic px-2 uppercase">통장 사본</label>
                           <div className="border-2 border-dashed border-gray-200 rounded-[32px] p-6 bg-white flex flex-col items-center gap-4 group hover:border-blue-200 transition-all min-h-[220px] justify-center">
                              {proofImages.bankbook ? (
                                <img src={proofImages.bankbook} onClick={() => setZoomImage(proofImages.bankbook!)} className="w-full h-32 object-cover rounded-xl shadow-md cursor-zoom-in" alt="bankbook" />
                              ) : (
                                <span className="text-4xl">🏦</span>
                              )}
                              <label className="w-full py-3 bg-gray-50 border border-gray-100 rounded-xl font-black text-xs text-gray-500 hover:bg-blue-600 hover:text-white transition-all text-center cursor-pointer">
                                 {proofImages.bankbook ? '이미지 변경' : '파일 선택'}
                                 <input type="file" className="hidden" accept="image/*" onChange={e => handleProofUpload(e, 'bankbook')} />
                              </label>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
             )}
             <div className="flex justify-end pt-10">
                <button 
                  onClick={handleCertificationRequest} 
                  disabled={
                    expertRegistrationFor === 'freelancer' 
                      ? (user.freelancerStatus === 'pending' || (!isExpertFormChanged && user.freelancerStatus !== 'approved'))
                      : (!isExpertFormChanged && user.sellerStatus !== 'none')
                  } 
                  className={`px-12 py-5 rounded-[48px] font-black text-[18px] shadow-2xl transition-all italic ${
                    expertRegistrationFor === 'freelancer'
                      ? (isExpertFormChanged || user.freelancerStatus === 'approved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-[#E4E8ED] text-gray-400 cursor-default')
                      : (isExpertFormChanged || user.sellerStatus === 'approved' ? 'bg-blue-600 text-white hover:bg-black' : 'bg-[#E4E8ED] text-gray-400 cursor-default')
                  }`}
                >
                  {expertRegistrationFor === 'freelancer' 
                    ? (user.freelancerStatus === 'approved' ? '프리랜서 정보 수정하기' : user.freelancerStatus === 'pending' ? '인증 심사 중...' : '프리랜서 정보 인증 요청')
                    : (user.sellerStatus === 'approved' ? '전문가 정보 수정하기' : user.sellerStatus === 'pending' ? '인증 심사 중...' : '판매자 정보 인증 요청')
                  }
                </button>
             </div>
          </div>
        )}

        {/* 알림 설정 */}
        {activeTab === 'notif' && (
          <div className="animate-in fade-in duration-300 space-y-16">
             <div className="space-y-10">
                <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                   <h4 className="text-[20px] font-black text-gray-900">마케팅 혜택 알림 설정</h4>
                   <div className="flex gap-12 text-[13px] font-black text-gray-400 italic">
                      <span className="w-14 text-center">앱 알림</span><span className="w-14 text-center">SMS</span><span className="w-14 text-center">이메일</span>
                   </div>
                </div>
                <div className="flex items-center justify-between">
                   <div className="space-y-1.5 flex-1 pr-10">
                      <p className="font-black text-gray-800 text-[16px]">이벤트·쿠폰 등의 할인 혜택 알림</p>
                      <p className="text-[13.5px] text-gray-400 font-bold leading-relaxed">계정보안, 주문, 약관변경, 공지 등과 관련된 중요 정보는 혜택 알림 수신 동의와 상관없이 발송돼요.</p>
                   </div>
                   <div className="flex gap-12 shrink-0">
                      <ToggleSwitch active={notifMarketing.app} onClick={() => setNotifMarketing({...notifMarketing, app: !notifMarketing.app})} />
                      <ToggleSwitch active={notifMarketing.sms} onClick={() => setNotifMarketing({...notifMarketing, sms: !notifMarketing.sms})} />
                      <ToggleSwitch active={notifMarketing.email} onClick={() => setNotifMarketing({...notifMarketing, email: !notifMarketing.email})} />
                   </div>
                </div>
             </div>
             <div className="pt-10 border-t border-gray-100 space-y-10">
                <h4 className="text-[20px] font-black text-gray-900">서비스 및 공개 설정</h4>
                <div className="space-y-8">
                   {[
                     { label: '실시간 채팅 알림', desc: '새로운 메시지가 도착하면 카카오톡으로 실시간 알림을 받습니다.', state: notifChat, onClick: () => setNotifChat(!notifChat) },
                     { label: '주문/결제 상태 알림', desc: '내 주문 건의 진행 상태 변화를 카카오톡으로 즉시 확인합니다.', state: notifOrderStatus, onClick: () => setNotifOrderStatus(!notifOrderStatus) },
                     { label: '프로필 공개', desc: '다른 사용자에게 내 활동 프로필 정보를 공개합니다.', state: isProfilePublic, onClick: () => setIsProfilePublic(!isProfilePublic) },
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between bg-gray-50/50 p-6 rounded-[32px] border border-gray-100">
                        <div className="space-y-1">
                          <p className="font-black text-gray-800 text-[15.5px]">{item.label}</p>
                          <p className="text-[13px] text-gray-400 font-bold">{item.desc}</p>
                        </div>
                        <ToggleSwitch active={item.state} onClick={item.onClick} />
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* 비밀번호 변경 */}
        {activeTab === 'pw' && (
          <div className="max-w-xl space-y-10 animate-in fade-in duration-300">
             <h4 className="text-[18px] font-black text-gray-900 italic">비밀번호 변경</h4>
             <div className="space-y-6">
                <input type="password" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} placeholder="현재 비밀번호" className="w-full p-6 bg-gray-50 rounded-[24px] font-black text-[15px] shadow-inner outline-none" />
                <input type="password" value={pwForm.next} onChange={e => setPwForm({...pwForm, next: e.target.value})} placeholder="새 비밀번호" className="w-full p-6 bg-gray-50 rounded-[24px] font-black text-[15px] shadow-inner outline-none" />
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} placeholder="새 비밀번호 확인" className="w-full p-6 bg-gray-50 rounded-[24px] font-black text-[15px] shadow-inner outline-none" />
             </div>
             <button onClick={handlePasswordUpdate} className="w-full py-6 bg-gray-900 text-white rounded-[32px] font-black text-[17px] shadow-lg hover:bg-black transition-all">비밀번호 업데이트</button>
          </div>
        )}

        {/* 회원 탈퇴 */}
        {activeTab === 'quit' && (
          <div className="animate-in fade-in duration-300 space-y-12">
             <div className="space-y-8">
                <h4 className="text-[20px] font-black text-gray-900">THEBESTSNS를 떠나는 이유를 알려주세요.</h4>
                <div className="space-y-4">
                   {[ '이용하고 싶은 서비스가 없어요', '서비스 퀄리티가 낮아요', '비매너 회원을 만났어요', '잦은 오류가 발생해요', '대체할 만한 서비스를 찾았어요', '쿠폰·적립금 등 혜택이 적어요', '기타' ].map((reason, idx) => (
                     <label key={idx} className="flex items-center gap-4 cursor-pointer group">
                        <input type="radio" name="quit_reason" className="sr-only" value={reason} checked={quitReason === reason} onChange={(e) => setQuitReason(e.target.value)} />
                        <div className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${quitReason === reason ? 'border-blue-600' : 'border-gray-200 group-hover:border-gray-400'}`}>
                           {quitReason === reason && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                        </div>
                        <span className={`text-[15px] font-bold ${quitReason === reason ? 'text-gray-900' : 'text-gray-500'}`}>{reason}</span>
                     </label>
                   ))}
                </div>
             </div>
             <div className="space-y-4">
                <h4 className="text-[15px] font-black text-gray-900">이메일 확인</h4>
                <input type="email" value={quitEmail} onChange={(e) => setQuitEmail(e.target.value)} placeholder="가입하신 이메일을 적어주세요" className="w-full p-5 bg-white border border-gray-200 rounded-xl font-bold text-[15px] outline-none shadow-sm focus:border-gray-400 transition-all" />
             </div>
             <div className="bg-[#f7f8fa] p-10 rounded-[16px] space-y-6 shadow-inner">
                <ul className="space-y-4 text-[13.5px] font-bold text-gray-500 leading-relaxed list-none">
                   <li className="flex items-start gap-2">• 현재 사용중인 계정 정보는 회원 탈퇴 후 복구가 불가합니다.</li>
                   <li className="flex items-start gap-2 text-red-500 font-black">• 진행 중인 거래건이 있거나 패널티 조치 중인 경우 탈퇴 신청이 불가합니다.</li>
                   <li className="flex items-start gap-2">• 탈퇴 후 회원님의 정보는 전자상거래 소비자보호법에 의거한 THEBESTSNS 개인정보처리방침에 따라 관리됩니다.</li>
                   <li className="flex items-start gap-2">• 현재 보유 중인 쿠폰 및 THEBESTSNS 포인트는 모두 자동 소멸됩니다.</li>
                </ul>
             </div>
             <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                   <input type="checkbox" checked={quitAgreed} onChange={(e) => setQuitAgreed(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-50" />
                   <span className="text-[15px] font-bold text-gray-600 group-hover:text-gray-900">주의사항을 모두 확인하였습니다.</span>
                </label>
                <button onClick={handleQuit} disabled={!(quitReason && quitEmail === user.email && quitAgreed)} className={`px-12 py-4 rounded-[8px] font-black text-[15px] transition-all border ${ (quitReason && quitEmail === user.email && quitAgreed) ? 'bg-gray-900 text-white hover:bg-black border-gray-900 shadow-lg' : 'bg-white text-gray-300 border-gray-200 cursor-not-allowed' }`}>회원 탈퇴</button>
             </div>
          </div>
        )}
      </div>

      {/* --- 판매자 신청 완료 모달 --- */}
      {showApplySuccessModal && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 md:p-12 shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-300 border-4 border-blue-50">
             <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner">📄</div>
             <div className="space-y-3">
                <h3 className="text-2xl font-black text-gray-900 italic">인증 요청 완료</h3>
                <p className="text-[15px] font-bold text-gray-500 leading-relaxed">
                   정보 일치 확인 후 판매자 승인됩니다.<br/>
                   <span className="text-blue-600">잠시만 기다려주세요.</span>
                </p>
             </div>
             <button 
               onClick={() => { setShowApplySuccessModal(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
               className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-600 transition-all active:scale-95 uppercase italic tracking-widest"
             >
                확인
             </button>
          </div>
        </div>
      )}

      {zoomImage && <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-10 cursor-pointer animate-in fade-in" onClick={() => setZoomImage(null)}><img src={zoomImage} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain animate-in zoom-in-95" alt="Zoom" /></div>}
    </div>
  );
};

export default UserInfoSection;
