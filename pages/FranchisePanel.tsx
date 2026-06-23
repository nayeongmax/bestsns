import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';

type FranchiseTab = 'members' | 'revenue' | 'manuscripts' | 'convert';

interface ManuscriptRow {
  id: string;
  date: string;
  client: string;
  channel: string;
  title: string;
  status: '작업전' | '진행중' | '완료' | '보류';
  deadline: string;
  notes: string;
}

interface Props {
  user: UserProfile;
  members: UserProfile[];
  onUpdateUser?: (u: UserProfile) => void;
}

const CHANNELS = ['인스타그램', '유튜브', '네이버블로그', '카카오채널', '틱톡', '트위터(X)', '기타'];

const STATUS_STYLES: Record<ManuscriptRow['status'], string> = {
  '작업전': 'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '완료': 'bg-emerald-100 text-emerald-700',
  '보류': 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM: Omit<ManuscriptRow, 'id'> = {
  date: new Date().toISOString().slice(0, 10),
  client: '',
  channel: '인스타그램',
  title: '',
  status: '작업전',
  deadline: '',
  notes: '',
};

/* ─────────────────────── 원고시트 모달 ─────────────────────── */
const ManuscriptModal: React.FC<{
  initial: Omit<ManuscriptRow, 'id'>;
  isEdit: boolean;
  onSave: (form: Omit<ManuscriptRow, 'id'>) => void;
  onClose: () => void;
}> = ({ initial, isEdit, onSave, onClose }) => {
  const [form, setForm] = useState(initial);
  const set = (key: keyof typeof form, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-black text-gray-900">{isEdit ? '행 수정' : '행 추가'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">날짜</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">마감일</label>
            <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">클라이언트</label>
          <input type="text" value={form.client} onChange={e => set('client', e.target.value)} placeholder="클라이언트명"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">채널</label>
            <select value={form.channel} onChange={e => set('channel', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">상태</label>
            <select value={form.status} onChange={e => set('status', e.target.value as ManuscriptRow['status'])}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
              {(['작업전', '진행중', '완료', '보류'] as const).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">제목</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="원고 제목"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400" />
        </div>

        <div>
          <label className="text-[11px] font-black text-gray-400 uppercase mb-1 block">비고</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="메모..." rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-black text-gray-500 hover:bg-gray-50">
            취소
          </button>
          <button type="button" onClick={() => onSave(form)}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700">
            {isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── 원고시트 테이블 ─────────────────────── */
const ManuscriptSheet: React.FC<{
  manuscripts: ManuscriptRow[];
  onAdd: (row: Omit<ManuscriptRow, 'id'>) => void;
  onUpdate: (row: ManuscriptRow) => void;
  onDelete: (id: string) => void;
}> = ({ manuscripts, onAdd, onUpdate, onDelete }) => {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ManuscriptRow | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('전체');
  const [filterChannel, setFilterChannel] = useState<string>('전체');
  const [search, setSearch] = useState('');

  const openAdd = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (row: ManuscriptRow) => { setEditTarget(row); setShowModal(true); };

  const handleSave = (form: Omit<ManuscriptRow, 'id'>) => {
    if (editTarget) onUpdate({ ...editTarget, ...form });
    else onAdd(form);
    setShowModal(false);
  };

  const exportCsv = () => {
    const header = ['No.', '날짜', '클라이언트', '채널', '제목', '상태', '마감일', '비고'];
    const rows = manuscripts.map((m, i) => [i + 1, m.date, m.client, m.channel, m.title, m.status, m.deadline, m.notes]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `원고시트_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = manuscripts.filter(m => {
    if (filterStatus !== '전체' && m.status !== filterStatus) return false;
    if (filterChannel !== '전체' && m.channel !== filterChannel) return false;
    if (search && !m.client.includes(search) && !m.title.includes(search)) return false;
    return true;
  });

  const stats = {
    total: manuscripts.length,
    done: manuscripts.filter(m => m.status === '완료').length,
    inProgress: manuscripts.filter(m => m.status === '진행중').length,
    pending: manuscripts.filter(m => m.status === '보류').length,
  };

  return (
    <div className="space-y-4">
      {/* 상단 통계 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '전체', val: stats.total, color: 'bg-gray-100 text-gray-700' },
          { label: '진행중', val: stats.inProgress, color: 'bg-blue-100 text-blue-700' },
          { label: '완료', val: stats.done, color: 'bg-emerald-100 text-emerald-700' },
          { label: '보류', val: stats.pending, color: 'bg-amber-100 text-amber-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
            <p className="text-xl font-black">{s.val}</p>
            <p className="text-[11px] font-bold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 필터 & 검색 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="클라이언트·제목 검색..."
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold focus:outline-none focus:border-blue-400 w-40" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['전체', '작업전', '진행중', '완료', '보류'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['전체', ...CHANNELS].map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={exportCsv}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-black text-gray-500 hover:bg-gray-50 transition-colors">
            CSV 내보내기
          </button>
          <button type="button" onClick={openAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors">
            + 행 추가
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['No.', '날짜', '클라이언트', '채널', '제목', '상태', '마감일', '비고', ''].map(h => (
                <th key={h} className="px-3 py-3 text-left font-black text-gray-400 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-300 font-bold">
                  {manuscripts.length === 0 ? '+ 행 추가 버튼으로 원고를 등록하세요' : '검색 결과가 없습니다'}
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr key={row.id} onClick={() => openEdit(row)}
                className="hover:bg-blue-50/30 cursor-pointer transition-colors">
                <td className="px-3 py-3 text-gray-400 font-bold">{i + 1}</td>
                <td className="px-3 py-3 text-gray-600 font-bold whitespace-nowrap">{row.date}</td>
                <td className="px-3 py-3 font-black text-gray-800 max-w-[100px] truncate">{row.client || '-'}</td>
                <td className="px-3 py-3 text-gray-500 font-bold whitespace-nowrap">{row.channel}</td>
                <td className="px-3 py-3 font-bold text-gray-700 max-w-[180px] truncate">{row.title || '-'}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 rounded-full font-black text-[11px] whitespace-nowrap ${STATUS_STYLES[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 font-bold whitespace-nowrap">{row.deadline || '-'}</td>
                <td className="px-3 py-3 text-gray-400 max-w-[120px] truncate">{row.notes || '-'}</td>
                <td className="px-3 py-3">
                  <button type="button" onClick={e => { e.stopPropagation(); onDelete(row.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors font-black text-sm px-1">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ManuscriptModal
          initial={editTarget ? { date: editTarget.date, client: editTarget.client, channel: editTarget.channel, title: editTarget.title, status: editTarget.status, deadline: editTarget.deadline, notes: editTarget.notes } : EMPTY_FORM}
          isEdit={!!editTarget}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

/* ─────────────────────── 원고시트변환 ─────────────────────── */
function convertManuscript(input: string, platform: string): string {
  const lines = input.trim().split('\n');
  const hashLines = lines.filter(l => l.trim().startsWith('#'));
  const bodyLines = lines.filter(l => !l.trim().startsWith('#'));
  const body = bodyLines.join('\n');
  const tags = hashLines.join(' ');

  switch (platform) {
    case '인스타그램': {
      const paras = body.split(/\n{2,}/).filter(Boolean).map(p => p.trim());
      return paras.join('\n.\n') + (tags ? `\n.\n\n${tags}` : '');
    }
    case '카카오채널':
      return body.replace(/\n{3,}/g, '\n\n').trim();
    case '네이버블로그': {
      const paras = body.split(/\n{2,}/).filter(Boolean).map(p => p.trim());
      return paras.join('\n\n');
    }
    case '유튜브':
      return `📌 영상 설명\n\n${body.trim()}${tags ? `\n\n${tags}` : ''}`;
    default:
      return input;
  }
}

const PLATFORM_TIPS: Record<string, string> = {
  '인스타그램': '단락 사이에 마침표(.) 줄을 추가하고, 해시태그를 하단에 분리합니다.',
  '카카오채널': '3줄 이상의 공백을 2줄로 정리합니다.',
  '네이버블로그': '단락 간 2줄 공백으로 정리합니다.',
  '유튜브': '영상 설명 헤더와 해시태그 섹션을 자동 추가합니다.',
};

const ConvertTab: React.FC = () => {
  const [platform, setPlatform] = useState('인스타그램');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleConvert = () => setOutput(convertManuscript(input, platform));
  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black text-gray-900">원고시트변환</h2>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setOutput(''); }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['인스타그램', '카카오채널', '네이버블로그', '유튜브'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-400 font-bold">{PLATFORM_TIPS[platform]}</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase mb-2">원본 내용</label>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder={'원고 내용을 붙여넣으세요...\n해시태그는 # 로 시작하는 줄에 입력하세요.'}
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-gray-400 uppercase">{platform} 변환 결과</label>
            {output && (
              <button type="button" onClick={handleCopy}
                className={`text-xs font-black transition-colors ${copied ? 'text-emerald-500' : 'text-blue-600 hover:text-blue-700'}`}>
                {copied ? '✓ 복사됨' : '복사'}
              </button>
            )}
          </div>
          <textarea value={output} readOnly
            placeholder="변환 버튼을 누르면 결과가 표시됩니다..."
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none focus:outline-none"
          />
        </div>
      </div>

      <button type="button" onClick={handleConvert}
        disabled={!input.trim()}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        🔄 변환하기
      </button>
    </div>
  );
};

/* ─────────────────────── 가맹점 현황 (어드민) ─────────────────────── */
const MembersTab: React.FC<{
  members: UserProfile[];
  onUpdateUser?: (u: UserProfile) => void;
}> = ({ members, onUpdateUser }) => {
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);

  useEffect(() => { setLocalMembers(members); }, [members]);

  const toggleFranchise = async (member: UserProfile) => {
    setTogglingId(member.id);
    try {
      const newVal = !member.isFranchise;
      const { error } = await supabase.from('profiles').update({ is_franchise: newVal, updated_at: new Date().toISOString() }).eq('id', member.id);
      if (!error) {
        const updated = { ...member, isFranchise: newVal };
        setLocalMembers(prev => prev.map(m => m.id === member.id ? updated : m));
        if (onUpdateUser) onUpdateUser(updated);
      }
    } finally {
      setTogglingId(null);
    }
  };

  const franchiseCount = localMembers.filter(m => m.isFranchise).length;
  const visible = localMembers.filter(m =>
    !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">현재 {franchiseCount}개 가맹점 활성화</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임·ID 검색..."
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-48" />
      </div>

      {franchiseCount > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-black text-blue-700 mb-2">활성 가맹점</p>
          <div className="flex flex-wrap gap-2">
            {localMembers.filter(m => m.isFranchise).map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-3 py-1">
                <img src={m.profileImage} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span className="text-xs font-black text-blue-800">{m.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['회원', 'ID', '이메일', '등급', '가맹점 여부'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-black text-gray-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.slice(0, 100).map(member => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={member.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" />
                      <span className="font-black text-gray-900 whitespace-nowrap">{member.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{member.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button"
                      disabled={togglingId === member.id || member.role === 'admin'}
                      onClick={() => toggleFranchise(member)}
                      className={`px-3 py-1.5 rounded-lg font-black transition-all disabled:opacity-40 ${
                        member.isFranchise
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}>
                      {togglingId === member.id ? '...' : member.isFranchise ? '✓ 가맹점' : '가맹점 선택'}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-300 font-bold">검색 결과 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── 메인 컴포넌트 ─────────────────────── */
const FranchisePanel: React.FC<Props> = ({ user, members, onUpdateUser }) => {
  const isAdmin = user.role === 'admin' || user.id.toLowerCase() === 'admin';
  const canAccess = isAdmin || !!user.isFranchise;

  const [activeTab, setActiveTab] = useState<FranchiseTab>(isAdmin ? 'members' : 'revenue');
  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const STORAGE_KEY = `franchise_manuscripts_${user.id}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setManuscripts(JSON.parse(saved));
    } catch {}
  }, [STORAGE_KEY]);

  const saveManuscripts = (rows: ManuscriptRow[]) => {
    setManuscripts(rows);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch {}
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-lg font-black text-gray-800 mb-2">접근 권한이 없습니다</h2>
        <p className="text-sm text-gray-400 font-bold">가맹점 패널은 가맹점 파트너만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const tabs: { id: FranchiseTab; label: string; icon: string; adminOnly?: boolean }[] = [
    ...(isAdmin ? [{ id: 'members' as FranchiseTab, label: '가맹점 현황', icon: '🏢', adminOnly: true }] : []),
    { id: 'revenue', label: '매출관리', icon: '📊' },
    { id: 'manuscripts', label: '원고시트', icon: '📝' },
    { id: 'convert', label: '원고시트변환', icon: '🔄' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-0 md:py-6">
      {/* 상단 탭 */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-white sticky top-14 xl:top-20 z-10">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 md:px-6 py-3.5 font-black text-sm whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.adminOnly && (
              <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">관리자</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="px-3 md:px-4 pt-4 md:pt-6">
        {activeTab === 'members' && isAdmin && (
          <MembersTab members={members} onUpdateUser={onUpdateUser} />
        )}

        {activeTab === 'revenue' && (
          <RevenueManagement user={user} />
        )}

        {activeTab === 'manuscripts' && (
          <ManuscriptSheet
            manuscripts={manuscripts}
            onAdd={row => saveManuscripts([...manuscripts, { ...row, id: Date.now().toString() }])}
            onUpdate={row => saveManuscripts(manuscripts.map(m => m.id === row.id ? row : m))}
            onDelete={id => saveManuscripts(manuscripts.filter(m => m.id !== id))}
          />
        )}

        {activeTab === 'convert' && <ConvertTab />}
      </div>
    </div>
  );
};

export default FranchisePanel;
