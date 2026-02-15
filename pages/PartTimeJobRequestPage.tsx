import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { NotificationType, PartTimeJobRequest } from '@/types';
import { getPartTimeJobRequests, setPartTimeJobRequests } from '@/constants';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
  user: UserProfile;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const PartTimeJobRequestPage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editRequest = (location.state as { editJobRequest?: PartTimeJobRequest; fromAlba?: boolean })?.editJobRequest;
  const fromAlba = (location.state as { fromAlba?: boolean })?.fromAlba;
  const [title, setTitle] = useState('');
  const [workContent, setWorkContent] = useState('');
  const [platformLinks, setPlatformLinks] = useState<string[]>(['']);
  const [contact, setContact] = useState('');
  const [workPeriodStart, setWorkPeriodStart] = useState(todayStr());
  const [workPeriodEnd, setWorkPeriodEnd] = useState(todayStr());
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (editRequest && editRequest.applicantUserId === user.id) {
      setTitle(editRequest.title);
      setWorkContent(editRequest.workContent);
      const pl = editRequest.platformLinks?.length ? editRequest.platformLinks : (editRequest.platformLink ? editRequest.platformLink.split(',').map((s) => s.trim()).filter(Boolean) : ['']);
      setPlatformLinks(pl.length ? pl : ['']);
      setContact(editRequest.contact || '');
      setWorkPeriodStart(editRequest.workPeriodStart);
      setWorkPeriodEnd(editRequest.workPeriodEnd);
    }
  }, [editRequest?.id, user.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('알바광고 신청제목을 입력해 주세요.');
      return;
    }
    if (!workContent.trim()) {
      alert('작업내용을 입력해 주세요.');
      return;
    }
    if (!contact.trim()) {
      alert('연락처를 입력해 주세요.');
      return;
    }
    const requests = getPartTimeJobRequests();
    if (editRequest && editRequest.applicantUserId === user.id) {
      const updated = {
        ...editRequest,
        title: title.trim(),
        workContent: workContent.trim(),
        platformLink: platformLinks.filter(Boolean).join(', ') || '',
        platformLinks: platformLinks.filter(Boolean),
        contact: contact.trim(),
        workPeriodStart,
        workPeriodEnd,
        adAmount: editRequest.adAmount ?? 0,
        fee: editRequest.fee ?? 0,
        status: 'pending_review' as const,
        rejectReason: undefined,
      };
      setPartTimeJobRequests(requests.map((r) => (r.id === editRequest.id ? updated : r)));
      setShowModal(true);
    } else {
      const plTrimmed = platformLinks.map((s) => s.trim()).filter(Boolean);
      const newRequest = {
        id: `jr_${Date.now()}`,
        title: title.trim(),
        workContent: workContent.trim(),
        platformLink: plTrimmed.join(', ') || '',
        platformLinks: plTrimmed,
        contact: contact.trim(),
        workPeriodStart,
        workPeriodEnd,
        adAmount: 0,
        unitPrice: undefined,
        quantity: 1,
        fee: 0,
        applicantUserId: user.id,
        status: 'pending_review' as const,
        paid: false,
        createdAt: new Date().toISOString(),
      };
      setPartTimeJobRequests([newRequest, ...requests]);
      setShowModal(true);
    }
  };

  const handleModalConfirm = () => {
    setShowModal(false);
    if (fromAlba) navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } });
    else navigate('/part-time');
  };

  const handleBack = () => {
    if (fromAlba) navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } });
    else navigate('/part-time');
  };

  const handleDelete = () => {
    if (!editRequest || editRequest.applicantUserId !== user.id) return;
    if (!confirm('정말 이 의뢰를 삭제하시겠습니까?')) return;
    const requests = getPartTimeJobRequests().filter((r) => r.id !== editRequest.id);
    setPartTimeJobRequests(requests);
    alert('삭제되었습니다.');
    if (fromAlba) navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } });
    else navigate('/part-time');
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 md:px-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-500 font-bold text-base hover:text-gray-900 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          돌아가기
        </button>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-emerald-500 underline-offset-8">
          {editRequest ? '작업의뢰 수정' : '작업의뢰 신청'}
        </h2>
        <div className="flex gap-2">
          {editRequest && (
            <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-black text-sm hover:bg-red-200">
              삭제
            </button>
          )}
          <div className="w-16" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[48px] p-8 md:p-12 shadow-xl border border-gray-100 space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-6 border border-slate-600/50 shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 to-transparent" />
          <div className="relative space-y-3">
            <p className="text-white text-xl font-black leading-relaxed">
              최고의 전문가 프리랜서로 선별 매칭합니다.
            </p>
            <p className="text-white/95 font-semibold text-base leading-relaxed">
              부적합한 업종(선거, 토토, 바카라, 19금 불법 유흥업소, 다단계 등)의 불법게시물 작업을 엄격히 제한합니다.
            </p>
            <p className="text-amber-300/90 font-bold text-sm">
              작업결과물로 인한 법적인 부분의 책임은 광고주에게 있습니다.
            </p>
            <p className="text-emerald-300 font-bold text-base pt-1">
              최고의 전문가를 선별 매칭하고, 거품 없는 합리적인 견적을 제안드리겠습니다!
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">알바광고 신청제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 인스타그램 게시글 작성 의뢰"
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold text-base"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">작업내용 *</label>
          <textarea
            value={workContent}
            onChange={(e) => setWorkContent(e.target.value)}
            placeholder="작업 내용을 상세히 작성해 주세요."
            rows={6}
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-base resize-y min-h-[160px]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">플랫폼링크 (작업 대상 SNS/채널 주소)</label>
          <div className="space-y-2">
            {platformLinks.map((link, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setPlatformLinks((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  placeholder="https://instagram.com/... 또는 https://youtube.com/..."
                  className="flex-1 px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-base"
                />
                {platformLinks.length > 1 && (
                  <button type="button" onClick={() => setPlatformLinks((prev) => prev.filter((_, i) => i !== idx))} className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-bold hover:bg-red-200 shrink-0">
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setPlatformLinks((prev) => [...prev, ''])} className="mt-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200">
              + 플랫폼링크 추가
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">연락처 *</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="이메일 또는 전화번호"
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold text-base"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">작업기간 시작</label>
            <input
              type="date"
              value={workPeriodStart}
              onChange={(e) => setWorkPeriodStart(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-base [color-scheme:light]"
            />
          </div>
          <div>
            <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">작업기간 종료</label>
            <input
              type="date"
              value={workPeriodEnd}
              onChange={(e) => setWorkPeriodEnd(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-base [color-scheme:light]"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all text-lg"
        >
          {editRequest ? '수정하여 재신청' : '의뢰 신청'}
        </button>
      </form>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="text-emerald-600 text-4xl">✓</div>
            <div className="space-y-2">
              <p className="font-black text-gray-900 text-base">{editRequest ? '수정하여 재신청되었습니다.' : '신청완료되었습니다.'}</p>
              <p className="text-gray-700 text-base">적합한 작업인지 확인 후 승인해드리겠습니다.</p>
              <p className="text-gray-700 text-base">승인되면, 프리랜서 워크페이스 → 알바의뢰 (광고주한정) 탭에서 결제해주세요.</p>
              <p className="text-gray-700 text-base">결제완료되면 프리랜서 모집글이 업로드 됩니다.</p>
            </div>
            <button
              onClick={handleModalConfirm}
              className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartTimeJobRequestPage;
