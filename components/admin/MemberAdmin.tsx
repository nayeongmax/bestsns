import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, SiteNotification, SellerApplication, SMMOrder, EbookProduct, ChannelProduct, StoreOrder, GradeConfig, ChannelOrder, getUserGrade, Review, NotificationType } from '@/types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { fetchFreelancerBalance } from '../../parttimeDb';
import MyPage from '@/pages/MyPage';

interface Props {
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  channels: ChannelProduct[];
  gradeConfigs: GradeConfig[];
  setGradeConfigs: React.Dispatch<React.SetStateAction<GradeConfig[]>>;
  reviews?: Review[];
  setReviews?: React.Dispatch<React.SetStateAction<Review[]>>;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  currentUser?: UserProfile | null;
  onUpdateUser?: (u: UserProfile) => void;
  /** 회원 목록(profiles) DB에서 다시 불러오기 — 프리랜서 승인 대기 누락 방지 */
  onRefreshMembers?: () => void;
}

type SortKey = 'none' | 'purchase' | 'sales' | 'violations' | 'points' | 'join';

const DEFAULT_GRADE_CONFIGS: GradeConfig[] = [
  { id: 'g1', name: 'STANDARD', target: 'both', minSales: 0, minPurchase: 0, color: 'bg-gray-400', sortOrder: 0 },
  { id: 'g2', name: 'Prime', target: 'seller', minSales: 10000000, minPurchase: 0, color: 'bg-amber-500', sortOrder: 10 },
  { id: 'g3', name: 'MASTER', target: 'seller', minSales: 50000000, minPurchase: 0, color: 'bg-gray-900', sortOrder: 20 },
];

const MemberAdmin: React.FC<Props> = ({ members, setMembers, setNotifications, smmOrders, channelOrders, storeOrders, ebooks, setEbooks, channels, gradeConfigs, setGradeConfigs, reviews = [], setReviews, addNotif = (..._args: unknown[]) => {}, currentUser, onUpdateUser, onRefreshMembers }) => {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'seller' | 'freelancer' | 'grades'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'buyer' | 'seller' | 'freelancer'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [freelancerBalances, setFreelancerBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (members.length === 0) return;
    Promise.all(
      members.map(m => fetchFreelancerBalance(m.id).then(bal => ({ id: m.id, bal })).catch(() => ({ id: m.id, bal: 0 })))
    ).then(results => {
      const map: Record<string, number> = {};
      results.forEach(r => { map[r.id] = r.bal; });
      setFreelancerBalances(map);
    });
  }, [members]);

  const resolveGrade = (m: UserProfile) => getUserGrade(m, gradeConfigs);

  const filteredMembers = useMemo(() => {
    let result = members.filter(m => 
      (m.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (userTypeFilter === 'buyer') {
      result = result.filter(m => m.sellerStatus !== 'approved' && m.freelancerStatus !== 'approved');
    } else if (userTypeFilter === 'seller') {
      result = result.filter(m => m.sellerStatus === 'approved');
    } else if (userTypeFilter === 'freelancer') {
      result = result.filter(m => m.freelancerStatus === 'approved');
    }

    if (sortKey === 'purchase') result.sort((a, b) => (b.totalPurchaseAmount || 0) - (a.totalPurchaseAmount || 0));
    else if (sortKey === 'sales') result.sort((a, b) => (b.totalSalesAmount || 0) - (a.totalSalesAmount || 0));
    else if (sortKey === 'violations') result.sort((a, b) => (b.violationCount || 0) - (a.violationCount || 0));
    else if (sortKey === 'points') result.sort((a, b) => (b.points || 0) - (a.points || 0));
    else if (sortKey === 'join') result.sort((a, b) => new Date(b.joinDate || '').getTime() - new Date(a.joinDate || '').getTime());

    return result;
  }, [members, searchQuery, userTypeFilter, sortKey]);

  const pendingRequests = useMemo(() => 
    members.filter(m => m.sellerStatus === 'pending' || !!m.pendingApplication), 
  [members]);

  // 프리랜서 승인 대기: pending 또는 신청서 있으나 미승인(누락 방지)
  const pendingFreelancers = useMemo(() => 
    members.filter(m => m.freelancerStatus === 'pending' || (!!m.freelancerApplication && m.freelancerStatus !== 'approved')), 
  [members]);

  const handleApproveFreelancer = async (userId: string) => {
    const updated = members.find(m => m.id === userId);
    if (!updated) return;
    const approvedProfile = { ...updated, freelancerStatus: 'approved' as const };
    setMembers(prev => prev.map(m => m.id === userId ? approvedProfile : m));
    addNotif(userId, 'approval', '프리랜서 승인', '프리랜서 등록이 승인되었습니다. 누구나알바에 신청할 수 있습니다.');
    if (currentUser?.id === userId && onUpdateUser) onUpdateUser(approvedProfile);
    try {
      await supabase.from('profiles').update({
        freelancer_status: 'approved',
        freelancer_application: updated.freelancerApplication ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      alert('프리랜서 승인이 완료되었습니다. DB에 반영되어 쿠키/새로고침 후에도 유지됩니다.');
    } catch (err) {
      console.error('프리랜서 승인 DB 반영 실패:', err);
      alert('승인은 화면에 반영되었으나 DB 저장에 실패했습니다. 목록 새로고침을 눌러 확인해 주세요.');
    }
  };

  const memberPurchaseHistory = useMemo(() => {
    if (!editingMember) return [];
    const smm = smmOrders.filter(o => o.userId === editingMember.id).map(o => ({ id: o.id, orderTime: o.orderTime, category: 'SNS활성화', productName: o.productName, amount: o.sellingPrice * o.quantity, status: o.status }));
    const channels_purchased = channelOrders.filter(o => o.userId === editingMember.id).map(o => ({ id: o.id, orderTime: o.orderTime, category: '채널구매', productName: o.productName, amount: o.price, status: o.status }));
    const store = storeOrders.filter(o => o.userId === editingMember.id).map(o => ({ id: o.id, orderTime: o.orderTime, category: 'N잡스토어', productName: o.productName, amount: o.price, status: o.status }));
    return [...smm, ...channels_purchased, ...store].sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [editingMember, smmOrders, storeOrders, channelOrders]);

  const memberSalesHistory = useMemo(() => {
    if (!editingMember) return [];
    return storeOrders.filter(o => o.sellerNickname === editingMember.nickname).map(o => ({ id: o.id, orderTime: o.orderTime, buyerNickname: o.userNickname, productName: o.productName, amount: o.price, status: o.status })).sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [editingMember, storeOrders]);

  const handleApproveSeller = async (userId: string) => {
    const target = members.find(m => m.id === userId);
    const app = target?.pendingApplication || target?.sellerApplication;
    setMembers(prev => prev.map(m => {
      if (m.id === userId) {
        if (m.pendingApplication) return { ...m, sellerStatus: 'approved', sellerApplication: m.pendingApplication, pendingApplication: undefined };
        return { ...m, sellerStatus: 'approved' };
      }
      return m;
    }));
    await supabase.from('profiles').update({
      seller_status: 'approved',
      seller_application: app || target?.sellerApplication || null,
      updated_at: new Date().toISOString()
    }).eq('id', userId);
    alert('승인 처리가 완료되었습니다.');
    if (editingMember?.id === userId) setEditingMember(null);
  };

  const handleUpdateMemberInfo = async () => {
    if (!editingMember) return;
    setMembers(prev => prev.map(m => m.id === editingMember.id ? editingMember : m));
    try {
      await supabase.from('profiles').update({
        role: editingMember.role,
        points: editingMember.points ?? 0,
        manual_grade: editingMember.manualGrade || null,
        point_bonus_percent: editingMember.pointBonusPercent ?? 0,
        point_bonus_active: editingMember.pointBonusActive ?? false,
        updated_at: new Date().toISOString()
      }).eq('id', editingMember.id);
    } catch (_) {}
    alert('회원 정보 업데이트가 적용되었습니다.');
    setEditingMember(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-2 rounded-[24px] flex gap-2 w-fit border border-gray-100 shadow-sm mx-4">
        <button onClick={() => setActiveSubTab('list')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'list' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>전체 회원 데이터</button>
        <button onClick={() => setActiveSubTab('seller')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'seller' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>판매자 승인 대기 ({pendingRequests.length})</button>
        <button onClick={() => setActiveSubTab('freelancer')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'freelancer' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>프리랜서 승인 대기 ({pendingFreelancers.length})</button>
        <button onClick={() => setActiveSubTab('grades')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'grades' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>등급 관리</button>
      </div>

      {activeSubTab === 'list' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-2">
               {(['all', 'buyer', 'seller', 'freelancer'] as const).map(type => (
                 <button key={type} onClick={() => setUserTypeFilter(type)} className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all border ${userTypeFilter === type ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border-gray-100'}`}>
                   {type === 'all' ? '전체' : type === 'buyer' ? '구매자' : type === 'seller' ? '판매자' : '프리랜서'}
                 </button>
               ))}
            </div>
            <div className="flex items-center gap-3">
               <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="회원 검색" className="px-6 py-2 bg-gray-50 rounded-full font-bold text-xs outline-none w-64" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                 <tr>
                   <th className="px-8 py-5">회원정보</th>
                   <th className="px-8 py-5 text-center">등급뱃지</th>
                   <th className="px-8 py-5 text-right">총 구매액</th>
                   <th className="px-8 py-5 text-right">총 판매액</th>
                   <th className="px-8 py-5 text-right">포인트보유</th>
                   <th className="px-8 py-5 text-right">알바비수익금</th>
                   <th className="px-8 py-5 text-center">관리</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {filteredMembers.map(m => (
                   <tr key={m.id} className="hover:bg-blue-50/20 font-bold">
                     <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                           <img src={m.profileImage} className="w-10 h-10 rounded-xl object-cover" alt="p" />
                           <div><p className="text-gray-900">{m.nickname}</p><p className="text-[10px] text-gray-400">@{m.id}</p></div>
                        </div>
                     </td>
                     <td className="px-8 py-4 text-center">
                        <span className={`${resolveGrade(m)?.color || 'bg-gray-400'} text-white text-[10px] font-black px-3 py-1 rounded-full`}>{resolveGrade(m)?.name || '-'}</span>
                     </td>
                     <td className="px-8 py-4 text-right text-blue-600">₩{(m.totalPurchaseAmount || 0).toLocaleString()}</td>
                     <td className="px-8 py-4 text-right text-orange-600">₩{(m.totalSalesAmount || 0).toLocaleString()}</td>
                     <td className="px-8 py-4 text-right text-blue-600">{(m.points || 0).toLocaleString()}P</td>
                     <td className="px-8 py-4 text-right text-emerald-600">₩{(freelancerBalances[m.id] ?? 0).toLocaleString()}</td>
                     <td className="px-8 py-4 text-center">
                        <button onClick={() => setEditingMember({ ...m })} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black">관리</button>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'freelancer' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-gray-900">프리랜서 승인 대기</h3>
              <p className="text-[13px] text-gray-500 font-bold mt-1">실명, 연락처, 통장정보, 신분증/통장 이미지를 확인한 뒤 승인해 주세요. DB에서 불러오므로 목록이 비어 있으면 새로고침을 눌러 주세요.</p>
            </div>
            <button type="button" onClick={() => onRefreshMembers?.()} className="px-6 py-3 rounded-xl bg-emerald-100 text-emerald-800 font-black text-[13px] hover:bg-emerald-200 transition-all">
              목록 새로고침 (DB에서 다시 불러오기)
            </button>
          </div>
          <div className="p-8 space-y-8">
            {pendingFreelancers.length === 0 ? (
              <p className="text-gray-400 font-bold text-center py-16">승인 대기 중인 프리랜서가 없습니다.</p>
            ) : (
              pendingFreelancers.map(m => {
                const app = m.freelancerApplication;
                return (
                  <div key={m.id} className="border border-emerald-200 rounded-[24px] p-8 bg-emerald-50/30 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <img src={m.profileImage} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow" alt="" />
                        <div>
                          <p className="text-[18px] font-black text-gray-900">{m.nickname}</p>
                          <p className="text-[12px] text-gray-500 font-bold">@{m.id}</p>
                          {app?.appliedAt && <p className="text-[11px] text-emerald-600 font-bold mt-1">신청일: {app.appliedAt}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleApproveFreelancer(m.id)} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[14px] hover:bg-emerald-700 transition-all shadow-lg">승인</button>
                    </div>
                    {app && (
                      <div className="space-y-6 pt-4 border-t border-emerald-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-gray-400 uppercase">개인 정보</p>
                            <p className="font-bold text-gray-800">실명: {app.name}</p>
                            <p className="font-bold text-gray-800">연락처: {app.contact}</p>
                            <p className="font-bold text-gray-800">주민등록번호: {app.residentNumber}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-gray-400 uppercase">통장 정보</p>
                            <p className="font-bold text-gray-800">은행: {app.bankName}</p>
                            <p className="font-bold text-gray-800">계좌: {app.accountNo}</p>
                            <p className="font-bold text-gray-800">예금주: {app.ownerName}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-black text-gray-400 uppercase">첨부 (신분증·통장사본) · 클릭 시 확대</p>
                          <div className="flex flex-wrap gap-3">
                            {app.idCardImage && (
                              <button type="button" onClick={() => setZoomImage(app.idCardImage!)} className="block w-24 h-24 rounded-xl border-2 border-emerald-200 overflow-hidden bg-white shadow-inner hover:border-emerald-400 hover:ring-2 hover:ring-emerald-200 transition-all cursor-pointer text-left">
                                <img src={app.idCardImage} alt="신분증" className="w-full h-full object-cover pointer-events-none" />
                                <span className="sr-only">신분증 확대 보기</span>
                              </button>
                            )}
                            {app.bankbookImage && (
                              <button type="button" onClick={() => setZoomImage(app.bankbookImage!)} className="block w-24 h-24 rounded-xl border-2 border-emerald-200 overflow-hidden bg-white shadow-inner hover:border-emerald-400 hover:ring-2 hover:ring-emerald-200 transition-all cursor-pointer text-left">
                                <img src={app.bankbookImage} alt="통장사본" className="w-full h-full object-cover pointer-events-none" />
                                <span className="sr-only">통장사본 확대 보기</span>
                              </button>
                            )}
                            {!app.idCardImage && !app.bankbookImage && <span className="text-gray-400 text-[13px] font-bold">첨부 없음</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'seller' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h3 className="text-xl font-black text-gray-900">판매자 승인 대기 · 심사 내역</h3>
            <p className="text-[13px] text-gray-500 font-bold mt-1">통장정보·통장사본 등 제출 내용을 확인한 뒤 승인해 주세요.</p>
          </div>
          <div className="p-8 space-y-8">
            {pendingRequests.length === 0 ? (
              <p className="text-gray-400 font-bold text-center py-16">승인 대기 중인 회원이 없습니다.</p>
            ) : (
              pendingRequests.map(m => {
                const app: SellerApplication | undefined = m.pendingApplication || m.sellerApplication;
                return (
                  <div key={m.id} className="border border-gray-200 rounded-[24px] p-8 bg-gray-50/50 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <img src={m.profileImage} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow" alt="" />
                        <div>
                          <p className="text-[18px] font-black text-gray-900">{m.nickname}</p>
                          <p className="text-[12px] text-gray-500 font-bold">@{m.id}</p>
                          {app?.appliedAt && <p className="text-[11px] text-blue-600 font-bold mt-1">신청일: {app.appliedAt}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleApproveSeller(m.id)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[14px] hover:bg-blue-700 transition-all shadow-lg">승인</button>
                    </div>
                    {app && (
                      <div className="space-y-6 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-gray-400 uppercase">통장 정보</p>
                            <p className="font-bold text-gray-800">은행: {app.bankInfo?.bankName || '-'}</p>
                            <p className="font-bold text-gray-800">계좌: {app.bankInfo?.accountNo || '-'}</p>
                            <p className="font-bold text-gray-800">예금주: {app.bankInfo?.ownerName || '-'}</p>
                            <p className="font-bold text-gray-800">이메일: {app.bankInfo?.email || '-'}</p>
                          </div>
                          {(app.sellerType === 'business' && app.businessInfo) && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-black text-gray-400 uppercase">사업자 정보</p>
                              <p className="font-bold text-gray-800">상호/회사명: {app.businessInfo.companyName || '-'}</p>
                              <p className="font-bold text-gray-800">사업자등록번호: {app.businessInfo.registrationNo || '-'}</p>
                              <p className="font-bold text-gray-800">업종: {app.businessInfo.businessType || '-'}</p>
                              <p className="font-bold text-gray-800">대표자: {app.businessInfo.repName || '-'}</p>
                              <p className="font-bold text-gray-800">사업장 소재지: {app.businessInfo.location || '-'}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-black text-gray-400 uppercase">첨부 (통장사본 등) · 클릭 시 확대</p>
                          <div className="flex flex-wrap gap-3">
                            {app.proofs?.bankbookImg && (
                              <button type="button" onClick={() => setZoomImage(app.proofs!.bankbookImg!)} className="block w-24 h-24 rounded-xl border-2 border-gray-200 overflow-hidden bg-white shadow-inner hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer text-left">
                                <img src={app.proofs.bankbookImg} alt="통장사본" className="w-full h-full object-cover pointer-events-none" />
                                <span className="sr-only">통장사본 확대 보기</span>
                              </button>
                            )}
                            {app.proofs?.licenseImg && (
                              <button type="button" onClick={() => setZoomImage(app.proofs!.licenseImg!)} className="block w-24 h-24 rounded-xl border-2 border-gray-200 overflow-hidden bg-white shadow-inner hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer text-left">
                                <img src={app.proofs.licenseImg} alt="사업자등록증" className="w-full h-full object-cover pointer-events-none" />
                                <span className="sr-only">사업자등록증 확대 보기</span>
                              </button>
                            )}
                            {!app.proofs?.bankbookImg && !app.proofs?.licenseImg && <span className="text-gray-400 text-[13px] font-bold">첨부 없음</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'grades' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h3 className="text-xl font-black text-gray-900">등급 관리</h3>
            <p className="text-[13px] text-gray-500 font-bold mt-1">구매자/판매자별 등급을 만들고, 기준을 설정하면 마이페이지·N잡스토어·자유게시판 등에서 뱃지로 표시됩니다.</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex justify-end">
              <button onClick={() => setGradeConfigs(prev => [...prev, { id: `g_${Date.now()}`, name: '', target: 'both', minSales: 0, minPurchase: 0, color: 'bg-blue-500', sortOrder: prev.length }])} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[13px]">+ 등급 추가</button>
            </div>
            <div className="space-y-4">
              {gradeConfigs.map((g, idx) => (
                <div key={g.id} className="flex flex-wrap items-center gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className={`${g.color || 'bg-gray-400'} text-white text-xs font-black px-3 py-1.5 rounded-full`}>{g.name || '등급명 입력'}</span>
                    <select value={g.target} onChange={e => setGradeConfigs(prev => prev.map(c => c.id === g.id ? { ...c, target: e.target.value as any } : c))} className="px-3 py-2 rounded-xl font-bold text-[12px]">
                      <option value="both">구매자·판매자 둘 다</option>
                      <option value="seller">판매자 전용</option>
                      <option value="buyer">구매자 전용</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-black text-gray-500">판매액 기준 (원)</label>
                    <input type="number" value={g.minSales || ''} onChange={e => setGradeConfigs(prev => prev.map(c => c.id === g.id ? { ...c, minSales: Number(e.target.value) || 0 } : c))} placeholder="0=수동만" className="w-32 px-3 py-2 rounded-xl font-bold text-[12px]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-black text-gray-500">구매액 기준 (원)</label>
                    <input type="number" value={g.minPurchase || ''} onChange={e => setGradeConfigs(prev => prev.map(c => c.id === g.id ? { ...c, minPurchase: Number(e.target.value) || 0 } : c))} placeholder="0=미사용" className="w-32 px-3 py-2 rounded-xl font-bold text-[12px]" />
                  </div>
                  <input type="text" value={g.name} onChange={e => setGradeConfigs(prev => prev.map(c => c.id === g.id ? { ...c, name: e.target.value.trim() || '' } : c))} className="w-32 px-3 py-2 rounded-xl font-black text-[12px] border-2 border-amber-200 focus:border-amber-500" placeholder="뱃지에 표시할 문구" />
                  <select value={g.color} onChange={e => setGradeConfigs(prev => prev.map(c => c.id === g.id ? { ...c, color: e.target.value } : c))} className="px-3 py-2 rounded-xl font-bold text-[12px]">
                    <option value="bg-gray-400">회색</option>
                    <option value="bg-blue-500">파랑</option>
                    <option value="bg-amber-500">골드(Prime)</option>
                    <option value="bg-purple-600">보라</option>
                    <option value="bg-gray-900">블랙(MASTER)</option>
                    <option value="bg-emerald-500">에메랄드</option>
                    <option value="bg-rose-500">로즈</option>
                  </select>
                  <button onClick={() => setGradeConfigs(prev => prev.filter(c => c.id !== g.id))} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl font-black text-[12px]">삭제</button>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-gray-400 font-bold">· 수동 등급: 회원 관리에서 해당 회원의 등급을 직접 지정할 수 있습니다.</p>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 z-[200] bg-[#F8FAFC] flex flex-col animate-in fade-in overflow-hidden">
           <div className="flex-none p-4 md:p-6 border-b border-gray-200 bg-white shadow-sm flex flex-wrap justify-between items-center gap-4">
             <h3 className="text-xl font-black text-gray-900">회원 마이페이지: {editingMember.nickname} (관리자 보기)</h3>
             <div className="flex gap-3 flex-wrap">
               <button onClick={handleUpdateMemberInfo} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[13px] shadow-lg">저장 적용 💾</button>
               <button onClick={() => setEditingMember(null)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-2xl font-black">닫기</button>
             </div>
           </div>
           <div className="flex-none p-4 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-4 items-center">
             <span className="text-[11px] font-black text-amber-700 uppercase">관리자 전용 조정</span>
             <select value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value as any})} className="px-3 py-2 rounded-xl font-bold text-[12px] border border-amber-200">
               <option value="user">일반 회원</option>
               <option value="admin">최고 관리자</option>
             </select>
             <div className="flex items-center gap-2">
               <label className="text-[11px] font-black text-amber-700">포인트</label>
               <input type="number" value={editingMember.points || 0} onChange={e => setEditingMember({...editingMember, points: Number(e.target.value)})} className="w-24 px-3 py-2 rounded-xl font-bold text-[12px] border border-amber-200" />
             </div>
             <div className="flex items-center gap-2">
               <label className="text-[11px] font-black text-amber-700">수동 등급</label>
               <select value={editingMember.manualGrade || ''} onChange={e => setEditingMember({...editingMember, manualGrade: e.target.value || undefined})} className="px-3 py-2 rounded-xl font-bold text-[12px] border border-amber-200">
                 <option value="">자동 (기준에 따라)</option>
                 {gradeConfigs.filter(g => (g.name || '').trim()).map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
               </select>
             </div>
             <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl border border-orange-200">
               <label className="text-[11px] font-black text-orange-700">🎁 충전 보너스 이벤트</label>
               <button
                 type="button"
                 onClick={() => setEditingMember({...editingMember, pointBonusActive: !editingMember.pointBonusActive})}
                 className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${editingMember.pointBonusActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}
               >
                 {editingMember.pointBonusActive ? 'ON' : 'OFF'}
               </button>
               <input
                 type="number"
                 min={0}
                 max={100}
                 value={editingMember.pointBonusPercent ?? 0}
                 onChange={e => setEditingMember({...editingMember, pointBonusPercent: Number(e.target.value)})}
                 className="w-16 px-2 py-1 rounded-lg font-bold text-[12px] border border-orange-200 text-center"
               />
               <span className="text-[11px] font-black text-orange-700">%</span>
             </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 md:p-6">
             <MyPage
               user={editingMember}
               onUpdate={(u) => { setEditingMember(u); setMembers(prev => prev.map(m => m.id === u.id ? u : m)); }}
               ebooks={ebooks}
               setEbooks={setEbooks}
               channels={channels}
               smmOrders={smmOrders}
               channelOrders={channelOrders}
               storeOrders={storeOrders}
               onAddReview={setReviews ? (r) => setReviews(prev => [r, ...prev]) : () => {}}
               onUpdateReview={setReviews ? (r) => setReviews(prev => prev.map(i => i.id === r.id ? r : i)) : () => {}}
               reviews={reviews}
               addNotif={addNotif}
               gradeConfigs={gradeConfigs}
             />
           </div>
           <div className="flex-none p-4 border-t bg-white flex gap-4 justify-end">
             <button onClick={() => setEditingMember(null)} className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black">취소</button>
             <button onClick={handleUpdateMemberInfo} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl">업데이트 적용 💾</button>
           </div>
        </div>
      )}

      {/* 이미지 확대 팝업 (통장사본·사업자등록증 등) */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-6 cursor-pointer animate-in fade-in"
          onClick={() => setZoomImage(null)}
          role="dialog"
          aria-label="이미지 확대"
        >
          <img
            src={zoomImage}
            alt="확대 보기"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain select-none"
          />
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 text-sm font-bold">클릭하면 닫힙니다</p>
        </div>
      )}
    </div>
  );
};

export default MemberAdmin;
