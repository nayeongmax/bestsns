import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, SiteNotification, SellerApplication, SMMOrder, EbookProduct, ChannelProduct, StoreOrder, GradeConfig, ChannelOrder } from '../../types';
import { useNavigate } from 'react-router-dom';

interface Props {
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  ebooks: EbookProduct[];
  channels: ChannelProduct[];
}

type AdminEditTab = 'account' | 'proofs' | 'buyer' | 'seller';
type SortKey = 'none' | 'purchase' | 'sales' | 'violations' | 'points' | 'join';

const MemberAdmin: React.FC<Props> = ({ members, setMembers, setNotifications, smmOrders, channelOrders, storeOrders, ebooks, channels }) => {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'seller' | 'grades'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'buyer' | 'seller'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<AdminEditTab>('account');
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [gradeConfigs, setGradeConfigs] = useState<GradeConfig[]>(() => {
    const saved = localStorage.getItem('grade_configs_v1');
    return saved ? JSON.parse(saved) : [
      { id: 'g1', name: 'lv.1', minSales: 5000000, color: 'bg-blue-500' },
      { id: 'g2', name: 'lv.2', minSales: 10000000, color: 'bg-indigo-500' },
      { id: 'g3', name: 'lv.3', minSales: 30000000, color: 'bg-purple-600' },
      { id: 'g4', name: 'MASTER', minSales: 50000000, color: 'bg-gray-900' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('grade_configs_v1', JSON.stringify(gradeConfigs));
  }, [gradeConfigs]);

  const getUserGrade = (m: UserProfile) => {
    if (m.manualGrade) return gradeConfigs.find(g => g.name === m.manualGrade) || null;
    const sales = m.totalSalesAmount || 0;
    const sortedConfigs = [...gradeConfigs].sort((a, b) => b.minSales - a.minSales);
    return sortedConfigs.find(g => sales >= g.minSales) || null;
  };

  const filteredMembers = useMemo(() => {
    let result = members.filter(m => 
      (m.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (userTypeFilter === 'buyer') {
      result = result.filter(m => m.sellerStatus !== 'approved');
    } else if (userTypeFilter === 'seller') {
      result = result.filter(m => m.sellerStatus === 'approved');
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

  const handleApproveSeller = (userId: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === userId) {
        if (m.pendingApplication) return { ...m, sellerStatus: 'approved', sellerApplication: m.pendingApplication, pendingApplication: undefined };
        return { ...m, sellerStatus: 'approved' };
      }
      return m;
    }));
    alert('승인 처리가 완료되었습니다.');
    if (editingMember?.id === userId) setEditingMember(null);
  };

  const handleUpdateMemberInfo = () => {
    if (!editingMember) return;
    setMembers(prev => prev.map(m => m.id === editingMember.id ? editingMember : m));
    alert('회원 정보 업데이트가 적용되었습니다.');
    setEditingMember(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-2 rounded-[24px] flex gap-2 w-fit border border-gray-100 shadow-sm mx-4">
        <button onClick={() => setActiveSubTab('list')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'list' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>전체 회원 데이터</button>
        <button onClick={() => setActiveSubTab('seller')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'seller' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>판매자 승인 대기 ({pendingRequests.length})</button>
        <button onClick={() => setActiveSubTab('grades')} className={`px-8 py-3 rounded-[18px] text-[12px] font-black transition-all ${activeSubTab === 'grades' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>등급 관리</button>
      </div>

      {activeSubTab === 'list' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-2">
               {['all', 'buyer', 'seller'].map(type => (
                 <button key={type} onClick={() => setUserTypeFilter(type as any)} className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all border ${userTypeFilter === type ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border-gray-100'}`}>
                   {type === 'all' ? '전체' : type === 'buyer' ? '구매자' : '판매자'}
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
                   <th className="px-8 py-5 text-center">등급</th>
                   <th className="px-8 py-5 text-right">총 판매액</th>
                   <th className="px-8 py-5 text-right">포인트</th>
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
                        <span className="bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full">{getUserGrade(m)?.name || 'Basic'}</span>
                     </td>
                     <td className="px-8 py-4 text-right text-orange-600">₩{(m.totalSalesAmount || 0).toLocaleString()}</td>
                     <td className="px-8 py-4 text-right text-blue-600">{(m.points || 0).toLocaleString()}P</td>
                     <td className="px-8 py-4 text-center">
                        <button onClick={() => { setEditingMember({ ...m }); setActiveEditTab('account'); }} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black">관리</button>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-6xl rounded-[56px] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-900 text-white">
                 <h3 className="text-2xl font-black italic">회원 정보 제어: {editingMember.nickname}</h3>
                 <button onClick={() => setEditingMember(null)} className="bg-white/10 px-6 py-3 rounded-2xl font-black">닫기</button>
              </div>
              <div className="flex flex-1 overflow-hidden">
                 <div className="w-[260px] bg-gray-50 border-r p-6 space-y-2">
                    {['account', 'proofs', 'buyer', 'seller'].map(t => (
                       <button key={t} onClick={() => setActiveEditTab(t as any)} className={`w-full text-left px-6 py-4 rounded-2xl text-[14px] font-black ${activeEditTab === t ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400'}`}>{t.toUpperCase()}</button>
                    ))}
                 </div>
                 <div className="flex-1 overflow-y-auto p-12 bg-white">
                    {activeEditTab === 'account' && (
                      <div className="space-y-12">
                         <h4 className="text-xl font-black">계정 설정</h4>
                         <div className="grid grid-cols-2 gap-8 bg-gray-50 p-10 rounded-[40px]">
                            <div className="space-y-2">
                               <label className="text-[11px] font-black text-gray-400">시스템 권한</label>
                               <select value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value as any})} className="w-full p-5 bg-white rounded-2xl font-black">
                                  <option value="user">일반 회원</option>
                                  <option value="admin">최고 관리자</option>
                               </select>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[11px] font-black text-blue-600">포인트 조정</label>
                               <input type="number" value={editingMember.points || 0} onChange={e => setEditingMember({...editingMember, points: Number(e.target.value)})} className="w-full p-5 bg-blue-50 rounded-2xl font-black" />
                            </div>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
              <div className="p-8 border-t flex gap-6 bg-gray-50">
                 <button onClick={() => setEditingMember(null)} className="flex-1 py-6 bg-white border rounded-[28px] font-black">취소</button>
                 <button onClick={handleUpdateMemberInfo} className="flex-[3] py-6 bg-blue-600 text-white rounded-[28px] font-black text-2xl shadow-2xl">업데이트 적용 💾</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MemberAdmin;