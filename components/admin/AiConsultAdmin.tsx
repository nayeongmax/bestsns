import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabase';

interface AiSession {
  id: string;
  user_id: string | null;
  user_nickname: string | null;
  started_at: string;
  updated_at: string;
  message_count: number;
}

interface AiMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

const AiConsultAdmin: React.FC = () => {
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, AiMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (expandedSessionId && !messagesBySession[expandedSessionId]) {
      loadMessages(expandedSessionId);
    }
  }, [expandedSessionId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('ai_consult_sessions')
        .select('*')
        .order('started_at', { ascending: false });

      if (filterUser.trim()) {
        q = q.or(`user_nickname.ilike.%${filterUser}%,user_id.ilike.%${filterUser}%`);
      }
      if (dateFrom) {
        q = q.gte('started_at', dateFrom);
      }
      if (dateTo) {
        q = q.lte('started_at', dateTo + 'T23:59:59');
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;
      setSessions((data as AiSession[]) || []);
    } catch (e) {
      console.error('AI 상담 세션 로드 실패:', e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_consult_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessagesBySession(prev => ({ ...prev, [sessionId]: (data as AiMessage[]) || [] }));
    } catch (e) {
      console.error('메시지 로드 실패:', e);
    }
  };

  const [allUserMessages, setAllUserMessages] = useState<string[]>([]);

  const loadAllUserMessages = async () => {
    try {
      const { data } = await supabase.from('ai_consult_messages').select('content').eq('role', 'user').limit(2000);
      setAllUserMessages((data || []).map((r: { content: string }) => r.content));
    } catch {
      setAllUserMessages([]);
    }
  };

  useEffect(() => {
    loadAllUserMessages();
  }, []);

  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((s, x) => s + x.message_count, 0);
    const userCount = new Set(sessions.map(s => s.user_id).filter(Boolean)).size;
    const guestCount = sessions.filter(s => !s.user_id).length;

    const questionCounts: Record<string, number> = {};
    allUserMessages.forEach(content => {
      const key = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      questionCounts[key] = (questionCounts[key] || 0) + 1;
    });
    const topQuestions = Object.entries(questionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const byUser: Record<string, number> = {};
    sessions.forEach(s => {
      const k = s.user_nickname || s.user_id || '(비로그인)';
      byUser[k] = (byUser[k] || 0) + 1;
    });
    const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { totalSessions, totalMessages, userCount, guestCount, topQuestions, topUsers };
  }, [sessions, allUserMessages]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-3xl font-black text-gray-900 italic uppercase underline decoration-purple-500 underline-offset-8">
          🤖 AI 상담 이력 및 통계
        </h3>
        <button onClick={() => { loadSessions(); loadAllUserMessages(); }} className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all">
          새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white p-6 rounded-[32px] border border-gray-100 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="닉네임/ID 검색"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm"
        />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm" />
        <button onClick={loadSessions} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-black text-sm">적용</button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-purple-50 p-8 rounded-[40px] border border-purple-100">
          <p className="text-[11px] font-black text-purple-500 uppercase italic mb-2">총 상담 세션</p>
          <p className="text-3xl font-black text-purple-700 italic">{stats.totalSessions.toLocaleString()}회</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-gray-100">
          <p className="text-[11px] font-black text-gray-400 uppercase italic mb-2">총 메시지</p>
          <p className="text-3xl font-black text-gray-900 italic">{stats.totalMessages.toLocaleString()}건</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-gray-100">
          <p className="text-[11px] font-black text-gray-400 uppercase italic mb-2">참여 회원 수</p>
          <p className="text-3xl font-black text-gray-900 italic">{stats.userCount}명</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-gray-100">
          <p className="text-[11px] font-black text-gray-400 uppercase italic mb-2">비로그인 세션</p>
          <p className="text-3xl font-black text-gray-900 italic">{stats.guestCount}회</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 인기 질문 Top 10 */}
        <div className="bg-white rounded-[48px] p-8 border border-gray-100 shadow-sm">
          <h4 className="text-lg font-black text-gray-900 mb-6 italic">📊 인기 질문 Top 10</h4>
          {stats.topQuestions.length === 0 ? (
            <p className="text-gray-400 font-bold italic">데이터 없음</p>
          ) : (
            <ul className="space-y-3">
              {stats.topQuestions.map(([q, cnt], i) => (
                <li key={i} className="flex gap-4 items-start">
                  <span className="bg-purple-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{q}</p>
                    <p className="text-xs text-gray-400 font-black">{cnt}회 질문</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 상담 많은 회원 Top 10 */}
        <div className="bg-white rounded-[48px] p-8 border border-gray-100 shadow-sm">
          <h4 className="text-lg font-black text-gray-900 mb-6 italic">👤 상담 이용 회원 Top 10</h4>
          {stats.topUsers.length === 0 ? (
            <p className="text-gray-400 font-bold italic">데이터 없음</p>
          ) : (
            <ul className="space-y-3">
              {stats.topUsers.map(([nick, cnt], i) => (
                <li key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="font-black text-gray-800">{nick}</span>
                  <span className="text-purple-600 font-black">{cnt}회 상담</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 상담 이력 목록 */}
      <div className="bg-white rounded-[48px] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-gray-100">
          <h4 className="text-xl font-black text-gray-900 italic">📜 상담 이력 목록</h4>
        </div>
        {loading ? (
          <div className="py-20 text-center text-gray-400 font-black">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="py-20 text-center text-gray-400 font-black italic">저장된 상담 이력이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sessions.map(s => (
              <div key={s.id} className="p-6 hover:bg-purple-50/30 transition-colors">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedSessionId(expandedSessionId === s.id ? null : s.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-black text-sm">{new Date(s.started_at).toLocaleString()}</span>
                    <span className="font-black text-gray-900">{s.user_nickname || s.user_id || '(비로그인)'}</span>
                    <span className="text-purple-500 font-black text-sm">{s.message_count}개 메시지</span>
                  </div>
                  <span className="text-2xl text-gray-300">{expandedSessionId === s.id ? '▲' : '▼'}</span>
                </div>
                {expandedSessionId === s.id && messagesBySession[s.id] && (
                  <div className="mt-6 pl-8 space-y-4 bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                    {messagesBySession[s.id].map(m => (
                      <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                          <p className="text-[10px] font-black text-gray-400 mb-1 uppercase">{m.role === 'user' ? '질문' : 'AI 응답'}</p>
                          <p className="font-bold whitespace-pre-wrap">{m.content.slice(0, 500)}{m.content.length > 500 ? '...' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiConsultAdmin;
