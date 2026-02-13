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
              <p className="text-2xl font-black text-emerald-700 italic">{balance.toLocaleString()}원</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {balance >= MIN_WITHDRAW_FREELANCER ? '출금 가능' : `${(MIN_WITHDRAW_FREELANCER - balance).toLocaleString()}원 더 모으면 출금 가능`}
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
                      <span className="font-black text-emerald-600 text-base">+{task.reward.toLocaleString()}원</span>
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
            수익통장은 <strong>{MIN_WITHDRAW_FREELANCER.toLocaleString()}원</strong> 이상일 때 마이페이지에서 출금할 수 있습니다.
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
type SectionItemType = '제목' | '내용' | '게시글' | '댓글' | '키워드' | '이미지' | '동영상' | 'gif' | '작업링크' | '작업안내';

interface SectionItem {
  id: string;
  type: SectionItemType;
  value?: string;
  postBlock?: PartTimePostBlock;
  images?: string[];
}

const SECTION_TYPES: { key: SectionItemType; label: string }[] = [
  { key: '제목', label: '제목' },
  { key: '내용', label: '내용' },
  { key: '게시글', label: '게시글(제목+내용)' },
  { key: '댓글', label: '댓글' },
  { key: '키워드', label: '키워드' },
  { key: '이미지', label: '이미지' },
  { key: '동영상', label: '동영상' },
  { key: 'gif', label: 'gif' },
  { key: '작업링크', label: '작업링크' },
  { key: '작업안내', label: '작업안내' },
];

const MAX_IMAGES_PER_SECTION = 10;

export const PartTimeTaskRegister: React.FC<{ user: UserProfile | null }> = ({ user }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(REGISTER_CATEGORIES[0]);
  const [reward, setReward] = useState(300);
  const [maxApplicants, setMaxApplicants] = useState(0);
  const [sectionItems, setSectionItems] = useState<SectionItem[]>([]);
  const [appStart, setAppStart] = useState(todayStr());
  const [appEnd, setAppEnd] = useState(todayStr());
  const [workStart, setWorkStart] = useState(todayStr());
  const [workEnd, setWorkEnd] = useState(todayStr());
  const [applicantUserId, setApplicantUserId] = useState('');
  const [jobRequestId, setJobRequestId] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addSection = (type: SectionItemType) => {
    const item: SectionItem = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      value: '',
      ...(type === '게시글' ? { postBlock: { 제목: '', 내용: '' } } : {}),
    };
    setSectionItems((prev) => [...prev, item]);
  };

  const removeSection = (id: string) => setSectionItems((prev) => prev.filter((s) => s.id !== id));

  const moveSection = (id: string, dir: 'up' | 'down') => {
    setSectionItems((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = prev.slice();
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateSection = (id: string, upd: Partial<SectionItem>) => {
    setSectionItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...upd } : s)));
  };

  if (!user || user.role !== 'admin') {
    navigate('/part-time', { replace: true });
    return null;
  }

  const handleImageUpload = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const item = sectionItems.find((s) => s.id === sectionId);
    if (!item || item.type !== '이미지') return;
    const current = item.images?.length ?? 0;
    const toAdd = Math.min(MAX_IMAGES_PER_SECTION - current, files.length);
    if (toAdd <= 0) {
      alert(`이미지는 최대 ${MAX_IMAGES_PER_SECTION}개까지 첨부할 수 있습니다.`);
      e.target.value = '';
      return;
    }
    const newImages = await Promise.all(
      Array.from(files).slice(0, toAdd).map(
        (file: File) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          })
      )
    );
    updateSection(sectionId, { images: [...(item.images ?? []), ...newImages].slice(0, MAX_IMAGES_PER_SECTION) });
    e.target.value = '';
  };

  const removeSectionImage = (sectionId: string, imgIdx: number) => {
    const item = sectionItems.find((s) => s.id === sectionId);
    if (!item?.images) return;
    updateSection(sectionId, { images: item.images.filter((_, i) => i !== imgIdx) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('게시글 제목을 입력해 주세요.'); return; }
    const tasks = getPartTimeTasks();
    const sectionsOut: PartTimeTaskSections = {};
    const postBlocksOut: PartTimePostBlock[] = [];
    const commentList: string[] = [];
    const workLinkList: string[] = [];

    sectionItems.forEach((item) => {
      if (item.type === '제목' && item.value?.trim()) sectionsOut.제목 = item.value.trim();
      else if (item.type === '내용' && item.value?.trim()) sectionsOut.내용 = item.value.trim();
      else if (item.type === '게시글' && item.postBlock && (item.postBlock.제목?.trim() || item.postBlock.내용?.trim())) {
        postBlocksOut.push({ 제목: item.postBlock.제목.trim(), 내용: item.postBlock.내용.trim() });
      } else if (item.type === '댓글' && item.value?.trim()) commentList.push(item.value.trim());
      else if (item.type === '키워드' && item.value?.trim()) sectionsOut.키워드 = item.value.trim();
      else if (item.type === '이미지') {
        if (item.value?.trim()) sectionsOut.이미지 = item.value.trim();
        if (item.images?.length) sectionsOut.이미지목록 = item.images;
      } else if (item.type === '동영상' && item.value?.trim()) sectionsOut.동영상 = item.value.trim();
      else if (item.type === 'gif' && item.value?.trim()) sectionsOut.gif = item.value.trim();
      else if (item.type === '작업링크' && item.value?.trim()) workLinkList.push(item.value.trim());
      else if (item.type === '작업안내' && item.value?.trim()) sectionsOut.작업안내 = item.value.trim();
    });

    if (postBlocksOut.length) sectionsOut.게시글목록 = postBlocksOut;
    if (commentList.length) sectionsOut.댓글목록 = commentList;
    if (workLinkList.length) sectionsOut.작업링크목록 = workLinkList;
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
      ...(applicantUserId.trim() ? { applicantUserId: applicantUserId.trim() } : {}),
      ...(jobRequestId.trim() ? { jobRequestId: jobRequestId.trim() } : {}),
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
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">보상 금액 (원)</label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">광고주 ID (작업의뢰 링크용, 선택)</label>
              <input value={applicantUserId} onChange={(e) => setApplicantUserId(e.target.value)} placeholder="광고주 userId" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">작업의뢰 ID (선택)</label>
              <input value={jobRequestId} onChange={(e) => setJobRequestId(e.target.value)} placeholder="jobRequestId" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">모집 인원</label>
              <input type="number" min={0} value={maxApplicants || ''} onChange={(e) => setMaxApplicants(Number(e.target.value) || 0)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none font-bold text-sm" />
            </div>
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">신청시작</label><input type="date" value={appStart} onChange={(e) => setAppStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" /></div>
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">신청종료</label><input type="date" value={appEnd} onChange={(e) => setAppEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" /></div>
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">작업시작</label><input type="date" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" /></div>
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">작업종료</label><input type="date" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" /></div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="flex items-center gap-4"><div className="w-1.5 h-8 bg-emerald-600 rounded-full" /><h3 className="text-xl font-black text-gray-900 italic">3. 작업 내용</h3></div>
          <p className="text-sm text-gray-500">아래 항목을 클릭하면 순서대로 섹션이 추가됩니다. 원하는 만큼 추가하고 위치를 이동할 수 있습니다.</p>
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-gray-50 border border-gray-100">
            {SECTION_TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => addSection(key)}
                className="px-4 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-black text-sm hover:bg-emerald-50 hover:border-emerald-400 transition-all"
              >
                + {label}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {sectionItems.map((item, idx) => (
              <div key={item.id} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-emerald-700 uppercase bg-emerald-100 px-2 py-1 rounded-lg">
                    {SECTION_TYPES.find((t) => t.key === item.type)?.label ?? item.type} {idx + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveSection(item.id, 'up')} disabled={idx === 0} className="p-1.5 rounded-lg bg-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-300 text-sm">▲</button>
                    <button type="button" onClick={() => moveSection(item.id, 'down')} disabled={idx === sectionItems.length - 1} className="p-1.5 rounded-lg bg-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-300 text-sm">▼</button>
                    <button type="button" onClick={() => removeSection(item.id)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 text-sm font-black">삭제</button>
                  </div>
                </div>
                {item.type === '제목' && (
                  <input
                    value={item.value ?? ''}
                    onChange={(e) => updateSection(item.id, { value: e.target.value })}
                    placeholder="제목"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                )}
                {item.type === '내용' && (
                  <textarea
                    value={item.value ?? ''}
                    onChange={(e) => updateSection(item.id, { value: e.target.value })}
                    placeholder="내용"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-y"
                  />
                )}
                {item.type === '게시글' && item.postBlock && (
                  <div className="space-y-2">
                    <input
                      value={item.postBlock.제목}
                      onChange={(e) => updateSection(item.id, { postBlock: { ...item.postBlock!, 제목: e.target.value } })}
                      placeholder="제목"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                    />
                    <textarea
                      value={item.postBlock.내용}
                      onChange={(e) => updateSection(item.id, { postBlock: { ...item.postBlock!, 내용: e.target.value } })}
                      placeholder="내용"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-y"
                    />
                  </div>
                )}
                {(item.type === '댓글' || item.type === '키워드' || item.type === '작업링크') && (
                  <input
                    value={item.value ?? ''}
                    onChange={(e) => updateSection(item.id, { value: e.target.value })}
                    placeholder={item.type === '댓글' ? '댓글 지시사항' : item.type === '키워드' ? '키워드' : 'URL 또는 링크 안내'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                )}
                {item.type === '이미지' && (
                  <div className="space-y-2">
                    <input
                      value={item.value ?? ''}
                      onChange={(e) => updateSection(item.id, { value: e.target.value })}
                      placeholder="이미지 지시사항 (선택)"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                    />
                    <input
                      ref={(el) => { fileInputRefs.current[item.id] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(item.id, e)}
                      className="hidden"
                    />
                    <button type="button" onClick={() => fileInputRefs.current[item.id]?.click()} disabled={(item.images?.length ?? 0) >= MAX_IMAGES_PER_SECTION} className="px-4 py-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-xs disabled:opacity-50">
                      이미지 업로드 (최대 {MAX_IMAGES_PER_SECTION}개) {(item.images?.length ?? 0) > 0 && `(${item.images?.length})`}
                    </button>
                    {item.images && item.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.images.map((src, i) => (
                          <div key={i} className="relative">
                            <img src={src} alt={`참고 ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                            <button type="button" onClick={() => removeSectionImage(item.id, i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-black leading-none">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {(item.type === '동영상' || item.type === 'gif') && (
                  <input
                    value={item.value ?? ''}
                    onChange={(e) => updateSection(item.id, { value: e.target.value })}
                    placeholder={item.type === '동영상' ? '동영상 지시사항' : 'gif 지시사항'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                  />
                )}
                {item.type === '작업안내' && (
                  <textarea
                    value={item.value ?? ''}
                    onChange={(e) => updateSection(item.id, { value: e.target.value })}
                    placeholder="전체 작업 가이드"
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-y"
                  />
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
