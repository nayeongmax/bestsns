
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { UserProfile, ChatMessage, ChannelProduct, NotificationType } from '../types';

interface Props {
  user: UserProfile;
  onResetUnread?: () => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

interface ChatMessageExtended extends ChatMessage {
  productRef?: ChannelProduct;
  type?: 'text' | 'image' | 'warning' | 'system';
  imageContent?: string;
  dateStr?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  lastMsg: string;
  lastMsgTime: string; 
  isTrading: boolean;
  isFavorite: boolean;
  online: boolean;
  memo?: string;
}

const PROHIBITED_KEYWORDS = ['휴대폰', '폰번호', '직거래', '계좌', '이체', '010', '전화번호', '카톡', '연락처', '입금', '현금', '계좌번호'];

const formatRelativeTime = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const isSameDay = now.toDateString() === date.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();
  if (isSameDay) {
    if (diffInMins < 1) return '방금 전';
    if (diffInMins < 60) return `${diffInMins}분 전`;
    return `${diffInHours}시간 전`;
  } else if (isYesterday) return '어제';
  else return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/ /g, '');
};

const ChatPage: React.FC<Props> = ({ user, onResetUnread, addNotif }) => {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessageExtended[]>([]);
  const [input, setInput] = useState('');
  const [activeChatId, setActiveChatId] = useState('c1');
  const [activeFilter, setActiveFilter] = useState('전체');
  const [violationCount, setViolationCount] = useState(Number(localStorage.getItem(`violation_${user.id}`) || '0'));
  
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(() => {
    const savedMemos = localStorage.getItem('chat_memos');
    const now = new Date();
    const initialRooms: ChatRoom[] = [
      { id: 'c1', name: '바삭한달맞이...', lastMsg: '넵 대표님~ 상의해보시고 연락주세요!', lastMsgTime: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), isTrading: false, isFavorite: true, online: true, memo: '유튜브 채널 상담' },
      { id: 'c2', name: '구구통신', lastMsg: '표준견적서 보내드립니다 :)', lastMsgTime: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), isTrading: true, isFavorite: false, online: false, memo: '블로그 대행 진행중' },
      { id: 'c3', name: '렌트앤카', lastMsg: '결제 요청 메시지입니다...', lastMsgTime: new Date(now.setHours(8, 22, 0, 0)).toISOString(), isTrading: false, isFavorite: false, online: true, memo: '단골 고객님' },
      { id: 'c4', name: '걷는통조림7937', lastMsg: '넵~ 대표님!', lastMsgTime: '2026-01-16T10:00:00Z', isTrading: false, isFavorite: false, online: false, memo: '' },
    ];
    if (savedMemos) {
      const parsedMemos = JSON.parse(savedMemos);
      return initialRooms.map(room => ({ ...room, memo: parsedMemos[room.id] !== undefined ? parsedMemos[room.id] : room.memo }));
    }
    return initialRooms;
  });

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [tempMemoValue, setTempMemoValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (onResetUnread) onResetUnread(); }, [onResetUnread]);
  useEffect(() => {
    const memoMap: Record<string, string> = {};
    chatRooms.forEach(room => { memoMap[room.id] = room.memo || ''; });
    localStorage.setItem('chat_memos', JSON.stringify(memoMap));
  }, [chatRooms]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '');
    setMessages([
      { id: 'm1', senderId: 'bot', senderNickname: '전문가A', senderImage: 'https://picsum.photos/seed/c1/100/100', content: '안녕하세요! THEBESTSNS를 이용해 주셔서 감사합니다. 무엇을 도와드릴까요?', timestamp: '오후 2:20', dateStr: '2026.01.20.', type: 'text' },
      { id: 'm2', senderId: user.id, senderNickname: user.nickname, senderImage: user.profileImage, content: '네, 바로 작업 가능한가요?', timestamp: '오후 2:25', dateStr: '2026.01.20.', type: 'text' },
      { id: 'm3', senderId: 'bot', senderNickname: '전문가A', senderImage: 'https://picsum.photos/seed/c1/100/100', content: '네, 지금 바로 세팅 가능합니다. 결제 확인 후 작업 진행하겠습니다.', timestamp: '오후 2:30', dateStr: todayStr, type: 'text' },
    ]);
  }, [user]);

  const handleSendMessage = (customContent?: string, type: 'text' | 'image' = 'text', imageContent?: string) => {
    const textToSubmit = customContent || input;
    if (!textToSubmit.trim() && type === 'text') return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '');
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (type === 'text') {
      const detected = PROHIBITED_KEYWORDS.filter(word => textToSubmit.includes(word));
      if (detected.length > 0) {
        const newCount = violationCount + 1;
        setViolationCount(newCount);
        localStorage.setItem(`violation_${user.id}`, newCount.toString());
        
        // 시스템 알림 추가 (보안)
        addNotif(user.id, 'prohibited', '🚨 금지 키워드 감지 경고', `채팅 중 직거래 유도 키워드가 감지되었습니다: [${detected.join(', ')}]. 운영정책 위반 ${newCount}회째입니다.`);

        const warningMsg: ChatMessageExtended = {
          id: `warn_${Date.now()}`, senderId: 'system', senderNickname: 'THEBESTSNS 보안팀', senderImage: '',
          content: `🚨 직거래 키워드가 감지되었습니다: [${detected.join(', ')}]\n직거래 유도 5회 적발 시 판매 중지, 7회 적발 시 수익 창출 금지 및 계정 탈퇴 처리가 진행됩니다.\n(현재 누적 위반: ${newCount}회)`,
          timestamp, dateStr: todayStr, type: 'warning'
        };
        setMessages(prev => [...prev, warningMsg]);
        setInput('');
        return;
      }
    }

    const newMessage: ChatMessageExtended = {
      id: `msg${Date.now()}`, senderId: user.id, senderNickname: user.nickname, senderImage: user.profileImage,
      content: textToSubmit, timestamp, dateStr: todayStr, type, imageContent
    };
    setMessages(prev => [...prev, newMessage]);
    setChatRooms(prev => prev.map(room => room.id === activeChatId ? { ...room, lastMsg: textToSubmit, lastMsgTime: now.toISOString() } : room));
    if (!customContent) setInput('');

    // 시뮬레이션: 상대방에게 알림 발송 (실제 서버라면 상대 유저에게 감)
    const activeRoom = chatRooms.find(r => r.id === activeChatId);
    if (activeRoom) {
      console.log(`${activeRoom.name}님에게 메시지 알림을 발송했습니다.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => handleSendMessage('이미지를 전송했습니다.', 'image', reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveMemo = (id: string) => {
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, memo: tempMemoValue } : room));
    setEditingMemoId(null);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, isFavorite: !room.isFavorite } : room));
  };

  const toggleTrading = (id: string) => {
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, isTrading: !room.isTrading } : room));
  };

  const filteredRooms = chatRooms.filter(room => {
    if (activeFilter === '거래 중') return room.isTrading;
    if (activeFilter === '즐겨찾기') return room.isFavorite;
    return true;
  });

  let lastDate = "";

  return (
    <div className="max-w-6xl mx-auto h-[85vh] flex bg-[#F8F9FA] border border-gray-200 shadow-sm overflow-hidden rounded-lg">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      
      <div className="w-[340px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['전체', '거래 중', '즐겨찾기'].map(filter => (
              <button key={filter} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[12px] font-bold transition-all border ${activeFilter === filter ? 'bg-[#303441] text-white border-[#303441]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{filter}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (<div className="text-center py-20 text-gray-300 font-bold text-sm">대화방이 없습니다.</div>) : (
            filteredRooms.map(u => (
              <div key={u.id} onClick={() => setActiveChatId(u.id)} className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 relative ${activeChatId === u.id ? 'bg-[#F0F2F5]' : u.memo ? 'bg-blue-50/20' : ''}`}>
                <div className="relative shrink-0">
                  <img src={`https://picsum.photos/seed/${u.id}/100/100`} className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" alt="p" />
                  <div className={`absolute bottom-0.5 right-0.5 w-4 h-4 border-2 border-white rounded-full shadow-sm ${u.online ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-0.5"><span className="font-black text-[14.5px] text-gray-900 truncate leading-none">{u.name}</span><span className="text-[10px] font-bold text-gray-400 shrink-0">{formatRelativeTime(u.lastMsgTime)}</span></div>
                  <div className="mb-1">
                    {editingMemoId === u.id ? (
                      <input autoFocus value={tempMemoValue} onChange={(e) => setTempMemoValue(e.target.value)} onBlur={() => handleSaveMemo(u.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveMemo(u.id)} onClick={(e) => e.stopPropagation()} className="w-full text-[11px] font-black text-blue-600 bg-white border border-blue-200 px-1.5 py-0.5 rounded outline-none shadow-sm" placeholder="메모 입력..." />
                    ) : (
                      <div onClick={(e) => { e.stopPropagation(); setEditingMemoId(u.id); setTempMemoValue(u.memo || ''); }} className={`text-[11px] font-black italic truncate cursor-text hover:text-blue-500 transition-colors ${u.memo ? 'text-blue-500' : 'text-gray-300'}`}>{u.memo ? `📝 ${u.memo}` : '+ 관리 메모 추가'}</div>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-500 truncate leading-tight opacity-70">{u.lastMsg}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-1">{u.isTrading && <span className="bg-[#E6F7F0] text-[#00B06B] text-[9px] px-1.5 py-0.5 rounded font-black italic">거래 중</span>}</div>
                    <button onClick={(e) => toggleFavorite(u.id, e)} className={`transition-colors ${u.isFavorite ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400'}`}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 flex flex-col items-center bg-[#F9FBFF]">
          <div className="text-[12px] text-gray-500 font-black flex items-center gap-1.5 mb-1.5 uppercase italic">
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm9.496 3.036a1 1 0 00-1.414-1.414l-4.828 4.828-1.764-1.764a1 1 0 00-1.414 1.414l2.47 2.47a1 1 0 001.415 0l5.535-5.534z" clipRule="evenodd"></path></svg>
            THEBESTSNS 안전결제 시스템 가동 중
          </div>
          <p className="text-[11px] text-gray-400 font-bold">상대방이 계좌이체 등 외부 결제를 유도하면 즉시 신고해주세요.</p>
        </div>

        <div className="px-6 py-3 border-b border-gray-50 flex justify-between items-center bg-white shadow-sm">
           <div className="flex flex-col"><span className="font-black text-gray-900 text-sm italic">{chatRooms.find(r => r.id === activeChatId)?.name}님과 대화 중</span>{chatRooms.find(r => r.id === activeChatId)?.memo && (<span className="text-[10px] font-black text-blue-500 italic uppercase">Memo: {chatRooms.find(r => r.id === activeChatId)?.memo}</span>)}</div>
           <button onClick={() => toggleTrading(activeChatId)} className={`px-5 py-2 rounded-full text-[11px] font-black transition-all shadow-sm ${chatRooms.find(r => r.id === activeChatId)?.isTrading ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-blue-500'}`}>{chatRooms.find(r => r.id === activeChatId)?.isTrading ? '✓ 거래 관리 중' : '거래 상태로 변경'}</button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          {messages.map((msg, idx) => {
            const showDate = msg.dateStr !== lastDate;
            if (showDate) lastDate = msg.dateStr || "";
            const senderNickname = msg.senderId === user.id ? user.nickname : msg.senderNickname;
            const senderImage = msg.senderId === user.id ? user.profileImage : msg.senderImage;
            return (
              <React.Fragment key={msg.id}>
                {showDate && (<div className="flex justify-center my-8"><span className="bg-gray-100 text-gray-400 text-[10px] font-black px-5 py-1.5 rounded-full uppercase tracking-widest border border-gray-50">{msg.dateStr}</span></div>)}
                {msg.type === 'warning' ? (
                  <div className="flex justify-center my-6 animate-in zoom-in-95"><div className="bg-red-50 border border-red-100 text-red-500 px-8 py-5 rounded-[32px] text-[12px] font-black leading-relaxed whitespace-pre-wrap max-w-[90%] text-center shadow-sm italic">{msg.content}</div></div>
                ) : (
                  <div className={`flex gap-3 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.senderId !== user.id && msg.senderId !== 'system' && (<img src={senderImage} className="w-10 h-10 rounded-full object-cover mt-1 shadow-md border border-gray-100" alt="s" />)}
                    <div className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {msg.senderId !== user.id && msg.senderId !== 'system' && <span className="text-[12px] font-black text-gray-900 mb-1.5 px-1">{senderNickname}</span>}
                      {msg.productRef && (
                        <div className="mb-3 bg-gray-50 border border-gray-100 rounded-3xl p-4 w-full shadow-sm">
                          <div className="flex gap-4 items-center mb-3">
                            <img src={msg.productRef.thumbnail} className="w-16 h-12 object-cover rounded-xl border border-gray-100 shadow-sm" alt="p" />
                            <div className="min-w-0"><h4 className="text-[12px] font-black text-gray-900 truncate tracking-tight">{msg.productRef.title}</h4><p className="text-[13px] font-black text-blue-600 italic">₩{msg.productRef.price.toLocaleString()}</p></div>
                          </div>
                          <Link to={`/channels/${msg.productRef.id}`} className="block w-full py-2.5 bg-white border border-gray-100 text-center text-[11px] font-black text-gray-500 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm">상품 상세 바로가기</Link>
                        </div>
                      )}
                      {msg.type === 'image' && msg.imageContent && (<div className="mb-2 max-w-full group relative"><img src={msg.imageContent} className="rounded-3xl border-4 border-white shadow-xl max-h-[350px] object-contain" alt="p" /></div>)}
                      {msg.type === 'text' && (<div className={`px-5 py-3 rounded-[24px] text-[14px] font-bold shadow-sm leading-relaxed border ${msg.senderId === user.id ? 'bg-blue-600 text-white border-blue-600 rounded-tr-none' : 'bg-white text-gray-700 border-gray-100 rounded-tl-none'}`}>{msg.content}</div>)}
                      <span className="text-[9px] text-gray-300 mt-1.5 font-black uppercase italic px-1">{msg.timestamp}</span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-100 bg-white">
          <div className="bg-gray-50 border border-gray-100 rounded-[24px] p-3 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 shadow-inner">
            <textarea rows={3} placeholder="메시지를 입력하세요 (Ctrl+Enter 전송)" className="w-full p-2 outline-none text-[14px] resize-none font-bold text-gray-700 bg-transparent no-scrollbar" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSendMessage(); } }} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 px-1 mt-1">
              <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white text-gray-400 rounded-xl text-[11px] font-black hover:text-blue-500 hover:border-blue-100 transition-all border border-gray-100 shadow-sm uppercase italic">문서첨부</button>
              <button onClick={() => handleSendMessage()} className={`px-10 py-2.5 rounded-xl text-[13px] font-black transition-all shadow-xl uppercase italic tracking-widest ${input.trim() ? 'bg-blue-600 text-white hover:bg-black shadow-blue-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>메시지전송</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
