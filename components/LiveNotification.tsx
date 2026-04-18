
import React, { useState, useEffect, useRef } from 'react';

const VALID_ORDERS = [
  '인스타그램 팔로워',
  '인스타그램 좋아요',
  '인스타그램 조회수',
  '인스타그램 댓글',
  '인스타그램 저장',
  '유튜브 구독자',
  '유튜브 좋아요',
  '유튜브 조회수',
  '유튜브 댓글',
  '틱톡 팔로워',
  '틱톡 좋아요',
  '틱톡 조회수',
  '트위터(X) 팔로워',
  '트위터(X) 좋아요',
  '페이스북 팔로워',
  '페이스북 좋아요',
  '쓰레드 팔로워',
  '쓰레드 좋아요',
  '네이버 블로그 방문자',
  '네이버 블로그 좋아요',
  '카카오톡 채널 구독',
];

const LiveNotification: React.FC = () => {
  const [notification, setNotification] = useState<{ type: 'order' | 'users'; content: string } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [userCount, setUserCount] = useState(52);
  
  const lastTypeRef = useRef<'order' | 'users'>('users');
  const userCountRef = useRef(52);

  useEffect(() => {
    const interval = setInterval(() => {
      const change = Math.floor(Math.random() * 5) - 2;
      const next = Math.max(35, Math.min(180, userCountRef.current + change));
      userCountRef.current = next;
      setUserCount(next);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const generateAndShow = () => {
      const nextType = lastTypeRef.current === 'users' ? 'order' : 'users';
      lastTypeRef.current = nextType;

      let content = '';
      if (nextType === 'order') {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const idLen = Math.floor(Math.random() * 3) + 3;
        const idPrefix = Array.from({ length: idLen }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
        const order = VALID_ORDERS[Math.floor(Math.random() * VALID_ORDERS.length)];

        let count;
        const rand = Math.random();
        if (rand < 0.5) count = Math.floor(Math.random() * 151) + 40;
        else if (rand < 0.8) count = Math.floor(Math.random() * 301) + 200;
        else count = Math.floor(Math.random() * 401) + 600;

        content = `${idPrefix}****님이 ${order} ${count.toLocaleString()}개를 주문했습니다.`;
      } else {
        content = `현재 사이트에 ${userCountRef.current}명이 접속해 있습니다.`;
      }

      setNotification({ type: nextType, content });
      setIsVisible(true);

      setTimeout(() => {
        setIsVisible(false);
      }, 10000);
    };

    const initialTimeout = setTimeout(generateAndShow, 3000);
    
    // 40초 주기로 변경
    const interval = setInterval(generateAndShow, 40000);

    const handleManualOrder = (e: any) => {
      setNotification({
        type: 'order',
        content: `방금 내 주문이 성공적으로 접수되었습니다! (결제금액: ₩${e.detail.amount.toLocaleString()})`
      });
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 10000);
    };

    window.addEventListener('user-new-order', handleManualOrder);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      window.removeEventListener('user-new-order', handleManualOrder);
    };
  }, []);

  if (!notification || !isVisible) return null;

  const isOrder = notification.type === 'order';
  return (
    <div className="fixed top-20 left-2 right-2 sm:left-auto sm:right-8 sm:top-24 z-[100] notification-fade">
      {/* 모바일: 좌우 여백만 두고 가로 폭 꽉 채워서 문장 전체 노출 / sm 이상은 기존 */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-100 shadow-lg rounded-xl flex items-center gap-2 min-w-0 w-full px-2.5 py-2 sm:w-auto sm:min-w-[340px] sm:max-w-none sm:rounded-2xl sm:p-5 sm:gap-4 sm:shadow-xl">
        <div className="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5 sm:w-6 sm:h-6">
          <div className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm animate-pulse ${isOrder ? 'bg-blue-500 shadow-blue-200' : 'bg-red-500 shadow-red-200'}`}></div>
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-[10px] font-bold text-gray-700 leading-tight sm:text-[14px] sm:leading-tight whitespace-nowrap overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] sm:whitespace-normal sm:overflow-visible">
            {notification.content}
          </p>
        </div>
      </div>
    </div>
  );
}; export default LiveNotification;
