import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/* ══════════════════════════════════════════════
   원고시트 — 구글 시트 스타일 스프레드시트
══════════════════════════════════════════════ */

type ColKey = keyof Omit<ManuscriptRow, 'id'>;

interface ColDef {
  key: ColKey;
  label: string;
  minW: number;
  type: 'text' | 'date' | 'select';
  options?: string[];
}

const COLS: ColDef[] = [
  { key: 'date',     label: '날짜',       minW: 112, type: 'date' },
  { key: 'client',   label: '클라이언트', minW: 128, type: 'text' },
  { key: 'channel',  label: '채널',       minW: 124, type: 'select', options: CHANNELS },
  { key: 'title',    label: '제목',       minW: 220, type: 'text' },
  { key: 'status',   label: '상태',       minW: 90,  type: 'select', options: ['작업전', '진행중', '완료', '보류'] },
  { key: 'deadline', label: '마감일',     minW: 112, type: 'date' },
  { key: 'notes',    label: '비고',       minW: 180, type: 'text' },
];

const EMPTY_ROW: Omit<ManuscriptRow, 'id'> = {
  date: new Date().toISOString().slice(0, 10),
  client: '',
  channel: '인스타그램',
  title: '',
  status: '작업전',
  deadline: '',
  notes: '',
};

/* ── 개별 셀 ── */
interface CellProps {
  value: string;
  col: ColDef;
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  onTab: (shift: boolean) => void;
  onEnter: () => void;
}

const SpreadsheetCell: React.FC<CellProps> = ({
  value, col, isEditing, onStartEdit, onChange, onBlur, onTab, onEnter,
}) => {
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (col.type === 'text') {
        try { (inputRef.current as HTMLInputElement).select(); } catch {}
      }
    }
  }, [isEditing, col.type]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab')    { e.preventDefault(); onTab(e.shiftKey); }
    else if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
    else if (e.key === 'Escape') onBlur();
  };

  const baseInput = 'w-full h-full px-2 border-0 bg-transparent outline-none text-[13px] font-medium text-gray-800';

  if (isEditing) {
    if (col.type === 'select') {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={baseInput + ' cursor-pointer'}
          style={{ minHeight: 28 }}
        >
          {col.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={col.type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={baseInput}
        style={{ minHeight: 28 }}
      />
    );
  }

  /* 표시 모드 */
  if (col.key === 'status') {
    return (
      <div className="flex items-center h-full px-1.5 cursor-cell select-none" onClick={onStartEdit}
        onDoubleClick={onStartEdit}>
        <span className={`px-1.5 py-[1px] rounded text-[11px] font-black whitespace-nowrap ${STATUS_STYLES[value as ManuscriptRow['status']] || 'bg-gray-100 text-gray-500'}`}>
          {value || '작업전'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center h-full px-2 cursor-cell overflow-hidden select-none"
      onClick={onStartEdit} onDoubleClick={onStartEdit}>
      <span className="text-[13px] font-medium text-gray-800 truncate leading-none">
        {value || ''}
      </span>
    </div>
  );
};

/* ── 스프레드시트 메인 ── */
interface SpreadsheetProps {
  manuscripts: ManuscriptRow[];
  onAdd: (row: Omit<ManuscriptRow, 'id'>) => void;
  onUpdate: (row: ManuscriptRow) => void;
  onDelete: (id: string) => void;
}

const ManuscriptSheet: React.FC<SpreadsheetProps> = ({ manuscripts, onAdd, onUpdate, onDelete }) => {
  const [editingCell, setEditingCell] = useState<{ ri: number; ci: number } | null>(null);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [filterChannel, setFilterChannel] = useState('전체');
  const [search, setSearch] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = manuscripts.filter(m => {
    if (filterStatus !== '전체' && m.status !== filterStatus) return false;
    if (filterChannel !== '전체' && m.channel !== filterChannel) return false;
    if (search && !m.client.includes(search) && !m.title.includes(search) && !m.notes.includes(search)) return false;
    return true;
  });

  const stats = {
    total: manuscripts.length,
    inProgress: manuscripts.filter(m => m.status === '진행중').length,
    done: manuscripts.filter(m => m.status === '완료').length,
    hold: manuscripts.filter(m => m.status === '보류').length,
  };

  const startEdit = (ri: number, ci: number) => setEditingCell({ ri, ci });
  const stopEdit  = () => setEditingCell(null);

  const moveCell = useCallback((ri: number, ci: number, dRow: number, dCol: number) => {
    const nextCi = ci + dCol;
    const nextRi = ri + dRow;
    if (nextCi >= 0 && nextCi < COLS.length && nextRi >= 0 && nextRi < filtered.length) {
      setEditingCell({ ri: nextRi, ci: nextCi });
    } else {
      stopEdit();
    }
  }, [filtered.length]);

  const handleChange = (rowId: string, key: ColKey, val: string) => {
    const row = manuscripts.find(m => m.id === rowId);
    if (row) onUpdate({ ...row, [key]: val });
  };

  const addRow = () => {
    onAdd({ ...EMPTY_ROW });
    setTimeout(() => setEditingCell({ ri: filtered.length, ci: 0 }), 30);
  };

  const exportCsv = () => {
    const header = ['No.', ...COLS.map(c => c.label)];
    const rows = manuscripts.map((m, i) => [i + 1, ...COLS.map(c => m[c.key])]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `원고시트_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* 통계 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '전체', val: stats.total,      cls: 'bg-gray-100 text-gray-700' },
          { label: '진행중', val: stats.inProgress, cls: 'bg-blue-50 text-blue-700' },
          { label: '완료',   val: stats.done,       cls: 'bg-emerald-50 text-emerald-700' },
          { label: '보류',   val: stats.hold,       cls: 'bg-amber-50 text-amber-700' },
        ].map(s => (
          <div key={s.label} className={`${s.cls} rounded-xl p-2.5 text-center`}>
            <p className="text-xl font-black leading-none">{s.val}</p>
            <p className="text-[11px] font-bold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 툴바 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="검색 (클라이언트·제목·비고)..."
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium focus:outline-none focus:border-blue-400 w-44" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold focus:outline-none bg-white">
          {['전체', '작업전', '진행중', '완료', '보류'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold focus:outline-none bg-white">
          {['전체', ...CHANNELS].map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={exportCsv}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-black text-gray-400 hover:bg-gray-50 transition-colors whitespace-nowrap">
            CSV 내보내기
          </button>
          <button type="button" onClick={addRow}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-black hover:bg-blue-700 transition-colors whitespace-nowrap">
            + 행 추가
          </button>
        </div>
      </div>

      {/* 스프레드시트 */}
      <div
        ref={tableRef}
        className="overflow-auto rounded-lg shadow-sm"
        style={{
          maxHeight: 'calc(100vh - 380px)',
          minHeight: 240,
          border: '1px solid #dadce0',
        }}
        onClick={e => { if (e.target === tableRef.current) stopEdit(); }}
      >
        <table
          className="border-collapse"
          style={{ minWidth: 'max-content', tableLayout: 'fixed' }}
        >
          {/* 컬럼 너비 정의 */}
          <colgroup>
            <col style={{ width: 40 }} />
            {COLS.map(c => <col key={c.key} style={{ width: c.minW }} />)}
            <col style={{ width: 32 }} />
          </colgroup>

          {/* 헤더 */}
          <thead>
            <tr>
              {/* 코너 셀 */}
              <th
                className="sticky left-0 top-0 z-30 select-none"
                style={{
                  background: '#f8f9fa',
                  borderRight: '1px solid #dadce0',
                  borderBottom: '1px solid #dadce0',
                  height: 28,
                }}
              />
              {COLS.map(col => (
                <th
                  key={col.key}
                  className="sticky top-0 z-20 select-none text-center"
                  style={{
                    background: '#f8f9fa',
                    borderRight: '1px solid #dadce0',
                    borderBottom: '2px solid #dadce0',
                    height: 28,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#5f6368',
                    letterSpacing: '0.03em',
                    padding: '0 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                </th>
              ))}
              {/* 삭제 컬럼 헤더 */}
              <th
                className="sticky top-0 z-20"
                style={{
                  background: '#f8f9fa',
                  borderBottom: '2px solid #dadce0',
                  height: 28,
                }}
              />
            </tr>
          </thead>

          <tbody>
            {filtered.map((row, ri) => (
              <tr key={row.id} className="group">
                {/* 행 번호 */}
                <td
                  className="sticky left-0 z-10 text-center select-none"
                  style={{
                    background: '#f8f9fa',
                    borderRight: '1px solid #dadce0',
                    borderBottom: '1px solid #e8eaed',
                    height: 28,
                    fontSize: 11,
                    color: '#80868b',
                    fontWeight: 600,
                    minWidth: 40,
                  }}
                >
                  {ri + 1}
                </td>

                {/* 데이터 셀 */}
                {COLS.map((col, ci) => {
                  const isEditing = editingCell?.ri === ri && editingCell?.ci === ci;
                  return (
                    <td
                      key={col.key}
                      style={{
                        height: 28,
                        padding: 0,
                        borderRight: '1px solid #e8eaed',
                        borderBottom: '1px solid #e8eaed',
                        position: 'relative',
                        boxSizing: 'border-box',
                        ...(isEditing
                          ? { outline: '2px solid #1a73e8', outlineOffset: -1, zIndex: 15, background: '#fff' }
                          : { background: '#fff' }),
                      }}
                    >
                      <SpreadsheetCell
                        value={row[col.key] as string}
                        col={col}
                        isEditing={isEditing}
                        onStartEdit={() => startEdit(ri, ci)}
                        onChange={v => handleChange(row.id, col.key, v)}
                        onBlur={stopEdit}
                        onTab={shift => moveCell(ri, ci, 0, shift ? -1 : 1)}
                        onEnter={() => moveCell(ri, ci, 1, 0)}
                      />
                    </td>
                  );
                })}

                {/* 삭제 버튼 */}
                <td
                  style={{
                    height: 28,
                    borderBottom: '1px solid #e8eaed',
                    background: '#fff',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onDelete(row.id)}
                    className="text-gray-300 hover:text-red-400 text-sm font-black leading-none opacity-0 group-hover:opacity-100 transition-opacity px-1"
                    tabIndex={-1}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}

            {/* 빈 행 (행 추가 클릭) */}
            <tr
              className="cursor-pointer hover:bg-[#f8f9fa] transition-colors"
              onClick={addRow}
            >
              <td
                className="sticky left-0"
                style={{
                  background: '#f8f9fa',
                  borderRight: '1px solid #dadce0',
                  borderBottom: '1px solid #e8eaed',
                  height: 28,
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#bdc1c6',
                }}
              >
                {filtered.length + 1}
              </td>
              <td
                colSpan={COLS.length + 1}
                style={{
                  borderBottom: '1px solid #e8eaed',
                  height: 28,
                  paddingLeft: 12,
                  fontSize: 12,
                  color: '#bdc1c6',
                  fontWeight: 600,
                }}
              >
                + 클릭하여 행 추가
              </td>
            </tr>

            {/* 아래 여백 행들 */}
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={`pad-${i}`} onClick={addRow} className="cursor-pointer hover:bg-[#f8f9fa] transition-colors">
                <td
                  className="sticky left-0"
                  style={{
                    background: '#f8f9fa',
                    borderRight: '1px solid #dadce0',
                    borderBottom: '1px solid #e8eaed',
                    height: 28,
                  }}
                />
                <td
                  colSpan={COLS.length + 1}
                  style={{ borderBottom: '1px solid #e8eaed', height: 28, background: '#fff' }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manuscripts.length === 0 && (
        <p className="text-center text-xs text-gray-300 font-medium pt-1">
          위 시트를 클릭하여 데이터를 입력하세요
        </p>
      )}
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
          {['인스타그램', '카카오채널', '네이버블로그', '유튜브'].map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400 font-bold">{PLATFORM_TIPS[platform]}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase mb-2">원본 내용</label>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder={'원고 내용을 붙여넣으세요...\n#해시태그는 # 로 시작하는 줄에 입력'}
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-gray-400 uppercase">{platform} 변환 결과</label>
            {output && (
              <button type="button" onClick={handleCopy}
                className={`text-xs font-black ${copied ? 'text-emerald-500' : 'text-blue-600 hover:text-blue-700'}`}>
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
      const { error } = await supabase
        .from('profiles')
        .update({ is_franchise: newVal, updated_at: new Date().toISOString() })
        .eq('id', member.id);
      if (!error) {
        const updated = { ...member, isFranchise: newVal };
        setLocalMembers(prev => prev.map(m => m.id === member.id ? updated : m));
        if (onUpdateUser) onUpdateUser(updated);
      }
    } finally {
      setTogglingId(null);
    }
  };

  const franchiseMembers = localMembers.filter(m => m.isFranchise);
  const visible = localMembers.filter(m =>
    !search ||
    m.nickname.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
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
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="닉네임·ID 검색..."
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
                      member.role === 'admin'   ? 'bg-purple-100 text-purple-700' :
                      member.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                                                  'bg-gray-100 text-gray-500'
                    }`}>{member.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={togglingId === member.id || member.role === 'admin'}
                      onClick={() => toggleFranchise(member)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${
                        member.isFranchise
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
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
    { id: 'revenue',     label: '매출관리',     icon: '📊' },
    { id: 'manuscripts', label: '원고시트',      icon: '📝' },
    { id: 'convert',     label: '원고시트변환',  icon: '🔄' },
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
