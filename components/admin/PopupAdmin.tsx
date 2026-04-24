import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllPopups, upsertPopup, deletePopup, deactivateAllPopups, SitePopup } from '@/popupDb';

const newPopup = (): SitePopup => ({
  id: `popup_${Date.now()}`,
  title: '',
  body: '',
  imageUrl: '',
  isActive: false,
  createdAt: new Date().toISOString(),
});

const MAX_IMG_PX = 1200;

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/* ── 리치텍스트 에디터 ── */
const COLORS = ['#000000','#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#ffffff'];

const RichEditor: React.FC<{ value: string; onChange: (html: string) => void }> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const isInit = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInit.current) {
      editorRef.current.innerHTML = value;
      isInit.current = true;
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  // px 단위 폰트 사이즈: execCommand fontSize → <font> → <span style> 로 교체
  const applyFontSize = useCallback((px: string) => {
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('font[size="7"]').forEach(el => {
      const span = document.createElement('span');
      span.style.fontSize = px;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const ToolBtn = ({ label, title, onClick, active }: { label: string; title: string; onClick: () => void; active?: boolean }) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm font-bold transition-colors ${active ? 'bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
    >{label}</button>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolBtn label="B" title="굵게" onClick={() => exec('bold')} />
        <ToolBtn label="I" title="기울기" onClick={() => exec('italic')} />
        <ToolBtn label="U" title="밑줄" onClick={() => exec('underline')} />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn label="≡" title="왼쪽 정렬" onClick={() => exec('justifyLeft')} />
        <ToolBtn label="≡" title="가운데 정렬" onClick={() => exec('justifyCenter')} />
        <ToolBtn label="≡" title="오른쪽 정렬" onClick={() => exec('justifyRight')} />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* 폰트 사이즈 */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => applyFontSize(e.target.value)}
          value=""
          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-20"
        >
          <option value="" disabled>크기</option>
          {[10,12,13,14,15,16,18,20,22,24,28,32,36,40,48].map(s => (
            <option key={s} value={`${s}px`}>{s}px</option>
          ))}
        </select>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* 색상 프리셋 */}
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            onMouseDown={e => { e.preventDefault(); exec('foreColor', c); }}
            className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
            style={{ background: c }}
          />
        ))}
        {/* 색상 피커 */}
        <button
          type="button"
          title="색상 직접 선택"
          onMouseDown={e => { e.preventDefault(); colorRef.current?.click(); }}
          className="text-xs px-1.5 py-0.5 border border-gray-200 rounded hover:bg-gray-100 text-gray-500"
        >🎨</button>
        <input
          ref={colorRef}
          type="color"
          className="hidden"
          onChange={e => exec('foreColor', e.target.value)}
        />
      </div>
      {/* 편집 영역 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[120px] px-4 py-3 text-sm focus:outline-none"
        style={{ lineHeight: 1.7 }}
      />
    </div>
  );
};

/* ── 메인 컴포넌트 ── */
const PopupAdmin: React.FC = () => {
  const [popups, setPopups] = useState<SitePopup[]>([]);
  const [editing, setEditing] = useState<SitePopup | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' }>({ text: '', type: 'ok' });
  const [imgLoading, setImgLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setPopups(await fetchAllPopups()); } catch (e) { flash('불러오기 실패: ' + String(e), 'err'); }
  };

  const flash = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000);
  };

  const handleImageFile = async (file: File) => {
    setImgLoading(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      setEditing(prev => prev ? { ...prev, imageUrl: dataUrl } : prev);
    } catch { flash('이미지 변환 실패', 'err'); }
    setImgLoading(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { flash('제목을 입력해주세요.', 'err'); return; }
    setSaving(true);
    try {
      await upsertPopup(editing);
      flash('저장되었습니다.');
      setEditing(null);
      await load();
    } catch (e) {
      flash('저장 실패: ' + (e instanceof Error ? e.message : String(e)), 'err');
    }
    setSaving(false);
  };

  const handlePublish = async (popup: SitePopup) => {
    setSaving(true);
    try {
      await deactivateAllPopups();
      await upsertPopup({ ...popup, isActive: true });
      flash(`"${popup.title}" 팝업이 게시되었습니다.`);
      await load();
    } catch (e) { flash('게시 실패: ' + String(e), 'err'); }
    setSaving(false);
  };

  const handleDeactivate = async (popup: SitePopup) => {
    setSaving(true);
    try {
      await upsertPopup({ ...popup, isActive: false });
      flash('팝업이 비활성화되었습니다.');
      await load();
    } catch (e) { flash('실패: ' + String(e), 'err'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await deletePopup(id);
      flash('삭제되었습니다.');
      await load();
    } catch (e) { flash('삭제 실패: ' + String(e), 'err'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">팝업 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">게시된 팝업은 1개만 활성화됩니다. 새 팝업 게시 시 기존 팝업은 자동 비활성화됩니다.</p>
        </div>
        <button onClick={() => setEditing(newPopup())} className="px-4 py-2 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-700 transition-colors">
          + 새 팝업 만들기
        </button>
      </div>

      {msg.text && (
        <div className={`border text-sm font-bold px-4 py-2 rounded-xl ${msg.type === 'err' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg.text}
        </div>
      )}

      {popups.length === 0 && !editing && (
        <div className="text-center py-16 text-gray-300 font-black text-lg">팝업이 없습니다</div>
      )}

      <div className="space-y-3">
        {popups.map((p) => (
          <div key={p.id} className={`rounded-2xl border p-4 flex gap-4 items-start ${p.isActive ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-20 h-14 object-cover rounded-xl shrink-0 border border-gray-100" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {p.isActive && <span className="text-[10px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full">게시 중</span>}
                <span className="font-black text-gray-900 text-sm truncate">{p.title}</span>
              </div>
              {p.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: p.body }} />}
              <p className="text-[10px] text-gray-300 mt-1">{p.createdAt.slice(0, 10)}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {p.isActive
                ? <button onClick={() => handleDeactivate(p)} disabled={saving} className="px-3 py-1.5 text-xs font-black bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">비활성화</button>
                : <button onClick={() => handlePublish(p)} disabled={saving} className="px-3 py-1.5 text-xs font-black bg-green-600 text-white rounded-lg hover:bg-green-700">게시</button>}
              <button onClick={() => setEditing({ ...p })} className="px-3 py-1.5 text-xs font-black bg-gray-900 text-white rounded-lg hover:bg-gray-700">수정</button>
              <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs font-black bg-red-50 text-red-500 rounded-lg hover:bg-red-100">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 px-6 py-5 flex items-center justify-between">
              <h3 className="text-white font-black text-lg">팝업 {popups.find(p => p.id === editing.id) ? '수정' : '만들기'}</h3>
              <button onClick={() => setEditing(null)} className="text-white/60 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">제목 *</label>
                <input
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder="팝업 제목을 입력하세요"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">이미지 <span className="text-gray-300 font-normal">(선택)</span></label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                {editing.imageUrl ? (
                  <div className="relative">
                    <img src={editing.imageUrl} alt="미리보기" className="w-full max-h-48 object-contain rounded-xl border border-gray-100 bg-gray-50" />
                    <button onClick={() => setEditing({ ...editing, imageUrl: '' })} className="absolute top-2 right-2 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-lg hover:bg-red-600">✕ 제거</button>
                    <button onClick={() => fileRef.current?.click()} className="mt-2 w-full border border-gray-200 text-gray-500 text-xs font-bold py-2 rounded-xl hover:bg-gray-50">이미지 교체</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={imgLoading}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                    <span className="text-2xl">{imgLoading ? '⏳' : '🖼️'}</span>
                    <span className="text-sm font-bold text-gray-400">{imgLoading ? '처리 중...' : '클릭하여 이미지 첨부'}</span>
                    <span className="text-xs text-gray-300">JPG, PNG, GIF 등 · 자동 리사이즈</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">본문 내용 <span className="text-gray-300 font-normal">(선택)</span></label>
                <RichEditor
                  key={editing.id}
                  value={editing.body}
                  onChange={html => setEditing(prev => prev ? { ...prev, body: html } : prev)}
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={handleSave} disabled={saving || imgLoading}
                className="flex-1 bg-gray-900 text-white font-black py-3 rounded-2xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setEditing(null)} className="px-5 text-sm font-black text-gray-400 hover:text-gray-600">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupAdmin;
