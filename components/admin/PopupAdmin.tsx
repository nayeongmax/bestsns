import React, { useState, useEffect } from 'react';
import { fetchAllPopups, upsertPopup, deletePopup, deactivateAllPopups, SitePopup } from '@/popupDb';

const newPopup = (): SitePopup => ({
  id: `popup_${Date.now()}`,
  title: '',
  body: '',
  imageUrl: '',
  isActive: false,
  createdAt: new Date().toISOString(),
});

const PopupAdmin: React.FC = () => {
  const [popups, setPopups] = useState<SitePopup[]>([]);
  const [editing, setEditing] = useState<SitePopup | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setPopups(await fetchAllPopups()); } catch { setMsg('불러오기 실패'); }
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { flash('제목을 입력해주세요.'); return; }
    setSaving(true);
    try {
      await upsertPopup(editing);
      flash('저장되었습니다.');
      setEditing(null);
      await load();
    } catch { flash('저장 실패'); }
    setSaving(false);
  };

  const handlePublish = async (popup: SitePopup) => {
    setSaving(true);
    try {
      await deactivateAllPopups();
      await upsertPopup({ ...popup, isActive: true });
      flash(`"${popup.title}" 팝업이 게시되었습니다.`);
      await load();
    } catch { flash('게시 실패'); }
    setSaving(false);
  };

  const handleDeactivate = async (popup: SitePopup) => {
    setSaving(true);
    try {
      await upsertPopup({ ...popup, isActive: false });
      flash('팝업이 비활성화되었습니다.');
      await load();
    } catch { flash('실패'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await deletePopup(id);
      flash('삭제되었습니다.');
      await load();
    } catch { flash('삭제 실패'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">팝업 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">게시된 팝업은 1개만 활성화됩니다. 새 팝업 게시 시 기존 팝업은 자동 비활성화됩니다.</p>
        </div>
        <button
          onClick={() => setEditing(newPopup())}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-700 transition-colors"
        >
          + 새 팝업 만들기
        </button>
      </div>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold px-4 py-2 rounded-xl">{msg}</div>
      )}

      {/* 팝업 목록 */}
      {popups.length === 0 && !editing && (
        <div className="text-center py-16 text-gray-300 font-black text-lg">팝업이 없습니다</div>
      )}

      <div className="space-y-3">
        {popups.map((p) => (
          <div key={p.id} className={`rounded-2xl border p-4 flex gap-4 items-start ${p.isActive ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
            {p.imageUrl && (
              <img src={p.imageUrl} alt="" className="w-20 h-14 object-cover rounded-xl shrink-0 border border-gray-100" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {p.isActive && <span className="text-[10px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full">게시 중</span>}
                <span className="font-black text-gray-900 text-sm truncate">{p.title}</span>
              </div>
              {p.body && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.body}</p>}
              <p className="text-[10px] text-gray-300 mt-1">{p.createdAt.slice(0, 10)}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {p.isActive ? (
                <button onClick={() => handleDeactivate(p)} disabled={saving} className="px-3 py-1.5 text-xs font-black bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">비활성화</button>
              ) : (
                <button onClick={() => handlePublish(p)} disabled={saving} className="px-3 py-1.5 text-xs font-black bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">게시</button>
              )}
              <button onClick={() => setEditing({ ...p })} className="px-3 py-1.5 text-xs font-black bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">수정</button>
              <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs font-black bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {/* 편집 폼 */}
      {editing && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 px-6 py-5 flex items-center justify-between">
              <h3 className="text-white font-black text-lg">팝업 {editing.createdAt === popups.find(p => p.id === editing.id)?.createdAt ? '수정' : '만들기'}</h3>
              <button onClick={() => setEditing(null)} className="text-white/60 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
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
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">이미지 URL <span className="text-gray-300 font-normal">(선택)</span></label>
                <input
                  value={editing.imageUrl}
                  onChange={e => setEditing({ ...editing, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.png"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-gray-400"
                />
                {editing.imageUrl && (
                  <img src={editing.imageUrl} alt="미리보기" className="mt-2 w-full max-h-40 object-contain rounded-xl border border-gray-100 bg-gray-50" />
                )}
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wider">본문 내용 <span className="text-gray-300 font-normal">(선택)</span></label>
                <textarea
                  value={editing.body}
                  onChange={e => setEditing({ ...editing, body: e.target.value })}
                  placeholder="팝업에 표시할 내용을 입력하세요"
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-gray-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-gray-900 text-white font-black py-3 rounded-2xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-5 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupAdmin;
