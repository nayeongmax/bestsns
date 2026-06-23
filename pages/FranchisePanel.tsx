import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';

type FranchiseTab = 'members' | 'revenue' | 'manuscripts' | 'convert' | 'collector';

interface Props {
  user: UserProfile;
  members: UserProfile[];
  onUpdateUser?: (u: UserProfile) => void;
}

/* ══════════════════════════════════════════════
   원고시트 — 구글 시트 스타일 (서식 + 단축키)
══════════════════════════════════════════════ */

const MIN_COLS = 26;
const MIN_ROWS = 50;
const COL_BUF  = 5;
const ROW_BUF  = 20;

interface CellData {
  v?:  string;              // value
  b?:  boolean;             // bold
  i?:  boolean;             // italic
  s?:  boolean;             // strikethrough
  sz?: number;              // font size
  c?:  string;              // text color
  bg?: string;              // background color
  a?:  'l' | 'c' | 'r';   // alignment
}
type SheetData = Record<string, CellData>;

const colLabel = (c: number) => {
  let label = '', n = c;
  while (n >= 0) { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; }
  return label;
};

function computeSize(data: SheetData) {
  let maxR = MIN_ROWS - 1, maxC = MIN_COLS - 1;
  for (const k of Object.keys(data)) {
    const [rs, cs] = k.split(':');
    const r = Number(rs), c = Number(cs);
    if (!isNaN(r)) maxR = Math.max(maxR, r);
    if (!isNaN(c)) maxC = Math.max(maxC, c);
  }
  return { rows: maxR + ROW_BUF + 1, cols: maxC + COL_BUF + 1 };
}

function migrateData(raw: string): SheetData {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: SheetData = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') result[k] = { v };
      else if (v && typeof v === 'object') result[k] = v as CellData;
    }
    return result;
  } catch { return {}; }
}

/* 툴바 버튼 */
const TBtn: React.FC<{
  children: React.ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}> = ({ children, title, active, disabled, onClick, onMouseDown, style }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    onMouseDown={onMouseDown}
    style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? '#e8f0fe' : 'transparent',
      color: active ? '#1a73e8' : disabled ? '#c0c0c0' : '#444',
      fontSize: 13, transition: 'background 0.1s',
      ...style,
    }}
    onMouseEnter={e => { if (!active && !disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f0f0f0'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? '#e8f0fe' : 'transparent'; }}
  >
    {children}
  </button>
);

const Sep = () => <div style={{ width: 1, height: 18, background: '#dadce0', margin: '0 3px', flexShrink: 0 }} />;

/* ── 메인 스프레드시트 ── */
const ManuscriptSheet: React.FC<{ userId: string }> = ({ userId }) => {
  const STORAGE_KEY = `franchise_sheet_${userId}`;

  const [data, setData]               = useState<SheetData>({});
  const [undoStack, setUndoStack]     = useState<SheetData[]>([]);
  const [redoStack, setRedoStack]     = useState<SheetData[]>([]);
  const [size, setSize]               = useState({ rows: MIN_ROWS, cols: MIN_COLS });
  const [editCell, setEditCell]       = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue]     = useState('');
  const inputRef    = useRef<HTMLInputElement>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null); // 툴바 클릭 시 블러 후에도 대상 셀 유지

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const d = migrateData(s);
        setData(d);
        setSize(prev => {
          const { rows, cols } = computeSize(d);
          return { rows: Math.max(prev.rows, rows), cols: Math.max(prev.cols, cols) };
        });
      }
    } catch {}
  }, [STORAGE_KEY]);

  useEffect(() => { if (editCell) lastCellRef.current = editCell; }, [editCell]);

  /* ── 저장 + 히스토리 push ── */
  const persist = (newData: SheetData) => {
    setUndoStack(s => [...s, data].slice(-50));
    setRedoStack([]);
    setData(newData);
    setSize(prev => {
      const { rows, cols } = computeSize(newData);
      return { rows: Math.max(prev.rows, rows), cols: Math.max(prev.cols, cols) };
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch {}
  };

  const undo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(s => [data, ...s].slice(0, 50));
    setUndoStack(s => s.slice(0, -1));
    setData(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)); } catch {}
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[0];
    setUndoStack(s => [...s, data].slice(-50));
    setRedoStack(s => s.slice(1));
    setData(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  /* ── 셀 조작 ── */
  const key    = (r: number, c: number) => `${r}:${c}`;
  const getCell = (r: number, c: number): CellData => data[key(r, c)] ?? {};

  const startEdit = (r: number, c: number) => {
    setSize(prev => ({
      rows: Math.max(prev.rows, r + ROW_BUF + 1),
      cols: Math.max(prev.cols, c + COL_BUF + 1),
    }));
    setEditCell({ r, c });
    setEditValue(data[key(r, c)]?.v ?? '');
  };

  const commitEdit = (r: number, c: number, val: string) => {
    const k   = key(r, c);
    const next = { ...data };
    const existing = { ...(next[k] ?? {}) };
    if (val) existing.v = val; else delete existing.v;
    if (Object.keys(existing).length > 0) next[k] = existing; else delete next[k];
    persist(next);
    setEditCell(null);
  };

  /* 서식 적용 — 툴바에서 호출, 블러 후에도 lastCellRef 사용 */
  const applyFormat = (fmt: Partial<CellData>) => {
    const target = editCell ?? lastCellRef.current;
    if (!target) return;
    const k    = key(target.r, target.c);
    const next = { ...data, [k]: { ...(data[k] ?? {}), ...fmt } };
    persist(next);
  };

  /* 붙여넣기 (TSV 파싱) */
  const applyPaste = (startR: number, startC: number, text: string) => {
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
    const next = { ...data };
    rows.forEach((rowStr, dr) =>
      rowStr.split('\t').forEach((v, dc) => {
        const k = key(startR + dr, startC + dc);
        if (v) next[k] = { ...(next[k] ?? {}), v };
      })
    );
    persist(next);
    setEditCell(null);
  };

  /* 키보드 핸들러 (input 안) */
  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); commitEdit(r, c, editValue); undo(); return; }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); commitEdit(r, c, editValue); redo(); return; }
      if (e.key === 'b') { e.preventDefault(); applyFormat({ b: !getCell(r, c).b }); return; }
      if (e.key === 'i') { e.preventDefault(); applyFormat({ i: !getCell(r, c).i }); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(r, c, editValue);
      e.shiftKey ? (c > 0 ? startEdit(r, c - 1) : r > 0 && startEdit(r - 1, size.cols - 1)) : startEdit(r, c + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault(); commitEdit(r, c, editValue); startEdit(r + 1, c);
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text  = e.clipboardData.getData('text/plain');
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
    if (lines.length > 1 || lines[0]?.includes('\t')) { e.preventDefault(); applyPaste(r, c, text); }
  };

  const handleContainerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editCell) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  };

  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editCell) return;
    const text = e.clipboardData.getData('text/plain');
    if (text) { e.preventDefault(); applyPaste(lastCellRef.current?.r ?? 0, lastCellRef.current?.c ?? 0, text); }
  };

  useEffect(() => {
    if (editCell && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editCell]);

  const activeFmt   = editCell ? getCell(editCell.r, editCell.c) : (lastCellRef.current ? getCell(lastCellRef.current.r, lastCellRef.current.c) : {});
  const colLabels   = Array.from({ length: size.cols }, (_, i) => colLabel(i));
  const cellAddrLabel = editCell ? `${colLabel(editCell.c)}${editCell.r + 1}` : (lastCellRef.current ? `${colLabel(lastCellRef.current.c)}${lastCellRef.current.r + 1}` : '');

  /* noBlur — 툴바 클릭 시 input 포커스 유지 */
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      tabIndex={0}
      onKeyDown={handleContainerKey}
      onPaste={handleContainerPaste}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 320, outline: 'none' }}
    >
      {/* ── 툴바 ── */}
      <div style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', padding: '3px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, minHeight: 38 }}>
        {/* 실행취소 / 다시실행 */}
        <TBtn title="실행 취소 (Ctrl+Z)" disabled={!undoStack.length} onClick={undo} onMouseDown={noBlur}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
        </TBtn>
        <TBtn title="다시 실행 (Ctrl+Y)" disabled={!redoStack.length} onClick={redo} onMouseDown={noBlur}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
        </TBtn>
        <Sep />

        {/* 글꼴 크기 */}
        <select
          value={activeFmt.sz ?? 10}
          onMouseDown={noBlur}
          onChange={e => applyFormat({ sz: Number(e.target.value) })}
          style={{ height: 26, padding: '0 2px', border: '1px solid #dadce0', borderRadius: 3, fontSize: 12, background: '#fff', cursor: 'pointer', width: 52, flexShrink: 0 }}
        >
          {[8,9,10,11,12,14,16,18,20,24,28,36,48,72].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Sep />

        {/* Bold / Italic / 취소선 */}
        <TBtn title="굵게 (Ctrl+B)" active={!!activeFmt.b} onMouseDown={noBlur} onClick={() => applyFormat({ b: !activeFmt.b })} style={{ fontWeight: 700 }}>B</TBtn>
        <TBtn title="기울임 (Ctrl+I)" active={!!activeFmt.i} onMouseDown={noBlur} onClick={() => applyFormat({ i: !activeFmt.i })} style={{ fontStyle: 'italic' }}>I</TBtn>
        <TBtn title="취소선" active={!!activeFmt.s} onMouseDown={noBlur} onClick={() => applyFormat({ s: !activeFmt.s })} style={{ textDecoration: 'line-through' }}>S</TBtn>
        <Sep />

        {/* 글자색 */}
        <div title="글자색" style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }} onMouseDown={noBlur}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, height: '100%', pointerEvents: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: activeFmt.c || '#000', lineHeight: 1 }}>A</span>
            <div style={{ width: 16, height: 3, background: activeFmt.c || '#000', borderRadius: 1 }} />
          </div>
          <input type="color" value={activeFmt.c || '#000000'} onChange={e => applyFormat({ c: e.target.value })}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }} />
        </div>

        {/* 배경색 */}
        <div title="배경색" style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }} onMouseDown={noBlur}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, height: '100%', pointerEvents: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={activeFmt.bg || '#757575'}>
              <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/>
            </svg>
            <div style={{ width: 16, height: 3, background: activeFmt.bg || '#f4c20d', borderRadius: 1 }} />
          </div>
          <input type="color" value={activeFmt.bg || '#ffffff'} onChange={e => applyFormat({ bg: e.target.value === '#ffffff' ? undefined : e.target.value })}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }} />
        </div>
        <Sep />

        {/* 정렬 */}
        <TBtn title="왼쪽 정렬" active={!activeFmt.a || activeFmt.a === 'l'} onMouseDown={noBlur} onClick={() => applyFormat({ a: 'l' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>
        </TBtn>
        <TBtn title="가운데 정렬" active={activeFmt.a === 'c'} onMouseDown={noBlur} onClick={() => applyFormat({ a: 'c' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>
        </TBtn>
        <TBtn title="오른쪽 정렬" active={activeFmt.a === 'r'} onMouseDown={noBlur} onClick={() => applyFormat({ a: 'r' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>
        </TBtn>
      </div>

      {/* ── 수식 바 ── */}
      <div style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', height: 26, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 76, borderRight: '1px solid #e0e0e0', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#5f6368', userSelect: 'none', flexShrink: 0 }}>
          {cellAddrLabel}
        </div>
        <div style={{ flex: 1, padding: '0 8px', fontSize: 13, color: '#1f1f1f', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {editCell ? editValue : (lastCellRef.current ? (getCell(lastCellRef.current.r, lastCellRef.current.c).v ?? '') : '')}
        </div>
      </div>

      {/* ── 그리드 ── */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #dadce0', borderTop: 'none' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 46 }} />
            {colLabels.map(l => <col key={l} style={{ width: 120 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, background: '#f8f9fa', border: '1px solid #dadce0', height: 20 }} />
              {colLabels.map(label => (
                <th key={label} style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f8f9fa', border: '1px solid #dadce0', height: 20, fontSize: 11, fontWeight: 600, color: '#444746', textAlign: 'center', userSelect: 'none' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: size.rows }, (_, r) => (
              <tr key={r}>
                <td style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8f9fa', borderRight: '1px solid #dadce0', borderBottom: '1px solid #e2e3e3', height: 21, fontSize: 11, fontWeight: 500, color: '#444746', textAlign: 'center', userSelect: 'none', minWidth: 46 }}>
                  {r + 1}
                </td>
                {colLabels.map((_, c) => {
                  const isEditing = editCell?.r === r && editCell?.c === c;
                  const cell      = getCell(r, c);
                  const val       = cell.v ?? '';

                  const cellStyle: React.CSSProperties = {
                    height: 21, padding: 0,
                    borderRight: '1px solid #e2e3e3',
                    borderBottom: '1px solid #e2e3e3',
                    background: cell.bg || '#fff',
                    position: 'relative',
                    cursor: 'cell',
                    ...(isEditing ? { outline: '2px solid #1a73e8', outlineOffset: -1, zIndex: 15 } : {}),
                  };

                  const textStyle: React.CSSProperties = {
                    fontSize: cell.sz ?? 13,
                    fontWeight: cell.b ? 700 : 400,
                    fontStyle: cell.i ? 'italic' : 'normal',
                    textDecoration: cell.s ? 'line-through' : 'none',
                    color: cell.c || '#1f1f1f',
                    textAlign: cell.a === 'c' ? 'center' : cell.a === 'r' ? 'right' : 'left',
                  };

                  return (
                    <td key={c} onClick={() => { if (!isEditing) startEdit(r, c); }} style={cellStyle}>
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(r, c, editValue)}
                          onKeyDown={e => handleKeyDown(e, r, c)}
                          onPaste={e => handleInputPaste(e, r, c)}
                          style={{ width: '100%', height: '100%', padding: '0 4px', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', ...textStyle }}
                        />
                      ) : val ? (
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', padding: '0 4px', whiteSpace: 'nowrap', lineHeight: '21px', pointerEvents: 'none', ...textStyle }}>
                          {val}
                        </div>
                      ) : null}
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
  const body = bodyLines.join('\n'), tags = hashLines.join(' ');
  switch (platform) {
    case '인스타그램': return body.split(/\n{2,}/).filter(Boolean).map(p => p.trim()).join('\n.\n') + (tags ? `\n.\n\n${tags}` : '');
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
  const [input, setInput]       = useState('');
  const [output, setOutput]     = useState('');
  const [copied, setCopied]     = useState(false);
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black text-gray-900">원고시트변환</h2>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setOutput(''); }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['인스타그램','카카오채널','네이버블로그','유튜브'].map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400 font-bold">{PLATFORM_TIPS[platform]}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase mb-2">원본 내용</label>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={'원고 내용을 붙여넣으세요...\n#해시태그는 # 로 시작하는 줄에 입력'}
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-gray-400 uppercase">{platform} 변환 결과</label>
            {output && <button type="button" onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`text-xs font-black ${copied ? 'text-emerald-500' : 'text-blue-600 hover:text-blue-700'}`}>{copied ? '✓ 복사됨' : '복사'}</button>}
          </div>
          <textarea value={output} readOnly placeholder="변환 버튼을 누르면 결과가 표시됩니다..."
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none focus:outline-none" />
        </div>
      </div>
      <button type="button" onClick={() => setOutput(convertManuscript(input, platform))} disabled={!input.trim()}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        🔄 변환하기
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════
   원고수집기
══════════════════════════════════════════════ */
interface CollectedArticle {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  body: string | null;
  thumbnail: string | null;
  images: string[];
  author: string | null;
  publishedAt: string | null;
  collectedAt: string;
}

const CollectorTab: React.FC = () => {
  const [url, setUrl]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [articles, setArticles]   = useState<CollectedArticle[]>(() => {
    try {
      const s = localStorage.getItem('franchise_collected_articles');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [preview, setPreview]     = useState<CollectedArticle | null>(null);
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const saveArticles = (list: CollectedArticle[]) => {
    setArticles(list);
    try { localStorage.setItem('franchise_collected_articles', JSON.stringify(list)); } catch {}
  };

  const collect = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/.netlify/functions/scrape-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || '수집 실패');
      const article: CollectedArticle = {
        id: Date.now().toString(),
        url: data.url,
        title: data.title,
        description: data.description,
        body: data.body,
        thumbnail: data.thumbnail,
        images: data.images || [],
        author: data.author,
        publishedAt: data.publishedAt,
        collectedAt: new Date().toISOString(),
      };
      const next = [article, ...articles];
      saveArticles(next);
      setPreview(article);
      setUrl('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const remove = (id: string) => {
    saveArticles(articles.filter(a => a.id !== id));
    if (preview?.id === id) setPreview(null);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 입력 */}
      <div>
        <h2 className="text-lg font-black text-gray-900 mb-1">원고수집기</h2>
        <p className="text-xs text-gray-400 font-bold mb-3">URL을 입력하면 해당 페이지의 글·이미지를 자동으로 수집합니다</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && collect()}
            placeholder="https://blog.naver.com/... 또는 수집할 글 URL"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={collect}
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? '수집 중...' : '🔍 수집'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500 font-bold">{error}</p>}
      </div>

      {articles.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">📰</div>
          <p className="text-sm text-gray-300 font-bold">수집된 글이 없습니다</p>
          <p className="text-xs text-gray-300 font-bold mt-1">위에 URL을 입력해 글을 수집해보세요</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* 목록 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-black text-gray-400 uppercase">수집 목록 ({articles.length})</p>
              <button type="button" onClick={() => saveArticles([])} className="text-xs text-red-400 hover:text-red-600 font-bold">전체 삭제</button>
            </div>
            {articles.map(a => (
              <div
                key={a.id}
                onClick={() => setPreview(a)}
                className={`flex gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${preview?.id === a.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
              >
                {a.thumbnail && (
                  <img src={a.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-100" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate">{a.title || '(제목 없음)'}</p>
                  <p className="text-xs text-gray-400 font-bold truncate mt-0.5">{a.url}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {a.author && <span className="text-[11px] text-gray-400">{a.author}</span>}
                    <span className="text-[11px] text-gray-300">{formatDate(a.collectedAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); remove(a.id); }}
                  className="text-gray-300 hover:text-red-400 font-bold text-lg leading-none shrink-0 self-start"
                  title="삭제"
                >×</button>
              </div>
            ))}
          </div>

          {/* 미리보기 */}
          {preview && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 sticky top-32">
              {preview.thumbnail && (
                <img src={preview.thumbnail} alt="" className="w-full h-40 object-cover rounded-xl bg-gray-100" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-gray-900 text-sm leading-snug">{preview.title || '(제목 없음)'}</h3>
                  <button
                    type="button"
                    onClick={() => copyText(preview.title || '', `title-${preview.id}`)}
                    className={`text-xs font-black shrink-0 ${copiedId === `title-${preview.id}` ? 'text-emerald-500' : 'text-blue-500 hover:text-blue-700'}`}
                  >{copiedId === `title-${preview.id}` ? '✓' : '복사'}</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {preview.author && <span className="text-[11px] text-gray-400 font-bold">{preview.author}</span>}
                  {preview.publishedAt && <span className="text-[11px] text-gray-300">{formatDate(preview.publishedAt)}</span>}
                  <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline font-bold">원문 보기</a>
                </div>
              </div>

              {preview.description && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-black text-gray-400 uppercase">요약</p>
                    <button
                      type="button"
                      onClick={() => copyText(preview.description || '', `desc-${preview.id}`)}
                      className={`text-xs font-black ${copiedId === `desc-${preview.id}` ? 'text-emerald-500' : 'text-blue-500 hover:text-blue-700'}`}
                    >{copiedId === `desc-${preview.id}` ? '✓ 복사됨' : '복사'}</button>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{preview.description}</p>
                </div>
              )}

              {preview.body && preview.body !== preview.description && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-black text-gray-400 uppercase">본문</p>
                    <button
                      type="button"
                      onClick={() => copyText(preview.body || '', `body-${preview.id}`)}
                      className={`text-xs font-black ${copiedId === `body-${preview.id}` ? 'text-emerald-500' : 'text-blue-500 hover:text-blue-700'}`}
                    >{copiedId === `body-${preview.id}` ? '✓ 복사됨' : '복사'}</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{preview.body}</p>
                  </div>
                </div>
              )}

              {preview.images.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-gray-400 uppercase mb-2">이미지 ({preview.images.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.images.slice(0, 8).map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                        <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => copyText(`제목: ${preview.title || ''}\n\n${preview.body || preview.description || ''}`, `all-${preview.id}`)}
                className={`w-full py-2.5 rounded-xl font-black text-sm transition-colors ${copiedId === `all-${preview.id}` ? 'bg-emerald-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
              >
                {copiedId === `all-${preview.id}` ? '✓ 전체 복사됨' : '📋 전체 복사'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점 현황 (어드민)
══════════════════════════════════════════════ */
const MembersTab: React.FC<{ members: UserProfile[]; onUpdateUser?: (u: UserProfile) => void }> = ({ members, onUpdateUser }) => {
  const [search, setSearch]       = useState('');
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
  const visible = localMembers.filter(m => !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">현재 {franchiseMembers.length}개 가맹점 활성 · 가맹점으로 선택된 회원은 가맹점패널에 접근할 수 있습니다</p>
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
              <tr>{['회원','ID','이메일','등급','가맹점 여부'].map(h => <th key={h} className="px-4 py-3 text-left font-black text-gray-400 uppercase whitespace-nowrap text-[11px]">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.slice(0, 100).map(member => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><img src={member.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" /><span className="font-black text-gray-900 whitespace-nowrap">{member.nickname}</span></div></td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{member.role}</span></td>
                  <td className="px-4 py-3"><button type="button" disabled={togglingId === member.id || member.role === 'admin'} onClick={() => toggleFranchise(member)}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${member.isFranchise ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {togglingId === member.id ? '...' : member.isFranchise ? '✓ 가맹점' : '가맹점 선택'}
                  </button></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-300 font-bold">검색 결과 없음</td></tr>}
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
  const isAdmin   = user.role === 'admin' || user.id.toLowerCase() === 'admin';
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
    { id: 'collector',   label: '원고수집기',   icon: '🔍' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-0 md:py-6">
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-white sticky top-14 xl:top-20 z-10">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 md:px-6 py-3.5 font-black text-sm whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.adminOnly && <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">관리자</span>}
          </button>
        ))}
      </div>
      <div className={activeTab === 'manuscripts' ? 'px-0' : 'px-3 md:px-4 pt-4 md:pt-6'}>
        {activeTab === 'members'     && isAdmin && <MembersTab members={members} onUpdateUser={onUpdateUser} />}
        {activeTab === 'revenue'     && <RevenueManagement user={user} />}
        {activeTab === 'manuscripts' && <ManuscriptSheet userId={user.id} />}
        {activeTab === 'convert'     && <ConvertTab />}
        {activeTab === 'collector'   && <CollectorTab />}
      </div>
    </div>
  );
};

export default FranchisePanel;
