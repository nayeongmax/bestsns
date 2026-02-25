
import React, { useState, useEffect, useRef } from 'react';

const SNS_NAMES = ['인스타그램', '유튜브', '페이스북', '네이버', '쓰레드', '틱톡'];
const PRODUCT_TYPES = ['팔로워', '좋아요', '조회수', '댓글', '인사이트', '바이럴'];

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
        const sns = SNS_NAMES[Math.floor(Math.random() * SNS_NAMES.length)];
        const product = PRODUCT_TYPES[Math.floor(Math.random() * PRODUCT_TYPES.length)];
        
        let count;
        const rand = Math.random();
        if (rand < 0.5) count = Math.floor(Math.random() * 151) + 40;
        else if (rand < 0.8) count = Math.floor(Math.random() * 301) + 200;
        else count = Math.floor(Math.random() * 401) + 600;

        content = `${idPrefix}****님이 ${sns} ${product} ${count.toLocaleString()}개를 주문했습니다.`;
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

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-[100] notification-fade">
      <div className="bg-white/95 backdrop-blur-md border border-gray-100 shadow-lg rounded-xl px-3 py-2.5 flex items-center gap-2.5 min-w-0 max-w-[280px] sm:max-w-[320px]">
        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">
          <div className={`w-1.5 h-1.5 rounded-full shadow-sm animate-pulse ${notification.type === 'order' ? 'bg-blue-500 shadow-blue-200' : 'bg-red-500 shadow-red-200'}`}></div>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-bold text-gray-700 leading-snug">
            {notification.content}
          </p>
        </div>
      </div>
    </div>
  );
}; export default LiveNotification;
