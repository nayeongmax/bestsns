import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask, PartTimeTaskSections } from '@/types';
import { fetchPartTimeTasks, upsertPartTimeTask } from '../parttimeDb';

interface Props {
  user: UserProfile | null;
}

const CATEGORIES = ['설문', 'SNS', '카페', '리뷰', '검수', '라벨링', '번역', '기타'];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const SECTION_KEYS: (keyof PartTimeTaskSections)[] = ['제목', '내용', '댓글', '키워드', '이미지', 'gif'];

const PartTimeTaskRegister: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTask = (location.state as { editTask?: PartTimeTask } | null)?.editTask;
  const isEditing = !!editTask;

  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [category, setCategory] = useState(editTask?.category ?? CATEGORIES[0]);
  const [reward, setReward] = useState(editTask?.reward ?? 300);
  const [maxApplicants, setMaxApplicants] = useState(editTask?.maxApplicants ?? 0);
  const [sections, setSections] = useState<Record<string, string>>({
    제목: editTask?.sections?.제목 ?? '',
    내용: editTask?.sections?.내용 ?? '',
    댓글: editTask?.sections?.댓글 ?? '',
    키워드: editTask?.sections?.키워드 ?? '',
    이미지: editTask?.sections?.이미지 ?? '',
    gif: editTask?.sections?.gif ?? '',
  });
  const [appStart, setAppStart] = useState(editTask?.applicationPeriod?.start ?? today());
  const [appEnd, setAppEnd] = useState(editTask?.applicationPeriod?.end ?? today());
  const [workStart, setWorkStart] = useState(editTask?.workPeriod?.start ?? today());
  const [workEnd, setWorkEnd] = useState(editTask?.workPeriod?.end ?? today());
  const [workTimeSlot, setWorkTimeSlot] = useState(editTask?.workTimeSlot ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);

  // editTask가 바뀌면 폼 재초기화 (같은 컴포넌트가 재사용되는 경우)
  useEffect(() => {
    if (!editTask) return;
    setTitle(editTask.title ?? '');
    setDescription(editTask.description ?? '');
    setCategory(editTask.category ?? CATEGORIES[0]);
    setReward(editTask.reward ?? 300);
    setMaxApplicants(editTask.maxApplicants ?? 0);
    setSections({
      제목: editTask.sections?.제목 ?? '',
      내용: editTask.sections?.내용 ?? '',
      댓글: editTask.sections?.댓글 ?? '',
      키워드: editTask.sections?.키워드 ?? '',
      이미지: editTask.sections?.이미지 ?? '',
      gif: editTask.sections?.gif ?? '',
    });
    setAppStart(editTask.applicationPeriod?.start ?? today());
    setAppEnd(editTask.applicationPeriod?.end ?? today());
    setWorkStart(editTask.workPeriod?.start ?? today());
    setWorkEnd(editTask.workPeriod?.end ?? today());
    setWorkTimeSlot(editTask.workTimeSlot ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTask?.id]);

  if (!user || user.role !== 'admin') {
    navigate('/part-time', { replace: true });
    return null;
  }

  const handleSectionChange = (key: string, value: string) => {
    setSections((s) => ({ ...s, [key]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSections((s) => ({ ...s, 이미지: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSections((s) => ({ ...s, gif: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('게시글 제목을 입력해 주세요.');
      return;
    }

    let projectNo = editTask?.projectNo ?? `ALBA-${String(Date.now()).slice(-5)}`;
    if (!isEditing) {
      try {
        const tasks = await fetchPartTimeTasks();
        let maxN = 0;
        for (const t of tasks) {
          const pn = t.projectNo;
          if (pn && /^ALBA-\d+$/.test(pn)) {
            const n = parseInt(pn.replace('ALBA-', ''), 10);
            if (n > maxN) maxN = n;
          }
        }
        projectNo = `ALBA-${String(maxN + 1).padStart(5, '0')}`;
      } catch {}
    }

    const task: PartTimeTask = {
      // 수정 시 기존 데이터 유지
      ...(editTask ?? {}),
      id: editTask?.id ?? `t_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      reward: Math.max(0, reward),
      maxApplicants: maxApplicants > 0 ? maxApplicants : undefined,
      sections: {
        ...(editTask?.sections ?? {}),
        제목: sections.제목,
        내용: sections.내용,
        댓글: sections.댓글,
        키워드: sections.키워드,
        이미지: sections.이미지,
        gif: sections.gif,
      },
      applicationPeriod: { start: appStart, end: appEnd },
      workPeriod: { start: workStart, end: workEnd },
      workTimeSlot: workTimeSlot || undefined,
      createdAt: editTask?.createdAt ?? new Date().toISOString(),
      createdBy: editTask?.createdBy ?? user.id,
      applicants: editTask?.applicants ?? [],
      pointPaid: editTask?.pointPaid ?? false,
      paidUserIds: editTask?.paidUserIds ?? [],
      projectNo,
    };

    try {
      await upsertPartTimeTask(task);
      alert(isEditing ? '작업이 수정되었습니다.' : '작업이 등록되었습니다.');
      navigate('/part-time');
    } catch (err) {
      alert('저장에 실패했습니다. 다시 시도해 주세요.');
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4">
      <div className="flex items-center justify-between mb-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          돌아가기
        </button>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-emerald-500 underline-offset-8">
          {isEditing ? '작업 수정' : '프리랜서 작업 등록'}
        </h2>
        <div className="w-20" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[48px] shadow-xl border border-gray-100 space-y-12">
        {/* 1. 기본 정보 */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-emerald-600 rounded-full" />
            <h3 className="text-xl font-black text-gray-900 italic">1. 포인트 금액 · 게시글 제목 · 내용</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">보상 포인트 (P)</label>
              <input type="number" min={0} value={reward} onChange={(e) => setReward(Number(e.target.value) || 0)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">게시글 제목 *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 카페 글 작성 · SNS 공유 인증" className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold" required />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">한 줄 설명</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="작업 한 줄 요약" className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" />
          </div>
        </section>

        {/* 2. 모집인원 · 기간 */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-emerald-600 rounded-full" />
            <h3 className="text-xl font-black text-gray-900 italic">2. 모집 인원 · 신청기간 · 작업기간</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">모집 인원 (0=제한없음)</label>
              <input type="number" min={0} value={maxApplicants || ''} onChange={(e) => setMaxApplicants(Number(e.target.value) || 0)} placeholder="0" className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청기간 시작</label>
              <input type="date" value={appStart} onChange={(e) => setAppStart(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청기간 종료</label>
              <input type="date" value={appEnd} onChange={(e) => setAppEnd(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" />
            </div>
            <div className="sm:col-span-2 lg:col-span-1" />
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">작업기간 시작</label>
              <input type="date" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">작업기간 종료</label>
              <input type="date" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">작업시간 (선택)</label>
              <div className="flex flex-wrap gap-2">
                {['', '오전 9:00~12:00', '오후 13:00~18:00', '종일 9:00~18:00'].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setWorkTimeSlot(slot)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${workTimeSlot === slot ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}`}
                  >
                    {slot === '' ? '시간 미지정' : slot}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. 작업 내용 */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-emerald-600 rounded-full" />
            <h3 className="text-xl font-black text-gray-900 italic">3. 작업 내용 (작업자가 할 일)</h3>
          </div>
          <div className="space-y-4">
            {SECTION_KEYS.map((key) => (
              <div key={key}>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">{key}</label>
                {key === '이미지' ? (
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-5 py-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-sm">이미지 업로드 (참고용)</button>
                    {sections.이미지 && (
                      <div className="relative inline-block max-w-[200px]">
                        <img src={sections.이미지} alt="참고" className="rounded-xl border border-gray-100 max-h-32 object-contain" />
                        <button type="button" onClick={() => setSections((s) => ({ ...s, 이미지: '' }))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black">×</button>
                      </div>
                    )}
                    <input type="text" value={sections.이미지?.startsWith('data:') ? '' : (sections.이미지 ?? '')} onChange={(e) => handleSectionChange('이미지', e.target.value)} placeholder="또는 이미지 관련 지시사항 텍스트" className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
                  </div>
                ) : key === 'gif' ? (
                  <div className="flex flex-col gap-2">
                    <input ref={gifInputRef} type="file" accept=".gif,image/gif" onChange={handleGifUpload} className="hidden" />
                    <button type="button" onClick={() => gifInputRef.current?.click()} className="w-full px-5 py-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-sm">GIF 파일 업로드</button>
                    {sections.gif?.startsWith('data:') && (
                      <div className="relative inline-block max-w-[200px]">
                        <img src={sections.gif} alt="GIF 미리보기" className="rounded-xl border border-gray-100 max-h-32" />
                        <button type="button" onClick={() => setSections((s) => ({ ...s, gif: '' }))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black">×</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input type="text" value={sections[key] ?? ''} onChange={(e) => handleSectionChange(key, e.target.value)} placeholder={`예: ${key} 관련 지시사항`} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-4 pt-6">
          <button type="submit" className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all text-lg">
            {isEditing ? '수정 저장하기' : '작업 등록하기'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-8 py-4 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all">
            취소
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartTimeTaskRegister;
