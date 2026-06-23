import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';

type FranchiseTab = 'members' | 'revenue' | 'manuscripts' | 'convert';

interface Props {
  user: UserProfile;
  members: UserProfile[];
  onUpdateUser?: (u: UserProfile) => void;
}

/* ══════════════════════════════════════════════
   원고시트 — 구글 시트 기본형 (자유 셀 입력)
══════════════════════════════════════════════ */

const MIN_COLS = 26;   // 초기 A~Z
const MIN_ROWS = 50;   // 초기 50행
const COL_BUF  = 5;    // 마지막 데이터 열 이후 여유 열
const ROW_BUF  = 20;   // 마지막 데이터 행 이후 여유 행

const colLabel = (c: number) => {
  let label = '';
  let n = c;
  while (n >= 0) { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; }
  return label;
};

function computeSize(data: Record<string, string>) {
  let maxR = MIN_ROWS - 1, maxC = MIN_COLS - 1;
  for (const k of Object.keys(data)) {
    const [rs, cs] = k.split(':');
    const r = Number(rs), c = Number(cs);
    if (!isNaN(r)) maxR = Math.max(maxR, r);
    if (!isNaN(c)) maxC = Math.max(maxC, c);
  }
  return { rows: maxR + ROW_BUF + 1, cols: maxC + COL_BUF + 1 };
}

const ManuscriptSheet: React.FC<{ userId: string }> = ({ userId }) => {
  const STORAGE_KEY = `franchise_sheet_${userId}`;

  const [data, setData] = useState<Record<string, string>>({});
  const [size, setSize] = useState({ rows: MIN_ROWS, cols: MIN_COLS });
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const d = JSON.parse(s) as Record<string, string>;
        setData(d);
        setSize(prev => {
          const { rows, cols } = computeSize(d);
          return { rows: Math.max(prev.rows, rows), cols: Math.max(prev.cols, cols) };
        });
      }
    } catch {}
  }, [STORAGE_KEY]);

  const persist = (d: Record<string, string>) => {
    setData(d);
    setSize(prev => {
      const { rows, cols } = computeSize(d);
      return { rows: Math.max(prev.rows, rows), cols: Math.max(prev.cols, cols) };
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
  };

  const key = (r: number, c: number) => `${r}:${c}`;
  const getVal = (r: number, c: number) => data[key(r, c)] ?? '';

  const startEdit = useCallback((r: number, c: number) => {
    setSize(prev => ({
      rows: Math.max(prev.rows, r + ROW_BUF + 1),
      cols: Math.max(prev.cols, c + COL_BUF + 1),
    }));
    setEditCell({ r, c });
    setEditValue(data[key(r, c)] ?? '');
  }, [data]);

  const commitEdit = useCallback((r: number, c: number, val: string) => {
    const next = { ...data };
    if (val) next[key(r, c)] = val; else delete next[key(r, c)];
    persist(next);
    setEditCell(null);
  }, [data]);

  // 구글 시트 붙여넣기 — TSV 파싱 후 셀에 배치
  const applyPaste = useCallback((startR: number, startC: number, text: string) => {
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
    const newData = { ...data };
    rows.forEach((rowStr, dr) => {
      rowStr.split('\t').forEach((cellVal, dc) => {
        const k = key(startR + dr, startC + dc);
        if (cellVal) newData[k] = cellVal; else delete newData[k];
      });
    });
    persist(newData);
    setEditCell(null);
  }, [data]);

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(r, c, editValue);
      if (e.shiftKey) {
        if (c > 0) startEdit(r, c - 1);
        else if (r > 0) startEdit(r - 1, size.cols - 1);
      } else {
        startEdit(r, c + 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(r, c, editValue);
      startEdit(r + 1, c);
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };

  // input 붙여넣기 — 멀티셀이면 TSV로 처리, 단일셀이면 기본 동작
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text/plain');
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
    const isMulti = lines.length > 1 || lines[0]?.includes('\t');
    if (isMulti) { e.preventDefault(); applyPaste(r, c, text); }
  };

  useEffect(() => {
    if (editCell && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editCell]);

  const activeCellLabel = editCell ? `${colLabel(editCell.c)}${editCell.r + 1}` : '';
  const colLabels = Array.from({ length: size.cols }, (_, i) => colLabel(i));

  // 컨테이너 레벨 붙여넣기 (셀 편집 중이 아닐 때)
  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editCell) return; // input이 이미 처리
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    // 마지막으로 선택했던 셀 기준 (없으면 A1)
    const startR = editCell ? (editCell as { r: number; c: number }).r : 0;
    const startC = editCell ? (editCell as { r: number; c: number }).c : 0;
    applyPaste(startR, startC, text);
  };

  return (
    <div
      className="flex flex-col"
      tabIndex={0}
      onPaste={handleContainerPaste}
      style={{ height: 'calc(100vh - 260px)', minHeight: 320, outline: 'none' }}
    >
      {/* 수식 바 */}
      <div className="flex items-center shrink-0 border-b" style={{ background: '#f8f9fa', borderColor: '#dadce0', height: 28 }}>
        <div className="flex items-center justify-center shrink-0 text-xs font-medium text-gray-600 border-r select-none"
          style={{ width: 80, borderColor: '#dadce0', height: '100%', fontSize: 12 }}>
          {activeCellLabel}
        </div>
        <div className="flex-1 px-3 text-xs text-gray-700 font-medium truncate" style={{ fontSize: 13 }}>
          {editCell ? editValue : ''}
        </div>
      </div>

      {/* 스프레드시트 본체 */}
      <div className="flex-1 overflow-auto" style={{ border: '1px solid #dadce0', borderTop: 'none' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', tableLayout: 'fixed' }}>
          {/* 컬럼 너비 */}
          <colgroup>
            <col style={{ width: 46 }} />
            {colLabels.map(l => <col key={l} style={{ width: 120 }} />)}
          </colgroup>

          {/* 헤더 행 */}
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, background: '#f8f9fa', border: '1px solid #dadce0', height: 20 }} />
              {colLabels.map(label => (
                <th key={label} style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f8f9fa', border: '1px solid #dadce0', height: 20, fontSize: 11, fontWeight: 600, color: '#444746', textAlign: 'center', userSelect: 'none', letterSpacing: '0.02em' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          {/* 데이터 행 */}
          <tbody>
            {Array.from({ length: size.rows }, (_, r) => (
              <tr key={r}>
                {/* 행 번호 */}
                <td style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8f9fa', borderRight: '1px solid #dadce0', borderBottom: '1px solid #e2e3e3', height: 21, fontSize: 11, fontWeight: 500, color: '#444746', textAlign: 'center', userSelect: 'none', minWidth: 46 }}>
                  {r + 1}
                </td>

                {/* 데이터 셀 */}
                {colLabels.map((_, c) => {
                  const isEditing = editCell?.r === r && editCell?.c === c;
                  const val = getVal(r, c);

                  return (
                    <td
                      key={c}
                      onClick={() => { if (!isEditing) startEdit(r, c); }}
                      style={{
                        height: 21,
                        padding: 0,
                        borderRight: '1px solid #e2e3e3',
                        borderBottom: '1px solid #e2e3e3',
                        background: '#fff',
                        position: 'relative',
                        cursor: 'cell',
                        ...(isEditing ? {
                          outline: '2px solid #1a73e8',
                          outlineOffset: -1,
                          zIndex: 15,
                        } : {}),
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(r, c, editValue)}
                          onKeyDown={e => handleKeyDown(e, r, c)}
                          onPaste={e => handleInputPaste(e, r, c)}
                          style={{
                            width: '100%',
                            height: '100%',
                            padding: '0 4px',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            color: '#1f1f1f',
                          }}
                        />
                      ) : (
                        /* overflow 없음 — 내용이 옆 빈 셀로 자연스럽게 넘침 */
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            padding: '0 4px',
                            fontSize: 13,
                            color: '#1f1f1f',
                            whiteSpace: 'nowrap',
                            lineHeight: '21px',
                            pointerEvents: 'none',
                          }}
                        >
                          {val}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   원고시트변환
══════════════════════════════════════════════ */
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
    case '카카오채널': return body.replace(/\n{3,}/g, '\n\n').trim();
    case '네이버블로그': return body.split(/\n{2,}/).filter(Boolean).map(p => p.trim()).join('\n\n');
    case '유튜브': return `📌 영상 설명\n\n${body.trim()}${tags ? `\n\n${tags}` : ''}`;
    default: return input;
  }
}

const PLATFORM_TIPS: Record<string, string> = {
  '인스타그램': '단락 사이에 마침표(.) 줄 추가 · 해시태그 하단 분리',
  '카카오채널': '3줄 이상 공백 → 2줄로 정리',
  '네이버블로그': '단락 간 2줄 공백으로 정리',
  '유튜브': '영상 설명 헤더 · 해시태그 섹션 자동 추가',
};

const ConvertTab: React.FC = () => {
  const [platform, setPlatform] = useState('인스타그램');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black text-gray-900">원고시트변환</h2>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setOutput(''); }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['인스타그램', '카카오채널', '네이버블로그', '유튜브'].map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400 font-bold">{PLATFORM_TIPS[platform]}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase mb-2">원본 내용</label>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder={'원고 내용을 붙여넣으세요...\n#해시태그는 # 로 시작하는 줄에 입력'}
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-gray-400 uppercase">{platform} 변환 결과</label>
            {output && <button type="button" onClick={handleCopy}
              className={`text-xs font-black ${copied ? 'text-emerald-500' : 'text-blue-600 hover:text-blue-700'}`}>
              {copied ? '✓ 복사됨' : '복사'}
            </button>}
          </div>
          <textarea value={output} readOnly placeholder="변환 버튼을 누르면 결과가 표시됩니다..."
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none focus:outline-none" />
        </div>
      </div>
      <button type="button" onClick={() => setOutput(convertManuscript(input, platform))}
        disabled={!input.trim()}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        🔄 변환하기
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점 현황 (어드민)
══════════════════════════════════════════════ */
const MembersTab: React.FC<{ members: UserProfile[]; onUpdateUser?: (u: UserProfile) => void }> = ({ members, onUpdateUser }) => {
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
    } finally { setTogglingId(null); }
  };

  const franchiseMembers = localMembers.filter(m => m.isFranchise);
  const visible = localMembers.filter(m =>
    !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">
            현재 {franchiseMembers.length}개 가맹점 활성 · 가맹점으로 선택된 회원은 가맹점패널에 접근할 수 있습니다
          </p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임·ID 검색..."
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-48" />
      </div>
      {franchiseMembers.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-black text-blue-700 mb-2">✓ 활성 가맹점</p>
          <div className="flex flex-wrap gap-2">
            {franchiseMembers.map(m => (
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
                  <th key={h} className="px-4 py-3 text-left font-black text-gray-400 uppercase whitespace-nowrap text-[11px]">{h}</th>
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
                  <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>{member.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={togglingId === member.id || member.role === 'admin'}
                      onClick={() => toggleFranchise(member)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${
                        member.isFranchise ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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

/* ══════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════ */
const FranchisePanel: React.FC<Props> = ({ user, members, onUpdateUser }) => {
  const isAdmin = user.role === 'admin' || user.id.toLowerCase() === 'admin';
  const canAccess = isAdmin || !!user.isFranchise;
  const [activeTab, setActiveTab] = useState<FranchiseTab>(isAdmin ? 'members' : 'revenue');

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
    { id: 'revenue',     label: '매출관리',    icon: '📊' },
    { id: 'manuscripts', label: '원고시트',     icon: '📝' },
    { id: 'convert',     label: '원고시트변환', icon: '🔄' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-0 md:py-6">
      {/* 탭 */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-white sticky top-14 xl:top-20 z-10">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 md:px-6 py-3.5 font-black text-sm whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.adminOnly && <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">관리자</span>}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className={activeTab === 'manuscripts' ? 'px-0' : 'px-3 md:px-4 pt-4 md:pt-6'}>
        {activeTab === 'members'     && isAdmin && <MembersTab members={members} onUpdateUser={onUpdateUser} />}
        {activeTab === 'revenue'     && <RevenueManagement user={user} />}
        {activeTab === 'manuscripts' && <ManuscriptSheet userId={user.id} />}
        {activeTab === 'convert'     && <ConvertTab />}
      </div>
    </div>
  );
};

export default FranchisePanel;
