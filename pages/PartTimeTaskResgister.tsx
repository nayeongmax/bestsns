import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { getPartTimeTasks, setPartTimeTasks } from '@/constants';

interface Props {
  user: UserProfile | null;
}

const CATEGORIES = ['설문', 'SNS', '카페', '리뷰', '검수', '라벨링', '번역', '기타'];
const SECTION_KEYS = ['제목', '내용', '댓글', '키워드', '이미지'] as const;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PartTimeTaskRegister: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [reward, setReward] = useState(300);
  const [sections, setSections] = useState<Record<string, string>>({
    제목: '',
    내용: '',
    댓글: '',
    키워드: '',
    이미지: '',
  });
  const [appStart, setAppStart] = useState(today());
  const [appEnd, setAppEnd] = useState(today());
  const [workStart, setWorkStart] = useState(today());
  const [workEnd, setWorkEnd] = useState(today());

  if (!user || user.role !== 'admin') {
    navigate('/part-time', { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('제목을 입력해 주세요.');
      return;
    }
    const tasks = getPartTimeTasks();
    const newTask: PartTimeTask = {
      id: `t_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      reward: Math.max(0, reward),
      sections: { 제목: sections.제목, 내용: sections.내용, 댓글: sections.댓글, 키워드: sections.키워드, 이미지: sections.이미지 },
      applicationPeriod: { start: appStart, end: appEnd },
      workPeriod: { start: workStart, end: workEnd },
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      applicants: [],
      pointPaid: false,
      paidUserIds: [],
    };
    setPartTimeTasks([newTask, ...tasks]);
    alert('작업이 등록되었습니다.');
    navigate('/part-time');
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900">프리랜서 작업 등록</h2>
          <button type="button" onClick={() => navigate('/part-time')} className="text-gray-500 hover:text-gray-800 font-bold text-sm">
            ← 목록
          </button>
        </div>
        <p className="text-sm text-gray-500">운영자만 작업을 등록할 수 있습니다. 등록한 작업은 누구나알바 목록에 노출됩니다.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-gray-700 mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-black text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 카페 글 작성"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-black text-gray-700 mb-1">간단 설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="한 줄 요약"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-black text-gray-700 mb-1">보상 포인트 (P)</label>
            <input
              type="number"
              min={0}
              value={reward}
              onChange={(e) => setReward(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-black text-gray-700 mb-3">작업 내용 (작업자가 할 일 – 섹션별 안내)</p>
            {SECTION_KEYS.map((key) => (
              <div key={key} className="mb-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">{key}</label>
                <input
                  type="text"
                  value={sections[key] ?? ''}
                  onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder={`예: ${key} 관련 지시사항`}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-1">신청기간 시작</label>
              <input
                type="date"
                value={appStart}
                onChange={(e) => setAppStart(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-1">신청기간 종료</label>
              <input
                type="date"
                value={appEnd}
                onChange={(e) => setAppEnd(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-1">작업기간 시작</label>
              <input
                type="date"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-1">작업기간 종료</label>
              <input
                type="date"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all"
            >
              작업 등록하기
            </button>
            <button
              type="button"
              onClick={() => navigate('/part-time')}
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartTimeTaskRegister;
