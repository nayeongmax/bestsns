
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { UserProfile, ChatMessage, ChannelProduct, NotificationType } from '../types';
import { supabase } from '@/supabase';

interface Props {
  user: UserProfile;
  members: UserProfile[];
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
  otherParticipantId: string;
  name: string;
  otherImage: string;
  lastMsg: string;
  lastMsgTime: string;
  isTrading: boolean;
  isFavorite: boolean;
  online: boolean;
  memo?: string;
}

const CHAT_META_KEY = 'chat_room_meta_v2';
const CHAT_ROOMS_FALLBACK_KEY = (userId: string) => `chat_rooms_fallback_${userId}`;
const PROHIBITED_KEYWORDS = ['휴대폰', '폰번호', '직거래', '계좌', '이체', '010', '전화번호', '카톡', '연락처', '입금', '현금', '계좌번호', '따로'];
const DIRECT_TRADE_WARNING = '직접 거래 시도는 약관에 따라 거래액 10배의 위약벌 대상이 될 수 있습니다. 모든 거래는 플랫폼을 통해야 안전하게 보호받습니다.';

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

function getRoomId(a: string, b: string): string {
  return [a.trim(), b.trim()].sort().join('_');
}

function getOtherParticipantId(roomId: string, myId: string): string {
  const parts = roomId.split('_');
  const other = parts.find(p => p !== myId);
  return other || parts[0] || '';
}

type PendingTargetUser = { id: string; nickname: string; profileImage?: string };

const ChatPage: React.FC<Props> = ({ user, members, onResetUnread, addNotif }) => {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessageExtended[]>([]);
  const [input, setInput] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [violationCount, setViolationCount] = useState(Number(localStorage.getItem(`violation_${user.id}`) || '0'));
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [useSupabase, setUseSupabase] = useState(true);

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [tempMemoValue, setTempMemoValue] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMeta = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_META_KEY) || '{}') as Record<string, { memo?: string; isTrading?: boolean; isFavorite?: boolean }>;
    } catch {
      return {};
    }
  }, []);

  const setMeta = useCallback((roomId: string, patch: { memo?: string; isTrading?: boolean; isFavorite?: boolean }) => {
    const meta = getMeta();
    meta[roomId] = { ...meta[roomId], ...patch };
    localStorage.setItem(CHAT_META_KEY, JSON.stringify(meta));
  }, [getMeta]);

  /** 문의하기/채팅하기로 진입 시: 대상 대화방을 만들고 선택해 오른쪽에서 바로 채팅 가능하게 함 */
  const ensureTargetRoom = useCallback((pendingTargetUser: PendingTargetUser, existingRooms: ChatRoom[]) => {
    if (!pendingTargetUser?.id || pendingTargetUser.id === user.id) return existingRooms;
    const roomId = getRoomId(user.id, pendingTargetUser.id);
    if (existingRooms.some(r => r.id === roomId)) return existingRooms;
    const meta = getMeta();
    const roomMeta = meta[roomId] || {};
    const newRoom: ChatRoom = {
      id: roomId,
      otherParticipantId: pendingTargetUser.id,
      name: pendingTargetUser.nickname,
      otherImage: pendingTargetUser.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pendingTargetUser.id}`,
      lastMsg: '',
      lastMsgTime: new Date().toISOString(),
      isTrading: roomMeta.isTrading ?? false,
      isFavorite: roomMeta.isFavorite ?? false,
      online: false,
      memo: roomMeta.memo,
    };
    return [newRoom, ...existingRooms];
  }, [user.id, getMeta]);

  const loadRooms = useCallback(async (navState?: { targetUser?: PendingTargetUser }) => {
    setLoadingRooms(true);
    const meta = getMeta();
    const pendingTargetUser = navState?.targetUser;
    try {
      const { data: rows, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`room_id.like.${user.id}_%,room_id.like.%_${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const byRoom = new Map<string, { content: string; created_at: string; sender_nickname: string; sender_image: string | null }>();
      (rows || []).forEach((r: any) => {
        if (!byRoom.has(r.room_id)) {
          byRoom.set(r.room_id, {
            content: r.content,
            created_at: r.created_at,
            sender_nickname: r.sender_nickname,
            sender_image: r.sender_image,
          });
        }
      });

      let rooms: ChatRoom[] = [];
      byRoom.forEach((last, roomId) => {
        const otherId = getOtherParticipantId(roomId, user.id);
        if (!otherId) return;
        const member = members.find(m => m.id === otherId);
        const roomMeta = meta[roomId] || {};
        rooms.push({
          id: roomId,
          otherParticipantId: otherId,
          name: member?.nickname || last.sender_nickname || otherId,
          otherImage: member?.profileImage || last.sender_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`,
          lastMsg: last.content || '',
          lastMsgTime: last.created_at,
          isTrading: roomMeta.isTrading ?? false,
          isFavorite: roomMeta.isFavorite ?? false,
          online: false,
          memo: roomMeta.memo,
        });
      });
      rooms.sort((a, b) => new Date(b.lastMsgTime).getTime() - new Date(a.lastMsgTime).getTime());

      // 문의하기/채팅하기 진입: 판매자·상품등록자·프리랜서 신청자 대화방이 없으면 생성 후 선택 → 오른쪽에서 바로 채팅 가능
      rooms = ensureTargetRoom(pendingTargetUser || { id: '', nickname: '', profileImage: '' }, rooms);
      if (pendingTargetUser?.id && pendingTargetUser.id !== user.id) {
        const roomId = getRoomId(user.id, pendingTargetUser.id);
        setChatRooms(rooms);
        setActiveChatId(roomId);
      } else {
        setChatRooms(rooms);
        setActiveChatId(prev => (prev && rooms.some(r => r.id === prev)) ? prev : (rooms.length > 0 ? rooms[0].id : null));
      }
    } catch {
      setUseSupabase(false);
      // Supabase 실패해도 문의하기로 들어온 경우: 해당 대상과의 대화방을 만들고 선택해 오른쪽에서 채팅 가능하게 함
      let rooms: ChatRoom[] = [];
      try {
        const raw = localStorage.getItem(CHAT_ROOMS_FALLBACK_KEY(user.id));
        if (raw) rooms = JSON.parse(raw) as ChatRoom[];
      } catch { /* ignore */ }
      if (pendingTargetUser?.id && pendingTargetUser.id !== user.id) {
        rooms = ensureTargetRoom(pendingTargetUser, rooms);
        const roomId = getRoomId(user.id, pendingTargetUser.id);
        setChatRooms(rooms);
        setActiveChatId(roomId);
      } else {
        setChatRooms(rooms);
        setActiveChatId(rooms.length > 0 ? rooms[0].id : null);
      }
      try {
        localStorage.setItem(CHAT_ROOMS_FALLBACK_KEY(user.id), JSON.stringify(rooms));
      } catch { /* ignore */ }
    } finally {
      setLoadingRooms(false);
    }
  }, [user.id, members, getMeta, ensureTargetRoom]);

  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) { setMessages([]); return; }
    setLoadingMessages(true);
    try {
      const { data: rows, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const list: ChatMessageExtended[] = (rows || []).map((r: any) => {
        const d = new Date(r.created_at);
        return {
          id: r.id,
          senderId: r.sender_id,
          senderNickname: r.sender_nickname,
          senderImage: r.sender_image || '',
          content: r.content,
          timestamp: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, ''),
          type: (r.type === 'image' ? 'image' : 'text') as 'text' | 'image',
          imageContent: r.image_content,
        };
      });
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { if (onResetUnread) onResetUnread(); }, [onResetUnread]);

  // 채팅 페이지 접속 시 presence로 온라인 표시 (상대방 접속 여부)
  useEffect(() => {
    const channel = supabase.channel('chat_presence');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, { user_id?: string }[]>;
        const ids = new Set<string>();
        Object.values(state).forEach((payloads) => {
          payloads.forEach((p) => {
            if (p.user_id && p.user_id !== user.id) ids.add(p.user_id);
          });
        });
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, updated_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const navState = (location.state as { targetUser?: PendingTargetUser } | null) || undefined;
  const pendingTargetFromNav = navState?.targetUser;

  useEffect(() => {
    loadRooms(navState);
  }, [user.id, loadRooms, location.pathname, location.key]);

  // 문의하기/채팅하기로 진입했는데 아직 대화방이 선택되지 않은 경우(로딩 직후 등): 대상 방을 만들어 선택 → 오른쪽에서 바로 채팅 가능
  useEffect(() => {
    if (loadingRooms || !pendingTargetFromNav?.id || pendingTargetFromNav.id === user.id) return;
    const roomId = getRoomId(user.id, pendingTargetFromNav.id);
    if (activeChatId === roomId) return;
    if (chatRooms.some(r => r.id === roomId)) {
      setActiveChatId(roomId);
      return;
    }
    const rooms = ensureTargetRoom(pendingTargetFromNav, chatRooms);
    setChatRooms(rooms);
    setActiveChatId(roomId);
  }, [loadingRooms, pendingTargetFromNav, user.id, activeChatId, chatRooms, ensureTargetRoom]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
    else setMessages([]);
  }, [activeChatId, loadMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSendMessage = async (customContent?: string, type: 'text' | 'image' = 'text', imageContent?: string) => {
    const textToSubmit = customContent ?? input;
    if (!textToSubmit.trim() && type === 'text') return;
    if (!activeChatId) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '');
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (type === 'text') {
      const detected = PROHIBITED_KEYWORDS.filter(word => textToSubmit.includes(word));
      if (detected.length > 0) {
        const newCount = violationCount + 1;
        setViolationCount(newCount);
        localStorage.setItem(`violation_${user.id}`, newCount.toString());
        addNotif(user.id, 'prohibited', '🚨 금지 키워드 감지 경고', DIRECT_TRADE_WARNING);
        alert(DIRECT_TRADE_WARNING);
        const warningMsg: ChatMessageExtended = {
          id: `warn_${Date.now()}`, senderId: 'system', senderNickname: 'THEBESTSNS 보안팀', senderImage: '',
          content: `🚨 ${DIRECT_TRADE_WARNING}\n(감지된 키워드: [${detected.join(', ')}])\n(현재 누적 위반: ${newCount}회)`,
          timestamp, dateStr: todayStr, type: 'warning',
        };
        setMessages(prev => [...prev, warningMsg]);
        setInput('');
        return;
      }
    }

    if (useSupabase) {
      try {
        const { error } = await supabase.from('chat_messages').insert({
          room_id: activeChatId,
          sender_id: user.id,
          sender_nickname: user.nickname,
          sender_image: user.profileImage || '',
          content: textToSubmit,
          type,
          image_content: imageContent || null,
        });
        if (error) throw error;
        loadMessages(activeChatId);
        loadRooms();
        const otherId = getOtherParticipantId(activeChatId, user.id);
        if (otherId) addNotif(otherId, 'chat', '💬 새 메시지', `${user.nickname}님으로부터 메시지가 도착했습니다.`);
      } catch {
        setMessages(prev => [...prev, {
          id: `msg${Date.now()}`, senderId: user.id, senderNickname: user.nickname, senderImage: user.profileImage || '',
          content: textToSubmit, timestamp, dateStr: todayStr, type, imageContent,
        }]);
        loadRooms();
      }
    } else {
      const newMessage: ChatMessageExtended = {
        id: `msg${Date.now()}`, senderId: user.id, senderNickname: user.nickname, senderImage: user.profileImage || '',
        content: textToSubmit, timestamp, dateStr: todayStr, type, imageContent,
      };
      setMessages(prev => [...prev, newMessage]);
      loadRooms();
    }
    if (!customContent) setInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = (file.type || '').startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => handleSendMessage('이미지를 전송했습니다.', 'image', reader.result as string);
      reader.readAsDataURL(file);
    } else {
      handleSendMessage(`[문서 첨부: ${file.name}] (문서 파일)`, 'text');
    }
    e.target.value = '';
  };

  const handleSaveMemo = (id: string) => {
    setMeta(id, { memo: tempMemoValue });
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, memo: tempMemoValue } : room));
    setEditingMemoId(null);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const room = chatRooms.find(r => r.id === id);
    const next = !room?.isFavorite;
    setMeta(id, { isFavorite: next });
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, isFavorite: next } : room));
  };

  const toggleTrading = (id: string) => {
    const room = chatRooms.find(r => r.id === id);
    const next = !room?.isTrading;
    setMeta(id, { isTrading: next });
    setChatRooms(prev => prev.map(room => room.id === id ? { ...room, isTrading: next } : room));
  };

  const filteredRooms = chatRooms.filter(room => {
    if (activeFilter === '거래 중') return room.isTrading;
    if (activeFilter === '즐겨찾기') return room.isFavorite;
    return true;
  });

  const activeRoom = activeChatId ? chatRooms.find(r => r.id === activeChatId) : null;

  let lastDate = '';

  return (
    <div className="max-w-6xl mx-auto h-[85vh] flex bg-[#F8F9FA] border border-gray-200 shadow-sm overflow-hidden rounded-lg">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} />

      <div className="w-[340px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['전체', '거래 중', '즐겨찾기'].map(filter => (
              <button key={filter} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[12px] font-bold transition-all border ${activeFilter === filter ? 'bg-[#303441] text-white border-[#303441]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{filter}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="text-center py-20 text-gray-400 font-bold text-sm">대화 목록 불러오는 중...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-20 text-gray-300 font-bold text-sm px-4">대화방이 없습니다.<br /><span className="text-[11px] text-gray-500 block mt-2">채널·전자책·프리랜서 작업 등에서 &quot;문의하기&quot;/&quot;채팅하기&quot;로 판매자·운영자·신청자와 대화를 시작하세요. 채팅 이력은 CS 참고를 위해 삭제되지 않습니다.</span></div>
          ) : (
            filteredRooms.map(u => {
              const isOnline = onlineUserIds.has(u.otherParticipantId);
              return (
              <div key={u.id} onClick={() => setActiveChatId(u.id)} className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 relative ${activeChatId === u.id ? 'bg-[#F0F2F5]' : u.memo ? 'bg-blue-50/20' : ''}`}>
                <div className="relative shrink-0">
                  <img src={u.otherImage} className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm" alt="" />
                  <div className={`absolute bottom-0.5 right-0.5 w-4 h-4 border-2 border-white rounded-full shadow-sm ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} title={isOnline ? '접속 중' : '오프라인'} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-0.5"><span className="font-black text-[14.5px] text-gray-900 truncate leading-none">{u.name}</span><span className="text-[10px] font-bold text-gray-400 shrink-0">{formatRelativeTime(u.lastMsgTime)}</span></div>
                  <div className="mb-1">
                    {editingMemoId === u.id ? (
                      <input autoFocus value={tempMemoValue} onChange={e => setTempMemoValue(e.target.value)} onBlur={() => handleSaveMemo(u.id)} onKeyDown={e => e.key === 'Enter' && handleSaveMemo(u.id)} onClick={e => e.stopPropagation()} className="w-full text-[11px] font-black text-blue-600 bg-white border border-blue-200 px-1.5 py-0.5 rounded outline-none shadow-sm" placeholder="메모 입력..." />
                    ) : (
                      <div onClick={e => { e.stopPropagation(); setEditingMemoId(u.id); setTempMemoValue(u.memo || ''); }} className={`text-[11px] font-black italic truncate cursor-text hover:text-blue-500 transition-colors ${u.memo ? 'text-blue-500' : 'text-gray-300'}`}>{u.memo ? `📝 ${u.memo}` : '+ 관리 메모 추가'}</div>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-500 truncate leading-tight opacity-70">{u.lastMsg || '메시지 없음'}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-1">{u.isTrading && <span className="bg-[#E6F7F0] text-[#00B06B] text-[9px] px-1.5 py-0.5 rounded font-black italic">거래 중</span>}</div>
                    <button onClick={e => toggleFavorite(u.id, e)} className={`transition-colors ${u.isFavorite ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400'}`} title={u.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 flex flex-col items-center bg-[#F9FBFF]">
          <div className="text-[12px] text-gray-500 font-black flex items-center gap-1.5 mb-1.5 uppercase italic">
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm9.496 3.036a1 1 0 00-1.414-1.414l-4.828 4.828-1.764-1.764a1 1 0 00-1.414 1.414l2.47 2.47a1 1 0 001.415 0l5.535-5.534z" clipRule="evenodd" /></svg>
            THEBESTSNS 안전결제 시스템 가동 중
          </div>
          <p className="text-[11px] text-gray-400 font-bold">상대방이 계좌이체 등 외부 결제를 유도하면 즉시 신고해주세요.</p>
        </div>

        <div className="px-6 py-3 border-b border-gray-50 flex justify-between items-center bg-white shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-gray-900 text-sm italic">{activeRoom ? `${activeRoom.name}님과 대화 중` : '대화를 선택하세요'}</span>
              {activeRoom && onlineUserIds.has(activeRoom.otherParticipantId) && (
                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">접속 중</span>
              )}
            </div>
            {activeRoom?.memo && <span className="text-[10px] font-black text-blue-500 italic uppercase">Memo: {activeRoom.memo}</span>}
          </div>
          {activeChatId && (
            <button onClick={() => toggleTrading(activeChatId)} className={`px-5 py-2 rounded-full text-[11px] font-black transition-all shadow-sm ${activeRoom?.isTrading ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:text-blue-500'}`}>{activeRoom?.isTrading ? '✓ 거래 관리 중' : '거래 상태로 변경'}</button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          {loadingMessages ? (
            <div className="text-center py-20 text-gray-400 font-bold text-sm">메시지 불러오는 중...</div>
          ) : !activeChatId ? (
            <div className="text-center py-20 text-gray-300 font-bold text-sm">왼쪽에서 대화방을 선택하세요.<br /><span className="text-[11px] text-gray-500 block mt-2">채널·전자책·프리랜서 작업 등에서 문의하기/채팅하기로 판매자·운영자·신청자와 대화를 시작할 수 있습니다.</span></div>
          ) : (
            messages.map(msg => {
              const showDate = msg.dateStr !== lastDate;
              if (showDate) lastDate = msg.dateStr || '';
              const senderNickname = msg.senderId === user.id ? user.nickname : msg.senderNickname;
              const senderImage = msg.senderId === user.id ? user.profileImage : msg.senderImage;
              return (
                <React.Fragment key={msg.id}>
                  {showDate && <div className="flex justify-center my-8"><span className="bg-gray-100 text-gray-400 text-[10px] font-black px-5 py-1.5 rounded-full uppercase tracking-widest border border-gray-50">{msg.dateStr}</span></div>}
                  {msg.type === 'warning' ? (
                    <div className="flex justify-center my-6 animate-in zoom-in-95"><div className="bg-red-50 border border-red-100 text-red-500 px-8 py-5 rounded-[32px] text-[12px] font-black leading-relaxed whitespace-pre-wrap max-w-[90%] text-center shadow-sm italic">{msg.content}</div></div>
                  ) : (
                    <div className={`flex gap-3 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.senderId !== user.id && msg.senderId !== 'system' && <img src={senderImage} className="w-10 h-10 rounded-full object-cover mt-1 shadow-md border border-gray-100" alt="" />}
                      <div className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        {msg.senderId !== user.id && msg.senderId !== 'system' && <span className="text-[12px] font-black text-gray-900 mb-1.5 px-1">{senderNickname}</span>}
                        {msg.productRef && (
                          <div className="mb-3 bg-gray-50 border border-gray-100 rounded-3xl p-4 w-full shadow-sm">
                            <div className="flex gap-4 items-center mb-3">
                              <img src={msg.productRef.thumbnail} className="w-16 h-12 object-cover rounded-xl border border-gray-100 shadow-sm" alt="" />
                              <div className="min-w-0"><h4 className="text-[12px] font-black text-gray-900 truncate tracking-tight">{msg.productRef.title}</h4><p className="text-[13px] font-black text-blue-600 italic">₩{msg.productRef.price?.toLocaleString()}</p></div>
                            </div>
                            <Link to={`/channels/${msg.productRef.id}`} className="block w-full py-2.5 bg-white border border-gray-100 text-center text-[11px] font-black text-gray-500 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-sm">상품 상세 바로가기</Link>
                          </div>
                        )}
                        {msg.type === 'image' && msg.imageContent && <div className="mb-2 max-w-full"><img src={msg.imageContent} className="rounded-3xl border-4 border-white shadow-xl max-h-[350px] object-contain" alt="" /></div>}
                        {msg.type === 'text' && <div className={`px-5 py-3 rounded-[24px] text-[14px] font-bold shadow-sm leading-relaxed border ${msg.senderId === user.id ? 'bg-blue-600 text-white border-blue-600 rounded-tr-none' : 'bg-white text-gray-700 border-gray-100 rounded-tl-none'}`}>{msg.content}</div>}
                        <span className="text-[9px] text-gray-300 mt-1.5 font-black uppercase italic px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="p-5 border-t border-gray-100 bg-white">
          <div className="bg-gray-50 border border-gray-100 rounded-[24px] p-3 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 shadow-inner">
            <textarea rows={3} placeholder="메시지를 입력하세요 (Ctrl+Enter 전송)" className="w-full p-2 outline-none text-[14px] resize-none font-bold text-gray-700 bg-transparent no-scrollbar" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSendMessage(); } }} disabled={!activeChatId} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 px-1 mt-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white text-gray-400 rounded-xl text-[11px] font-black hover:text-blue-500 hover:border-blue-100 transition-all border border-gray-100 shadow-sm uppercase italic disabled:opacity-50 disabled:cursor-not-allowed" disabled={!activeChatId} title="이미지·문서 첨부 (이미지/PDF 등)">이미지·문서 첨부</button>
              <button type="button" onClick={() => handleSendMessage()} className={`px-10 py-2.5 rounded-xl text-[13px] font-black transition-all shadow-xl uppercase italic tracking-widest ${input.trim() && activeChatId ? 'bg-blue-600 text-white hover:bg-black shadow-blue-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} disabled={!activeChatId}>메시지전송</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
