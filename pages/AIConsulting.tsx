import React, { useState, useRef, useEffect } from 'react';
import { getMarketingConsultation } from '../services/geminiService';
import { supabase } from '../supabase';
import type { UserProfile } from '@/types';

/** 마크다운 형식 텍스트를 가독성 있게 렌더링 (추가 의존성 없음) */
function formatAiText(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const formatInline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let rest = s;
    let key = 0;
    while (rest.length) {
      const m = rest.match(/\*\*(.+?)\*\*/);
      if (m && m.index !== undefined) {
        if (m.index > 0) parts.push(<span key={key++}>{rest.slice(0, m.index)}</span>);
        parts.push(<strong key={key++} className="font-bold text-gray-800">{m[1]}</strong>);
        rest = rest.slice(m.index + m[0].length);
      } else {
        parts.push(<span key={key++}>{rest}</span>);
        break;
      }
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };
  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length) {
      out.push(<ul key={out.length} className="list-disc list-inside mb-3 space-y-1.5">{listItems.map((item, i) => <li key={i} className="ml-1">{formatInline(item)}</li>)}</ul>);
      listItems = [];
    }
  };
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushList(); continue; }
    if (t.startsWith('### ')) { flushList(); out.push(<h3 key={out.length} className="font-bold text-gray-900 mt-4 mb-2 text-[15px] block">{formatInline(t.slice(4))}</h3>); continue; }
    if (t.startsWith('## ')) { flushList(); out.push(<h2 key={out.length} className="font-bold text-gray-900 mt-4 mb-2 text-base block border-b border-gray-200 pb-1">{formatInline(t.slice(3))}</h2>); continue; }
    if (t.startsWith('- ') || t.startsWith('* ')) { listItems.push(t.slice(2)); continue; }
    if (/^\d+\.\s/.test(t)) { listItems.push(t.replace(/^\d+\.\s+/, '')); continue; }
    flushList();
    out.push(<p key={out.length} className="mb-3">{formatInline(t)}</p>);
  }
  flushList();
  return out;
}

interface Props {
  user?: UserProfile | null;
}

const AIConsulting: React.FC<Props> = ({ user }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isLoading]);

  const saveToDb = async (sessionId: string, role: 'user' | 'bot', content: string) => {
    try {
      const msgId = `aim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await supabase.from('ai_consult_messages').insert({ id: msgId, session_id: sessionId, role, content });
      const { data: s } = await supabase.from('ai_consult_sessions').select('message_count').eq('id', sessionId).single();
      const cnt = ((s as { message_count?: number })?.message_count ?? 0) + 1;
      await supabase.from('ai_consult_sessions').update({ message_count: cnt, updated_at: new Date().toISOString() }).eq('id', sessionId);
    } catch (e) {
      console.warn('AI 상담 DB 저장 실패:', e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    let sessionId = currentSessionId;
    if (user && !sessionId) {
      try {
        const sid = `ais_${Date.now()}`;
        await supabase.from('ai_consult_sessions').insert({
          id: sid,
          user_id: user.id,
          user_nickname: user.nickname,
          message_count: 0,
        });
        sessionId = sid;
        setCurrentSessionId(sid);
      } catch (e) {
        console.warn('AI 세션 생성 실패:', e);
      }
    }

    if (user && sessionId) saveToDb(sessionId, 'user', userText);

    const botReply = await getMarketingConsultation(userText);
    setMessages(prev => [...prev, { role: 'bot', text: botReply }]);

    if (user && sessionId) saveToDb(sessionId, 'bot', botReply);

    setIsLoading(false);
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentSessionId(null);
  };

  const suggestions = [
    '인스타그램 릴스 조회수 올리는 법',
    '유튜브 채널 초기 성장 전략',
    '틱톡 바이럴 영상 특징',
    '효과적인 마케팅 문구 작성'
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-20 sm:pb-24">
      <div className="h-[75vh] min-h-[400px] sm:h-[78vh] md:h-[80vh] bg-white rounded-2xl sm:rounded-3xl md:rounded-[48px] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
      <div className="p-4 sm:p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl shadow-lg shadow-blue-100">🤖</div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight">THEBEST AI 마케팅 컨설턴트</h2>
            <p className="text-[10px] sm:text-[11px] text-green-500 font-bold flex items-center gap-1.5 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span> Online & Ready to Help
            </p>
          </div>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs font-black text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
        >
          대화 초기화
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 space-y-4 sm:space-y-6 md:space-y-8 bg-slate-50" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-10 sm:py-16 md:py-20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-2xl sm:rounded-[32px] shadow-xl flex items-center justify-center mb-6 sm:mb-10 transform rotate-3 hover:rotate-0 transition-transform">
              <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"></path></svg>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3 sm:mb-4 italic tracking-tight">무엇이든 물어보세요!</h3>
            <p className="text-xs sm:text-sm text-gray-400 font-bold mb-8 sm:mb-12 leading-relaxed px-2">콘텐츠 기획, 플랫폼 성장 전략, 광고 카피 작성 등<br/>마케팅과 관련한 최고의 솔루션을 제안해 드립니다.</p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-4 py-2.5 sm:px-6 sm:py-3 bg-white border border-gray-200 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm hover:shadow-md"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] sm:max-w-[80%] md:max-w-[70%] px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5 rounded-2xl sm:rounded-[32px] text-[13px] sm:text-[15px] shadow-sm leading-relaxed overflow-hidden ${
              m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none font-bold' : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
            }`}>
              {m.role === 'user' ? (
                m.text
              ) : (
                <div className="ai-response">
                  {formatAiText(m.text)}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4 rounded-xl sm:rounded-[24px] flex gap-2">
              <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 md:p-8 bg-white border-t border-gray-100">
        <div className="relative bg-slate-50 rounded-xl sm:rounded-2xl md:rounded-[32px] border-2 border-transparent focus-within:border-blue-500 focus-within:bg-white p-2 sm:p-3 flex items-center transition-all shadow-inner">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="마케팅 전략에 대해 물어보세요..."
            className="flex-1 px-3 py-2.5 sm:px-6 sm:py-3 outline-none text-[13px] sm:text-[15px] font-bold bg-transparent min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl hover:bg-blue-700 disabled:bg-gray-200 transition-all shadow-lg shadow-blue-100 shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};

export default AIConsulting;
