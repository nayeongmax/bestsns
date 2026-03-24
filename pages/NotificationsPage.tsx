import React, { useState, useMemo } from 'react';
import { SiteNotification, NotificationType, UserProfile } from '@/types';
import { supabase } from '../supabase';

interface Props {
  notifications: SiteNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  user: UserProfile | null;
}

const NotificationsPage: React.FC<Props> = ({ notifications, setNotifications, user }) => {
  const [selectedNotif, setSelectedNotif] = useState<SiteNotification | null>(null);

  // 본인 전용 알림만 필터링
  const myNotifications = useMemo(() => {
    if (!user) return [];
    return notifications.filter(n => n.userId === user.id);
  }, [notifications, user]);

  // 알림 클릭 시 읽음 처리 및 모달 오픈 (DB 연동)
  const handleOpenNotif = (n: SiteNotification) => {
    setSelectedNotif(n);
    setNotifications(prev => prev.map(notif =>
      notif.id === n.id ? { ...notif, isRead: true } : notif
    ));
    supabase.from('site_notifications').update({ is_read: true }).eq('id', n.id).then(() => {});
  };

  const closeModal = () => {
    setSelectedNotif(null);
  };

  // 모두 읽음 처리 (알림 배지 초기화)
  const handleMarkAllRead = () => {
    if (!user) return;
    const unreadIds = myNotifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n =>
      n.userId === user.id ? { ...n, isRead: true } : n
    ));
    supabase.from('site_notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false).then(() => {});
  };

  const unreadCount = myNotifications.filter(n => !n.isRead).length;

  // 알림 타입별 스타일 매핑
  const getBadgeStyle = (type: NotificationType) => {
    switch (type) {
      case 'chat': return { label: '채팅', color: 'bg-blue-500', icon: '💬' };
      case 'ebook': return { label: '전자책', color: 'bg-slate-800', icon: '📖' };
      case 'channel': return { label: '채널', color: 'bg-indigo-600', icon: '📺' };
      case 'sns_activation': return { label: 'SNS활성화', color: 'bg-rose-500', icon: '📈' };
      case 'approval': return { label: '승인', color: 'bg-green-600', icon: '✅' };
      case 'payment': return { label: '결제', color: 'bg-emerald-600', icon: '💳' };
      case 'prohibited': return { label: '금지', color: 'bg-red-600', icon: '🚨' };
      case 'notice': return { label: '공지', color: 'bg-orange-500', icon: '📢' };
      case 'coupon': return { label: '쿠폰', color: 'bg-yellow-500', icon: '🎫' };
      case 'revenue': return { label: '수익', color: 'bg-purple-600', icon: '💰' };
      case 'review': return { label: '리뷰', color: 'bg-cyan-600', icon: '⭐' };
      case 'revision': return { label: '수정', color: 'bg-amber-500', icon: '✏️' };
      case 'freelancer': return { label: '프리랜서', color: 'bg-emerald-600', icon: '👷' };
      default: return { label: '알림', color: 'bg-gray-400', icon: '🔔' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 md:px-6 xl:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-10">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 italic tracking-tighter">
            <span className="w-2 h-6 sm:h-8 bg-blue-600 rounded-full"></span> 활동 알림 센터
          </h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-[10px] sm:text-[11px] font-black rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm uppercase italic tracking-wide"
            >
              모두 읽음 ({unreadCount})
            </button>
          )}
        </div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest italic">Personal notification updates</p>
      </div>

      {myNotifications.length === 0 ? (
        <div className="bg-white p-12 sm:p-16 xl:p-20 rounded-[32px] sm:rounded-[48px] border border-dashed border-gray-200 flex flex-col items-center text-center">
           <span className="text-5xl sm:text-6xl xl:text-6xl mb-4 xl:mb-6 opacity-30 grayscale">🔔</span>
           <h3 className="text-lg sm:text-xl xl:text-xl font-black text-gray-300 italic mb-2">기록된 알림이 없습니다.</h3>
           <p className="text-gray-300 font-bold text-sm">중요한 업데이트가 있을 때 이곳에서 알려드릴게요!</p>
        </div>
      ) : (
        <div className="space-y-4">
           {myNotifications.map(n => {
             const style = getBadgeStyle(n.type);
             return (
               <div
                 key={n.id}
                 onClick={() => handleOpenNotif(n)}
                 className={`bg-white p-4 sm:p-5 rounded-[16px] sm:rounded-[24px] shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md cursor-pointer transition-all group relative overflow-hidden ${!n.isRead ? 'ring-2 ring-blue-50' : 'opacity-70'}`}
               >
                  {!n.isRead && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`${style.color} text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg italic shadow-sm uppercase tracking-tighter flex items-center gap-1 shrink-0`}>
                          <span>{style.icon}</span>
                          <span>{style.label}</span>
                        </span>
                        <h3 className="font-black text-[14px] sm:text-[15px] text-gray-900 group-hover:text-blue-600 transition-colors break-words">{n.title}</h3>
                     </div>
                     <span className="text-[10px] text-gray-300 font-black italic uppercase shrink-0">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[12px] sm:text-[13px] font-bold text-gray-500 leading-relaxed pl-1 whitespace-pre-wrap line-clamp-2">{n.message}</p>
               </div>
             );
           })}
        </div>
      )}

      {/* 알림 상세 모달 */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 xl:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[32px] sm:rounded-[48px] xl:rounded-[48px] p-6 sm:p-10 md:p-12 xl:p-12 shadow-2xl space-y-6 xl:space-y-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
            {/* 모달 상단 장식 */}
            <div className={`absolute top-0 left-0 right-0 h-2 ${getBadgeStyle(selectedNotif.type).color}`}></div>
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`w-20 h-20 ${getBadgeStyle(selectedNotif.type).color} text-white rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-gray-100`}>
                {getBadgeStyle(selectedNotif.type).icon}
              </div>
              <div>
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic mb-2 block">
                  {getBadgeStyle(selectedNotif.type).label} 알림 상세내용
                </span>
                <h4 className="text-2xl font-black text-gray-900 tracking-tight">{selectedNotif.title}</h4>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-[32px] text-gray-700 font-bold leading-relaxed whitespace-pre-wrap text-[15px] shadow-inner">
              {selectedNotif.message}
            </div>

            {/* 금지 키워드 알림일 경우 특별 경고 문구 추가 */}
            {selectedNotif.type === 'prohibited' && (
              <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[32px] space-y-4 animate-pulse">
                <div className="flex items-center gap-3 text-red-600">
                  <span className="text-xl">⚠️</span>
                  <h5 className="font-black text-lg italic">사이트 이용 정책 경고</h5>
                </div>
                <div className="text-[14px] font-black text-red-500 leading-relaxed italic">
                  <p>• 직거래 유도 키워드가 <span className="underline decoration-2 underline-offset-4 font-black">5회 이상</span> 감지되면 사이트 내 모든 활동이 정지됩니다.</p>
                  <p className="mt-2">• <span className="underline decoration-2 underline-offset-4 font-black">7회</span> 감지 시 수익금 출금 금지 및 계정 영구 탈퇴 처리가 진행됩니다.</p>
                </div>
              </div>
            )}

            {/* 운영자 사유가 있을 경우 */}
            {selectedNotif.reason && (
              <div className="bg-blue-50 p-6 rounded-2xl border-l-4 border-blue-400">
                <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1">상세 사유</p>
                <p className="text-[14px] font-bold text-blue-800 italic">"{selectedNotif.reason}"</p>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 pt-4">
              <span className="text-[10px] font-black text-gray-300 uppercase italic">
                수신 시간: {new Date(selectedNotif.createdAt).toLocaleString()}
              </span>
              <button 
                onClick={closeModal}
                className="w-full py-6 bg-gray-900 text-white rounded-[24px] font-black text-xl hover:bg-black transition-all shadow-xl uppercase italic tracking-widest active:scale-95"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
