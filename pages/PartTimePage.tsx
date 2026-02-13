import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask, PartTimeTaskSections, PartTimePostBlock } from '@/types';
import { getFreelancerBalance, MIN_WITHDRAW_FREELANCER, getPartTimeTasks, setPartTimeTasks } from '@/constants';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const PartTimePage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    setTasks(getPartTimeTasks());
  }, []);

  useEffect(() => {
    if (user?.id) setBalance(getFreelancerBalance(user.id));
  }, [user?.id]);

  const completedIds = useMemo(() => {
    const raw = localStorage.getItem('parttime_completed_v1');
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  }, [tasks]);

  const isTaskDone = (task: PartTimeTask) =>
    completedIds.has(task.id) || (task.paidUserIds && user?.id && task.paidUserIds.includes(user.id));

  const todayStrVal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const weekDates = useMemo(() => {
    const arr: string[] = [];
    const base = new Date(todayStrVal);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
    return arr;
  }, [todayStrVal]);

  const dateCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    weekDates.forEach((d) => {
      map[d] = { total: 0, done: 0 };
    });
    tasks.forEach((t) => {
      const key = t.workPeriod?.start || t.applicationPeriod?.start;
      if (map[key]) {
        map[key].total++;
        if (t.pointPaid) map[key].done++;
      }
    });
    return map;
  }, [tasks, weekDates]);

  const effectiveDate = selectedDate || todayStrVal;
  const tasksForDate = useMemo(() => {
    return tasks.filter((t) => (t.workPeriod?.start || t.applicationPeriod?.start) === effectiveDate);
  }, [tasks, effectiveDate]);

  const sortedTasks = useMemo(() => {
    const incomplete = tasksForDate.filter((t) => !isTaskDone(t));
    const complete = tasksForDate.filter((t) => isTaskDone(t));
    return [...incomplete, ...complete];
  }, [tasksForDate, isTaskDone]);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 md:px-6 animate-in fade-in duration-700">
      <div className="bg-white rounded-[48px] p-8 md:p-12 shadow-xl border border-gray-100 space-y-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 italic tracking-tighter">
              누구나<span className="text-emerald-600">알바</span>
            </h2>
            <p className="text-gray-700 font-black mt-2">프리랜서 작업을 하고 수익통장에 포인트를 쌓아보세요.</p>
            <p className="text-gray-700 font-black mt-1">프리랜서 작업이 필요하시면 고객센터로 문의주세요.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/part-time/register')}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-emerald-700 transition-all"
                >
                  작업 등록
                </button>
              )}
              <button
                onClick={() => navigate('/part-time/request')}
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all"
              >
                작업의뢰
              </button>
            </div>
          </div>
          {user ? (
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 min-w-[200px]">
              <p className="text-[11px] font-black text-gray-500 uppercase italic">수익통장</p>
              <p className="text-2xl font-black text-emerald-700 italic">{balance.toLocaleString()} P</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {balance >= MIN_WITHDRAW_FREELANCER ? '출금 가능' : `${(MIN_WITHDRAW_FREELANCER - balance).toLocaleString()} P 더 모으면 출금 가능`}
              </p>
              <Link to="/mypage" state={{ activeTab: 'freelancer' } as any} className="inline-block mt-3 text-emerald-600 font-black text-sm hover:underline">
                마이페이지에서 출금하기 →
              </Link>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black hover:bg-emerald-600 transition-all">
              로그인 후 이용
            </button>
          )}
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {weekDates.map((d) => {
              const c = dateCounts[d] || { total: 0, done: 0 };
              const isSelected = effectiveDate === d;
              const dayLabel = d.slice(5);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`p-5 rounded-xl border text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50/80 shadow-md ring-2 ring-emerald-200/60'
                      : 'border-gray-200/80 bg-white hover:border-emerald-200 hover:shadow-sm'
                  }`}
                >
                  <p className="text-sm font-black text-gray-600">{dayLabel}</p>
                  <p className="text-xs text-gray-500 mt-2 font-semibold">작업 {c.total}건</p>
                  <p className="text-xs text-emerald-600 font-semibold">완료 {c.done}건</p>
                </button>
              );
            })}
          </div>

          <h3 className="text-xl font-black text-gray-800">작업목록</h3>

          {sortedTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-base">해당 날짜의 작업이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {sortedTasks.map((task) => {
                const done = isTaskDone(task);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/part-time/${task.id}`)}
                    className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border transition-all ${
                      done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-wider">{task.category}</span>
                      <h4 className="font-black text-gray-900 text-base">{task.title}</h4>
                      <p className="text-base text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-black text-emerald-600 text-base">+{task.reward.toLocaleString()} P</span>
                      {done ? (
                        <span className="px-4 py-2 rounded-xl bg-gray-200 text-gray-500 text-sm font-black">완료됨</span>
                      ) : (
                        <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-black">상세보기 →</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-100">
          <p className="text-blue-800 font-bold text-base">
            💡 작업을 클릭하면 상세 내용(제목, 내용, 댓글, 키워드, 이미지 등)을 확인하고 신청할 수 있습니다.
            <br />
            수익통장은 <strong>{MIN_WITHDRAW_FREELANCER.toLocaleString()} P</strong> 이상일 때 마이페이지에서 출금할 수 있습니다.
          </p>
        </div>

        <button onClick={() => navigate('/sns')} className="bg-gray-100 text-gray-600 px-6 py-3 rounded-xl font-black hover:bg-gray-200 transition-all">
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default PartTimePage;

// ----- 프리랜서 작업 등록 (같은 파일에 두어 Netlify 빌드 시 단일 파일로 해결) -----
const REGISTER_CATEGORIES = ['설문', 'SNS', '네이버카페', '리뷰', '검수', '라벨링', '번역', '블로그체험단', '블로그기자단', '인스타그램', '유튜브', '웹사이트', '기타'];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ALL_SECTION_KEYS: (keyof PartTimeTaskSections)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif', '작업링크', '작업안내'];

export const PartTimeTaskRegister: React.FC<{ user: UserProfile | null }> = ({ user }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(REGISTER_CATEGORIES[0]);
  const [reward, setReward] = useState(300);
  const [maxApplicants, setMaxApplicants] = useState(0);
  const [selectedSectionKeys, setSelectedSectionKeys] = useState<(keyof PartTimeTaskSections)[]>(['제목', '내용']);
  const [postBlocks, setPostBlocks] = useState<PartTimePostBlock[]>([{ 제목: '', 내용: '' }]);
  const [commentBlocks, setCommentBlocks] = useState<string[]>(['']);
  const [workLinkBlocks, setWorkLinkBlocks] = useState<string[]>(['']);
  const [sections, setSections] = useState<Record<string, string>>({
    제목: '', 내용: '', 댓글: '', 키워드: '', 이미지: '', 동영상: '', gif: '', 작업링크: '', 작업안내: '',
  });
  const [appStart, setAppStart] = useState(todayStr());
  const [appEnd, setAppEnd] = useState(todayStr());
  const [workStart, setWorkStart] = useState(todayStr());
  const [workEnd, setWorkEnd] = useState(todayStr());
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 10;

  const toggleSectionKey = (key: keyof PartTimeTaskSections) => {
    setSelectedSectionKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const usePostBlocks = selectedSectionKeys.includes('제목') && selectedSectionKeys.includes('내용');
  const addPostBlock = () => setPostBlocks((p) => [...p, { 제목: '', 내용: '' }]);
  const removePostBlock = (index: number) => setPostBlocks((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== index)));
  const updatePostBlock = (index: number, field: '제목' | '내용', value: string) =>
    setPostBlocks((p) => p.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const useCommentBlocks = selectedSectionKeys.includes('댓글');
  const addCommentBlock = () => setCommentBlocks((c) => [...c, '']);
  const removeCommentBlock = (index: number) => setCommentBlocks((c) => (c.length <= 1 ? c : c.filter((_, i) => i !== index)));
  const updateCommentBlock = (index: number, value: string) => setCommentBlocks((c) => c.map((v, i) => (i === index ? value : v)));

  const useWorkLinkBlocks = selectedSectionKeys.includes('작업링크');
  const addWorkLinkBlock = () => setWorkLinkBlocks((w) => [...w, '']);
  const removeWorkLinkBlock = (index: number) => setWorkLinkBlocks((w) => (w.length <= 1 ? w : w.filter((_, i) => i !== index)));
  const updateWorkLinkBlock = (index: number, value: string) => setWorkLinkBlocks((w) => w.map((v, i) => (i === index ? value : v)));

  if (!user || user.role !== 'admin') {
    navigate('/part-time', { replace: true });
    return null;
  }

  const handleSectionChange = (key: string, value: string) => setSections((s) => ({ ...s, [key]: value }));
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const remaining = MAX_IMAGES - attachedImages.length;
    const toAdd = Math.min(remaining, files.length);
    if (toAdd <= 0) {
      alert(`이미지는 최대 ${MAX_IMAGES}개까지 첨부할 수 있습니다.`);
      e.target.value = '';
      return;
    }
    Array.from(files).slice(0, toAdd).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setAttachedImages((prev) => [...prev, reader.result as string].slice(0, MAX_IMAGES));
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const removeAttachedImage = (index: number) => setAttachedImages((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('게시글 제목을 입력해 주세요.'); return; }
    if (usePostBlocks && !postBlocks.some((b) => b.제목?.trim() || b.내용?.trim())) {
      alert('게시글을 1개 이상 입력해 주세요.');
      return;
    }
    const tasks = getPartTimeTasks();
    const sectionsOut: PartTimeTaskSections = {};
    if (usePostBlocks && postBlocks.some((b) => b.제목?.trim() || b.내용?.trim())) {
      sectionsOut.게시글목록 = postBlocks.filter((b) => b.제목?.trim() || b.내용?.trim()).map((b) => ({ 제목: b.제목.trim(), 내용: b.내용.trim() }));
    }
    selectedSectionKeys.forEach((key) => {
      if (key === '제목' || key === '내용') {
        if (usePostBlocks) return;
        const val = sections[key];
        if (val != null && String(val).trim()) sectionsOut[key] = String(val).trim();
      } else if (key === '댓글') {
        const list = commentBlocks.filter((v) => v?.trim());
        if (list.length > 0) sectionsOut.댓글목록 = list.map((v) => v.trim());
        else if (sections.댓글?.trim()) sectionsOut.댓글 = sections.댓글.trim();
      } else if (key === '작업링크') {
        const list = workLinkBlocks.filter((v) => v?.trim());
        if (list.length > 0) sectionsOut.작업링크목록 = list.map((v) => v.trim());
        else if (sections.작업링크?.trim()) sectionsOut.작업링크 = sections.작업링크.trim();
      } else if (key === '이미지') {
        if (sections.이미지?.trim()) sectionsOut.이미지 = sections.이미지.trim();
        if (attachedImages.length) sectionsOut.이미지목록 = attachedImages;
      } else {
        const val = sections[key];
        if (val != null && String(val).trim()) sectionsOut[key] = String(val).trim();
      }
    });
    const newTask: PartTimeTask = {
      id: `t_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      reward: Math.max(0, reward),
      maxApplicants: maxApplicants > 0 ? maxApplicants : undefined,
      sections: sectionsOut,
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
    <div className="max-w-4xl mx-auto pb-32 px-4">
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => navigate('/part-time')} className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          돌아가기
        </button>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-emerald-500 underline-offset-8">프리랜서 작업 등록</h2>
        <div className="w-20" />
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[48px] shadow-xl border border-gray-100 space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-4"><div className="w-1.5 h-8 bg-emerald-600 rounded-full" /><h3 className="text-xl font-black text-gray-900 italic">1. 포인트 금액 · 게시글 제목 · 내용</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">보상 포인트 (P)</label>
              <input type="number" min={0} value={reward} onChange={(e) => setReward(Number(e.target.value) || 0)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold">
                {REGISTER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
        <section className="space-y-6">
          <div className="flex items-center gap-4"><div className="w-1.5 h-8 bg-emerald-600 rounded-full" /><h3 className="text-xl font-black text-gray-900 italic">2. 모집 인원 · 신청기간 · 작업기간</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">모집 인원 (0=제한없음)</label>
              <input type="number" min={0} value={maxApplicants || ''} onChange={(e) => setMaxApplicants(Number(e.target.value) || 0)} placeholder="0" className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold" />
            </div>
            <div><label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청기간 시작</label><input type="date" value={appStart} onChange={(e) => setAppStart(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" /></div>
            <div><label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청기간 종료</label><input type="date" value={appEnd} onChange={(e) => setAppEnd(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" /></div>
            <div className="sm:col-span-2 lg:col-span-1" />
            <div><label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">작업기간 시작</label><input type="date" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" /></div>
            <div><label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">작업기간 종료</label><input type="date" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" /></div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="flex items-center gap-4"><div className="w-1.5 h-8 bg-emerald-600 rounded-full" /><h3 className="text-xl font-black text-gray-900 italic">3. 작업 내용 (필요한 섹션만 선택)</h3></div>
          <p className="text-sm text-gray-500">필요한 항목만 체크하세요. 예: 게시글 5개만 필요하면 제목·내용만 선택하면 됩니다.</p>
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-gray-50 border border-gray-100">
            {ALL_SECTION_KEYS.map((key) => (
              <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSectionKeys.includes(key)}
                  onChange={() => toggleSectionKey(key)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-gray-700">{key}</span>
              </label>
            ))}
          </div>
          {usePostBlocks && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-gray-700">게시글 (제목 + 내용) — 원하는 개수만큼 추가</span>
                <button type="button" onClick={addPostBlock} className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200">
                  + 게시글 추가
                </button>
              </div>
              {postBlocks.map((block, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500 uppercase">게시글 {idx + 1}</span>
                    {postBlocks.length > 1 && (
                      <button type="button" onClick={() => removePostBlock(idx)} className="text-red-500 text-sm font-bold hover:underline">삭제</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={block.제목}
                    onChange={(e) => updatePostBlock(idx, '제목', e.target.value)}
                    placeholder="제목"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                  <textarea
                    value={block.내용}
                    onChange={(e) => updatePostBlock(idx, '내용', e.target.value)}
                    placeholder="내용 (긴 글 가능)"
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-y min-h-[120px]"
                  />
                </div>
              ))}
            </div>
          )}
          {useCommentBlocks && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-gray-700">댓글 — 원하는 개수만큼 추가</span>
                <button type="button" onClick={addCommentBlock} className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200">
                  + 댓글 추가
                </button>
              </div>
              {commentBlocks.map((value, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500 uppercase">댓글 {idx + 1}</span>
                    {commentBlocks.length > 1 && (
                      <button type="button" onClick={() => removeCommentBlock(idx)} className="text-red-500 text-sm font-bold hover:underline">삭제</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateCommentBlock(idx, e.target.value)}
                    placeholder="댓글 지시사항 (예: 공유 인증 댓글 작성)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          {useWorkLinkBlocks && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-gray-700">작업링크 — 원하는 개수만큼 추가</span>
                <button type="button" onClick={addWorkLinkBlock} className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200">
                  + 작업링크 추가
                </button>
              </div>
              {workLinkBlocks.map((value, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500 uppercase">작업링크 {idx + 1}</span>
                    {workLinkBlocks.length > 1 && (
                      <button type="button" onClick={() => removeWorkLinkBlock(idx)} className="text-red-500 text-sm font-bold hover:underline">삭제</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateWorkLinkBlock(idx, e.target.value)}
                    placeholder="URL 또는 작업링크 안내 (예: https://... 또는 제출할 링크 1)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-4">
            {selectedSectionKeys.filter((k) => {
              if (usePostBlocks && (k === '제목' || k === '내용')) return false;
              if (k === '댓글' || k === '작업링크') return false;
              return true;
            }).map((key) => (
              <div key={key}>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">{key}</label>
                {key === '이미지' ? (
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={attachedImages.length >= MAX_IMAGES} className="w-full px-5 py-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-sm disabled:opacity-50">
                      이미지 업로드 (참고용, 최대 {MAX_IMAGES}개) {attachedImages.length > 0 && `(${attachedImages.length}/${MAX_IMAGES})`}
                    </button>
                    {attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {attachedImages.map((src, i) => (
                          <div key={i} className="relative">
                            <img src={src} alt={`참고 ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                            <button type="button" onClick={() => removeAttachedImage(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-black leading-none">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="text" value={sections.이미지 ?? ''} onChange={(e) => handleSectionChange('이미지', e.target.value)} placeholder="이미지 관련 지시사항 텍스트 (선택)" className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
                  </div>
                ) : key === '내용' || key === '작업안내' ? (
                  <textarea
                    value={sections[key] ?? ''}
                    onChange={(e) => handleSectionChange(key, e.target.value)}
                    placeholder={key === '작업안내' ? '전체 작업 가이드 (긴 글 가능)' : '예: 내용 관련 지시사항 (긴 글 가능)'}
                    rows={8}
                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-y min-h-[180px]"
                  />
                ) : (
                  <input type="text" value={sections[key] ?? ''} onChange={(e) => handleSectionChange(key, e.target.value)} placeholder={`예: ${key} 관련 지시사항`} className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
                )}
              </div>
            ))}
          </div>
        </section>
        <div className="flex gap-4 pt-6">
          <button type="submit" className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all text-lg">작업 등록하기</button>
          <button type="button" onClick={() => navigate('/part-time')} className="px-8 py-4 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all">취소</button>
        </div>
      </form>
    </div>
  );
};
