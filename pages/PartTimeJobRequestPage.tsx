import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPartTimeJobRequests, setPartTimeJobRequests, calcJobRequestFee } from '@/constants';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PartTimeJobRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [workContent, setWorkContent] = useState('');
  const [platformLink, setPlatformLink] = useState('');
  const [contact, setContact] = useState('');
  const [workPeriodStart, setWorkPeriodStart] = useState(todayStr());
  const [workPeriodEnd, setWorkPeriodEnd] = useState(todayStr());
  const [adAmount, setAdAmount] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);

  const fee = calcJobRequestFee(adAmount);

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
    const newRequest = {
      id: `jr_${Date.now()}`,
      title: title.trim(),
      workContent: workContent.trim(),
      platformLink: platformLink.trim(),
      contact: contact.trim(),
      workPeriodStart,
      workPeriodEnd,
      adAmount,
      fee,
      status: 'pending_review' as const,
      createdAt: new Date().toISOString(),
    };
    setPartTimeJobRequests([newRequest, ...requests]);
    setShowModal(true);
  };

  const handleModalConfirm = () => {
    setShowModal(false);
    navigate('/part-time');
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 md:px-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/part-time')} className="flex items-center gap-2 text-gray-500 font-bold text-base hover:text-gray-900 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          돌아가기
        </button>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-emerald-500 underline-offset-8">
          작업의뢰 신청
        </h2>
        <div className="w-24" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[48px] p-8 md:p-12 shadow-xl border border-gray-100 space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-5 border border-slate-600/50 shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 to-transparent" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-white/95 font-semibold text-base leading-relaxed">
              광고주님의 만족스런 결과를 위해 맞춤형 프리랜서로 선정됩니다. · 부적합한 업종(선거, 토토, 바카라, 19금 불법 유흥업소, 다단계 등)의 게시물 불법 작업 사용을 엄격히 제한합니다.
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
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">플랫폼링크</label>
          <input
            type="url"
            value={platformLink}
            onChange={(e) => setPlatformLink(e.target.value)}
            placeholder="https://..."
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-base"
          />
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

        <div>
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">광고금액 (프리랜서에게 지급되는 금액, P)</label>
          <input
            type="number"
            min={0}
            value={adAmount || ''}
            onChange={(e) => setAdAmount(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold text-base"
          />
        </div>

        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <label className="block text-sm font-black text-gray-600 uppercase tracking-wider mb-2">수수료 (광고금액의 15% + 광고수수료의 부가세 10% 자동계산)</label>
          <p className="text-2xl font-black text-emerald-700">{fee.toLocaleString()} P</p>
        </div>

        <button
          type="submit"
          className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all text-lg"
        >
          의뢰 신청
        </button>
      </form>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="text-emerald-600 text-4xl">✓</div>
            <div className="space-y-2">
              <p className="font-black text-gray-900 text-lg">신청완료되었습니다.</p>
              <p className="text-gray-700">곧 운영자가 연락드리겠습니다.</p>
              <p className="text-gray-700">만족스런 작업결과물로 보답드리겠습니다.</p>
              <p className="text-gray-600 text-sm">조금만 기다려주세요.</p>
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
