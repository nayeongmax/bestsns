import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';
import { upsertSmmOrders } from '../smmDb';
import { FranchisePlan, FranchiseProduct, fetchFranchisePlans, fetchFranchiseProducts } from '../franchiseDb';

type FranchiseTab = 'members' | 'subscription' | 'revenue' | 'manuscripts' | 'collector' | 'marketing';

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
  v?:  string;
  b?:  boolean;
  i?:  boolean;
  s?:  boolean;
  sz?: number;
  c?:  string;
  bg?: string;
  a?:  'l' | 'c' | 'r';
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

const ManuscriptSheet: React.FC<{ userId: string }> = ({ userId }) => {
  const STORAGE_KEY = `franchise_sheet_${userId}`;

  const [data, setData]           = useState<SheetData>({});
  const [undoStack, setUndoStack] = useState<SheetData[]>([]);
  const [redoStack, setRedoStack] = useState<SheetData[]>([]);
  const [size, setSize]           = useState({ rows: MIN_ROWS, cols: MIN_COLS });
  const [editCell, setEditCell]   = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef    = useRef<HTMLInputElement>(null);
  const lastCellRef = useRef<{ r: number; c: number } | null>(null);

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

  const key      = (r: number, c: number) => `${r}:${c}`;
  const getCell  = (r: number, c: number): CellData => data[key(r, c)] ?? {};

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

  const applyFormat = (fmt: Partial<CellData>) => {
    const target = editCell ?? lastCellRef.current;
    if (!target) return;
    const k    = key(target.r, target.c);
    const next = { ...data, [k]: { ...(data[k] ?? {}), ...fmt } };
    persist(next);
  };

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

  const activeFmt     = editCell ? getCell(editCell.r, editCell.c) : (lastCellRef.current ? getCell(lastCellRef.current.r, lastCellRef.current.c) : {});
  const colLabels     = Array.from({ length: size.cols }, (_, i) => colLabel(i));
  const cellAddrLabel = editCell ? `${colLabel(editCell.c)}${editCell.r + 1}` : (lastCellRef.current ? `${colLabel(lastCellRef.current.c)}${lastCellRef.current.r + 1}` : '');
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      tabIndex={0}
      onKeyDown={handleContainerKey}
      onPaste={handleContainerPaste}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 320, outline: 'none' }}
    >
      <div style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', padding: '3px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, minHeight: 38 }}>
        <TBtn title="실행 취소 (Ctrl+Z)" disabled={!undoStack.length} onClick={undo} onMouseDown={noBlur}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
        </TBtn>
        <TBtn title="다시 실행 (Ctrl+Y)" disabled={!redoStack.length} onClick={redo} onMouseDown={noBlur}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
        </TBtn>
        <Sep />
        <select
          value={activeFmt.sz ?? 10}
          onMouseDown={noBlur}
          onChange={e => applyFormat({ sz: Number(e.target.value) })}
          style={{ height: 26, padding: '0 2px', border: '1px solid #dadce0', borderRadius: 3, fontSize: 12, background: '#fff', cursor: 'pointer', width: 52, flexShrink: 0 }}
        >
          {[8,9,10,11,12,14,16,18,20,24,28,36,48,72].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Sep />
        <TBtn title="굵게 (Ctrl+B)" active={!!activeFmt.b} onMouseDown={noBlur} onClick={() => applyFormat({ b: !activeFmt.b })} style={{ fontWeight: 700 }}>B</TBtn>
        <TBtn title="기울임 (Ctrl+I)" active={!!activeFmt.i} onMouseDown={noBlur} onClick={() => applyFormat({ i: !activeFmt.i })} style={{ fontStyle: 'italic' }}>I</TBtn>
        <TBtn title="취소선" active={!!activeFmt.s} onMouseDown={noBlur} onClick={() => applyFormat({ s: !activeFmt.s })} style={{ textDecoration: 'line-through' }}>S</TBtn>
        <Sep />
        <div title="글자색" style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }} onMouseDown={noBlur}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, height: '100%', pointerEvents: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: activeFmt.c || '#000', lineHeight: 1 }}>A</span>
            <div style={{ width: 16, height: 3, background: activeFmt.c || '#000', borderRadius: 1 }} />
          </div>
          <input type="color" value={activeFmt.c || '#000000'} onChange={e => applyFormat({ c: e.target.value })}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }} />
        </div>
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

      <div style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', height: 26, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 76, borderRight: '1px solid #e0e0e0', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#5f6368', userSelect: 'none', flexShrink: 0 }}>
          {cellAddrLabel}
        </div>
        <div style={{ flex: 1, padding: '0 8px', fontSize: 13, color: '#1f1f1f', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {editCell ? editValue : (lastCellRef.current ? (getCell(lastCellRef.current.r, lastCellRef.current.c).v ?? '') : '')}
        </div>
      </div>

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
   원고수집기 — 두 패널 프로그램 스타일
══════════════════════════════════════════════ */
interface ManuscriptItem {
  id: string;
  title: string;
  content: string;
  tag: string;
  createdAt: string;
}

const CollectorTab: React.FC<{ userId: string }> = ({ userId }) => {
  const STORAGE_KEY = `franchise_collector_${userId}`;
  const [items, setItems]       = useState<ManuscriptItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ManuscriptItem | null>(null);
  const [form, setForm]         = useState({ title: '', content: '', tag: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('전체');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s) as ManuscriptItem[];
        setItems(parsed);
        if (parsed.length > 0) setSelectedId(parsed[0].id);
      }
    } catch {}
  }, [STORAGE_KEY]);

  const save = (next: ManuscriptItem[]) => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editingItem) {
      const updated = { ...editingItem, title: form.title.trim(), content: form.content.trim(), tag: form.tag.trim() || '일반' };
      save(items.map(it => it.id === editingItem.id ? updated : it));
      setSelectedId(updated.id);
      setEditingItem(null);
    } else {
      const newItem: ManuscriptItem = {
        id: `ms_${Date.now()}`,
        title: form.title.trim(),
        content: form.content.trim(),
        tag: form.tag.trim() || '일반',
        createdAt: new Date().toISOString(),
      };
      save([newItem, ...items]);
      setSelectedId(newItem.id);
    }
    setForm({ title: '', content: '', tag: '' });
    setShowForm(false);
  };

  const handleEdit = (item: ManuscriptItem) => {
    setEditingItem(item);
    setForm({ title: item.title, content: item.content, tag: item.tag });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 원고를 삭제할까요?')) return;
    const next = items.filter(it => it.id !== id);
    save(next);
    setSelectedId(next.length > 0 ? next[0].id : null);
    if (mobileView === 'detail') setMobileView('list');
  };

  const copyContent = (item: ManuscriptItem) => {
    navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const allTags  = ['전체', ...Array.from(new Set(items.map(it => it.tag)))];
  const filtered = items.filter(it => {
    const matchTag    = selectedTag === '전체' || it.tag === selectedTag;
    const matchSearch = !searchQuery || it.title.includes(searchQuery) || it.content.includes(searchQuery) || it.tag.includes(searchQuery);
    return matchTag && matchSearch;
  });
  const selectedItem = items.find(it => it.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      {/* 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">원고수집기</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">원고 템플릿을 저장하고 필요할 때 바로 꺼내 쓰세요</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingItem(null); setForm({ title: '', content: '', tag: '' }); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-colors"
        >
          + 원고 추가
        </button>
      </div>

      {/* 추가/수정 폼 (오버레이 모달) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900 text-base">{editingItem ? '원고 수정' : '새 원고 추가'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none font-black">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="제목 (필수)"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
              <input
                type="text"
                placeholder="태그"
                value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400"
              />
            </div>
            <textarea
              placeholder="원고 내용 (필수)"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={8}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); }}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button type="button" onClick={handleSubmit} disabled={!form.title.trim() || !form.content.trim()}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editingItem ? '수정 완료' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-36"
        />
        {allTags.map(tag => (
          <button key={tag} type="button" onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1 rounded-full text-xs font-black transition-colors ${selectedTag === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {tag}
          </button>
        ))}
      </div>

      {/* 두 패널 레이아웃 */}
      {items.length === 0 ? (
        <div className="py-20 text-center text-gray-300">
          <div className="text-5xl mb-3">📂</div>
          <p className="font-black text-base">저장된 원고가 없습니다</p>
          <p className="text-xs mt-1">원고 추가 버튼으로 첫 원고를 저장해보세요</p>
        </div>
      ) : (
        <>
          {/* 모바일: 뒤로가기 버튼 */}
          {mobileView === 'detail' && selectedItem && (
            <button type="button" onClick={() => setMobileView('list')}
              className="md:hidden flex items-center gap-1.5 text-sm font-black text-blue-600 hover:text-blue-700">
              ← 목록으로
            </button>
          )}

          <div className="flex border border-gray-200 rounded-2xl overflow-hidden bg-white" style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
            {/* 왼쪽 패널 — 목록 */}
            <div className={`${mobileView === 'detail' ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-72 lg:w-80 shrink-0 border-r border-gray-100`}>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                <p className="text-[11px] font-black text-gray-400 uppercase">원고 목록 {filtered.length > 0 && `(${filtered.length})`}</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-gray-300 text-xs font-bold">검색 결과 없음</div>
                ) : (
                  filtered.map(item => {
                    const isActive = selectedId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setSelectedId(item.id); setMobileView('detail'); }}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>{item.title}</p>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.content.slice(0, 40)}{item.content.length > 40 ? '...' : ''}</p>
                          </div>
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-500 border border-blue-100 whitespace-nowrap">{item.tag}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 오른쪽 패널 — 내용 */}
            <div className={`${mobileView === 'list' ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0`}>
              {selectedItem ? (
                <>
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 truncate">{selectedItem.title}</p>
                      <p className="text-[11px] text-gray-400 font-bold mt-0.5">{selectedItem.tag} · {selectedItem.createdAt.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => copyContent(selectedItem)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${copiedId === selectedItem.id ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {copiedId === selectedItem.id ? '✓ 복사됨' : '📋 복사'}
                      </button>
                      <button type="button" onClick={() => handleEdit(selectedItem)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(selectedItem.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">{selectedItem.content}</pre>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                  <div className="text-5xl mb-3">📄</div>
                  <p className="font-black">원고를 선택하세요</p>
                  <p className="text-xs mt-1">왼쪽 목록에서 원고를 클릭하면 내용이 표시됩니다</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   구독관리
══════════════════════════════════════════════ */
const PLAN_COLORS = ['blue', 'purple', 'emerald', 'orange', 'pink'];

const SubscriptionTab: React.FC<{ user: UserProfile }> = ({ user }) => {
  const STORAGE_KEY = `franchise_sub_${user.id}`;
  const [plans, setPlans]           = useState<FranchisePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activePlan, setActivePlan]   = useState<string | null>(null);
  const [activeUntil, setActiveUntil] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    fetchFranchisePlans().then(setPlans);
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const d = JSON.parse(s);
        setActivePlan(d.plan ?? null);
        setActiveUntil(d.until ?? null);
      }
    } catch {}
  }, [STORAGE_KEY]);

  const activePlans = plans.filter(p => p.isActive);
  const isActive    = activePlan && activeUntil && new Date(activeUntil) > new Date();
  const planLabel   = activePlans.find(p => p.id === activePlan)?.name ?? null;

  const handleRequestPayment = () => {
    if (!selectedPlan) { alert('플랜을 선택해주세요.'); return; }
    setShowContact(true);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-black text-gray-900">구독관리</h2>
        <p className="text-xs text-gray-400 font-bold mt-0.5">가맹점 구독료를 결제하고 모든 기능을 이용하세요</p>
      </div>

      {/* 현재 구독 상태 */}
      <div className={`rounded-2xl p-5 border-2 ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isActive ? 'bg-emerald-100' : 'bg-gray-200'}`}>
            {isActive ? '✅' : '⏸'}
          </div>
          <div>
            <p className={`font-black text-base ${isActive ? 'text-emerald-800' : 'text-gray-600'}`}>
              {isActive ? `구독 중 — ${planLabel}` : '구독 없음'}
            </p>
            {isActive && activeUntil && (
              <p className="text-xs text-emerald-600 font-bold mt-0.5">
                {activeUntil.slice(0, 10)} 까지 이용 가능
              </p>
            )}
            {!isActive && (
              <p className="text-xs text-gray-400 font-bold mt-0.5">아래에서 플랜을 선택하고 결제를 신청하세요</p>
            )}
          </div>
        </div>
      </div>

      {/* 플랜 선택 */}
      {activePlans.length === 0 ? (
        <div className="py-10 text-center text-gray-300">
          <p className="font-black">등록된 플랜이 없습니다</p>
          <p className="text-xs mt-1">관리자에게 문의하세요</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${activePlans.length === 1 ? '' : 'sm:grid-cols-2'}`}>
          {activePlans.map((plan, idx) => {
            const color      = PLAN_COLORS[idx % PLAN_COLORS.length];
            const isSelected = selectedPlan === plan.id;
            const isCurrent  = activePlan === plan.id && !!isActive;
            const colorSel: Record<string, string> = {
              blue:    isSelected ? 'border-blue-500 bg-blue-50'    : 'border-gray-200 bg-white hover:border-blue-300',
              purple:  isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300',
              emerald: isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300',
              orange:  isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300',
              pink:    isSelected ? 'border-pink-500 bg-pink-50'    : 'border-gray-200 bg-white hover:border-pink-300',
            };
            const dotColor: Record<string, string> = {
              blue: 'bg-blue-600', purple: 'bg-purple-600', emerald: 'bg-emerald-600', orange: 'bg-orange-500', pink: 'bg-pink-500',
            };
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`text-left rounded-2xl border-2 p-5 transition-all ${colorSel[color]}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900">{plan.name}</span>
                      {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-black">현재 플랜</span>}
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-1">
                      {plan.price.toLocaleString()}
                      <span className="text-sm font-bold text-gray-400">원/{plan.period}</span>
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${isSelected ? `${dotColor[color]} border-transparent` : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 font-bold">
                      <span className="text-emerald-500 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      {/* 결제 신청 버튼 */}
      <button
        type="button"
        onClick={handleRequestPayment}
        disabled={!selectedPlan}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selectedPlan
          ? `${activePlans.find(p => p.id === selectedPlan)?.name} 결제 신청하기`
          : '플랜을 선택하세요'}
      </button>

      {/* 결제 안내 모달 */}
      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">💳</div>
              <h3 className="font-black text-gray-900 text-lg">결제 신청 안내</h3>
              <p className="text-sm text-gray-500 mt-1">
                아래 채널로 문의 주시면<br />결제 링크를 보내드립니다
              </p>
            </div>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <span className="text-2xl shrink-0">💬</span>
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase">카카오톡 채널</p>
                  <p className="font-black text-gray-900">@bestsns</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-700">
                  신청 시 아이디 <span className="font-black">{user.nickname}</span> 와{' '}
                  선택 플랜 <span className="font-black">{activePlans.find(p => p.id === selectedPlan)?.name}</span> 을 함께 알려주세요
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setShowContact(false)}
              className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200 transition-colors">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   마케팅상품 주문
══════════════════════════════════════════════ */
const MarketingTab: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [products, setProducts]   = useState<FranchiseProduct[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<FranchiseProduct | null>(null);
  const [link, setLink]           = useState('');
  const [quantity, setQuantity]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('전체');

  useEffect(() => {
    fetchFranchiseProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const visible    = filterCategory === '전체' ? products : products.filter(p => p.category === filterCategory);

  const handleOrder = async () => {
    if (!selected || !link.trim() || !quantity) return;
    const qty = Number(quantity);
    if (isNaN(qty) || qty < selected.minQuantity || qty > selected.maxQuantity) {
      alert(`수량은 ${selected.minQuantity.toLocaleString()} ~ ${selected.maxQuantity.toLocaleString()} 사이여야 합니다.`);
      return;
    }
    setSubmitting(true);
    try {
      const orderId = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await upsertSmmOrders([{
        id: orderId,
        userId: user.id,
        userNickname: user.nickname,
        orderTime: new Date().toISOString(),
        platform: selected.category || '가맹점',
        productName: selected.name,
        link: link.trim(),
        quantity: qty,
        initialCount: 0,
        remains: qty,
        providerName: '가맹점주문',
        costPrice: 0,
        sellingPrice: selected.price * qty,
        profit: 0,
        status: 'pending',
        externalOrderId: '',
      }]);
      setSuccessMsg(`[${selected.name}] 주문이 접수되었습니다. 관리자 확인 후 진행됩니다.`);
      setSelected(null);
      setLink('');
      setQuantity('');
    } catch {
      alert('주문 접수에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400 font-bold">상품 불러오는 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-black text-gray-900">마케팅상품 주문</h2>
        <p className="text-xs text-gray-400 font-bold mt-0.5">운영자가 등록한 마케팅 프로그램 상품을 주문하세요. 접수 후 관리자 확인을 거쳐 진행됩니다.</p>
      </div>

      {successMsg && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4">
          <span className="text-2xl shrink-0">✅</span>
          <div>
            <p className="font-black text-emerald-800 text-sm">{successMsg}</p>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-600 font-bold hover:underline mt-1">닫기</button>
          </div>
        </div>
      )}

      {/* 카테고리 필터 */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} type="button" onClick={() => setFilterCategory(c)}
              className={`px-3 py-1 rounded-full text-xs font-black transition-colors ${filterCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 상품 그리드 */}
      {visible.length === 0 ? (
        <div className="py-16 text-center text-gray-300">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-black">등록된 상품이 없습니다</p>
          <p className="text-xs mt-1">운영자가 상품을 등록하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => { setSelected(product); setLink(''); setQuantity(String(product.minQuantity)); setSuccessMsg(null); }}
              className={`text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md ${selected?.id === product.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                {product.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-600">{product.category}</span>}
                <span className="text-xs font-black text-blue-600 shrink-0 ml-auto">{product.price.toLocaleString()}원</span>
              </div>
              <p className="font-black text-gray-900 text-sm leading-snug">{product.name}</p>
              {product.description && <p className="text-[11px] text-gray-400 mt-1 font-bold line-clamp-2">{product.description}</p>}
              <p className="text-[10px] text-gray-300 mt-1">최소 {product.minQuantity.toLocaleString()} ~ 최대 {product.maxQuantity.toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}

      {/* 주문 폼 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-gray-900">주문 접수</h3>
                <button type="button" onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 font-black text-lg leading-none">✕</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selected.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-600">{selected.category}</span>}
                <span className="text-sm font-black text-gray-800">{selected.name}</span>
              </div>
              {selected.description && <p className="text-xs text-gray-400 mt-1">{selected.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">대상 링크 <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">
                수량 <span className="text-red-500">*</span>
                <span className="text-gray-300 ml-1 font-bold">({selected.minQuantity.toLocaleString()} ~ {selected.maxQuantity.toLocaleString()})</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={selected.minQuantity}
                max={selected.maxQuantity}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold"
              />
            </div>

            {quantity && !isNaN(Number(quantity)) && Number(quantity) > 0 && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-black text-blue-600">예상 금액</span>
                <span className="font-black text-blue-800">{(selected.price * Number(quantity)).toLocaleString()}원</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setSelected(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button
                type="button"
                onClick={handleOrder}
                disabled={submitting || !link.trim() || !quantity}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '접수 중...' : '주문 접수'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점 현황 (어드민 전용)
══════════════════════════════════════════════ */
const MembersTab: React.FC<{ members: UserProfile[]; onUpdateUser?: (u: UserProfile) => void }> = ({ members, onUpdateUser }) => {
  const [search, setSearch]           = useState('');
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);
  const [errMsg, setErrMsg]           = useState<string | null>(null);
  useEffect(() => { setLocalMembers(members); }, [members]);

  const toggleFranchise = async (member: UserProfile) => {
    if (togglingId) return;
    setTogglingId(member.id);
    setErrMsg(null);
    const newVal  = !member.isFranchise;
    const updated = { ...member, isFranchise: newVal };

    // 낙관적 업데이트 — 즉시 UI 반영
    setLocalMembers(prev => prev.map(m => m.id === member.id ? updated : m));
    if (onUpdateUser) onUpdateUser(updated);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_franchise: newVal })
        .eq('id', member.id);

      if (error) {
        // 롤백
        setLocalMembers(prev => prev.map(m => m.id === member.id ? member : m));
        if (onUpdateUser) onUpdateUser(member);
        setErrMsg(`저장 실패: ${error.message} — Supabase profiles 테이블에 is_franchise (boolean) 컬럼이 필요합니다.`);
      }
    } catch (e) {
      setLocalMembers(prev => prev.map(m => m.id === member.id ? member : m));
      if (onUpdateUser) onUpdateUser(member);
      setErrMsg('네트워크 오류로 저장에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  const franchiseMembers = localMembers.filter(m => m.isFranchise);
  const visible = localMembers.filter(m => !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">현재 {franchiseMembers.length}개 가맹점 활성 · 선택된 회원은 가맹점패널에 접근할 수 있습니다</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임·ID 검색..."
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-48" />
      </div>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-700 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{errMsg}</span>
        </div>
      )}

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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={member.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" />
                      <span className="font-black text-gray-900 whitespace-nowrap">{member.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={togglingId === member.id || member.role === 'admin'}
                      onClick={() => toggleFranchise(member)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${member.isFranchise ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    >
                      {togglingId === member.id ? '저장 중...' : member.isFranchise ? '✓ 가맹점' : '가맹점 선택'}
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
  const isAdmin   = user.role === 'admin' || user.role === 'manager';
  const canAccess = isAdmin || !!user.isFranchise;

  const defaultTab: FranchiseTab = isAdmin ? 'members' : 'subscription';
  const [activeTab, setActiveTab] = useState<FranchiseTab>(defaultTab);

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
    { id: 'subscription', label: '구독관리',    icon: '💳' },
    { id: 'revenue',      label: '매출관리',    icon: '📊' },
    { id: 'manuscripts',  label: '원고시트',    icon: '📝' },
    { id: 'collector',    label: '원고수집기',  icon: '🗂️' },
    { id: 'marketing',    label: '마케팅상품',  icon: '📣' },
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
        {activeTab === 'members'      && isAdmin && <MembersTab members={members} onUpdateUser={onUpdateUser} />}
        {activeTab === 'subscription'              && <SubscriptionTab user={user} />}
        {activeTab === 'revenue'                   && <RevenueManagement user={user} />}
        {activeTab === 'manuscripts'               && <ManuscriptSheet userId={user.id} />}
        {activeTab === 'collector'                 && <CollectorTab userId={user.id} />}
        {activeTab === 'marketing'                 && <MarketingTab user={user} />}
      </div>
    </div>
  );
};

export default FranchisePanel;
