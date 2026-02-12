import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask, PartTimeTaskSections } from '@/types';
import { getFreelancerBalance, MIN_WITHDRAW_FREELANCER, getPartTimeTasks, setPartTimeTasks } from '@/constants';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const PartTimePage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [dateIndex, setDateIndex] = useState(0);

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

  const dateKeys = useMemo(() => {
    const set = new Set(tasks.map((t) => t.applicationPeriod.start));
    return Array.from(set).sort();
  }, [tasks]);

  const currentDate = dateKeys[dateIndex] ?? dateKeys[0] ?? '';
  const tasksForDate = useMemo(() => {
    return tasks.filter((t) => t.applicationPeriod.start === currentDate);
  }, [tasks, currentDate]);

  const sortedTasks = useMemo(() => {
    const incomplete = tasksForDate.filter((t) => !isTaskDone(t));
    const complete = tasksForDate.filter((t) => isTaskDone(t));
    return [...incomplete, ...complete];
  }, [tasksForDate, isTaskDone]);

  const canGoPrev = dateIndex > 0;
  const canGoNext = dateIndex < dateKeys.length - 1;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in duration-700">
      <div className="bg-white rounded-[48px] p-8 md:p-12 shadow-xl border border-gray-100 space-y-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 italic tracking-tighter">
              누구나<span className="text-emerald-600">알바</span>
            </h2>
            <p className="text-gray-700 font-black mt-2">프리랜서 작업을 하고 수익통장에 포인트를 쌓아보세요.</p>
            <p className="text-gray-700 font-black mt-1">프리랜서 작업이 필요하시면 고객센터로 문의주세요.</p>
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/part-time/register')}
                className="mt-4 px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-emerald-700 transition-all"
              >
                작업 등록
              </button>
            )}
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

        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-black text-gray-800">진행 가능한 작업</h3>
            {dateKeys.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDateIndex((i) => Math.max(0, i - 1))}
                  disabled={!canGoPrev}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-black text-gray-600"
                >
                  ←
                </button>
                <span className="text-sm font-bold text-gray-600 min-w-[100px] text-center">
                  {currentDate || '-'}
                </span>
                <button
                  type="button"
                  onClick={() => setDateIndex((i) => Math.min(dateKeys.length - 1, i + 1))}
                  disabled={!canGoNext}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-black text-gray-600"
                >
                  →
                </button>
              </div>
            )}
          </div>

          {sortedTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">해당 날짜의 작업이 없습니다.</p>
          ) : (
            sortedTasks.map((task) => {
              const done = isTaskDone(task);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/part-time/${task.id}`)}
                  className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all ${
                    done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{task.category}</span>
                    <h4 className="font-black text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-black text-emerald-600">+{task.reward.toLocaleString()} P</span>
                    {done ? (
                      <span className="px-4 py-2 rounded-xl bg-gray-200 text-gray-500 text-sm font-black">완료됨</span>
                    ) : (
                      <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-black">상세보기 →</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-100">
          <p className="text-blue-800 font-bold">
            💡 작업을 클릭하면 상세 내용(제목, 내용, 댓글, 키워드, 이미지 등)을 확인하고 신청할 수 있습니다. 수익통장은 <strong>{MIN_WITHDRAW_FREELANCER.toLocaleString()} P</strong> 이상일 때 마이페이지에서 출금할 수 있습니다.
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
const REGISTER_SECTION_KEYS: (keyof PartTimeTaskSections)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif'];

export const PartTimeTaskRegister: React.FC<{ user: UserProfile | null }> = ({ user }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(REGISTER_CATEGORIES[0]);
  const [reward, setReward] = useState(300);
  const [maxApplicants, setMaxApplicants] = useState(0);
  const [sections, setSections] = useState<Record<string, string>>({
    제목: '', 내용: '', 댓글: '', 키워드: '', 이미지: '', 동영상: '', gif: '',
  });
  const [appStart, setAppStart] = useState(todayStr());
  const [appEnd, setAppEnd] = useState(todayStr());
  const [workStart, setWorkStart] = useState(todayStr());
  const [workEnd, setWorkEnd] = useState(todayStr());
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 10;

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
    const tasks = getPartTimeTasks();
    const newTask: PartTimeTask = {
      id: `t_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      reward: Math.max(0, reward),
      maxApplicants: maxApplicants > 0 ? maxApplicants : undefined,
      sections: { 제목: sections.제목, 내용: sections.내용, 댓글: sections.댓글, 키워드: sections.키워드, 이미지: sections.이미지, 이미지목록: attachedImages.length ? attachedImages : undefined, 동영상: sections.동영상, gif: sections.gif },
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
          <div className="flex items-center gap-4"><div className="w-1.5 h-8 bg-emerald-600 rounded-full" /><h3 className="text-xl font-black text-gray-900 italic">3. 작업 내용 (섹션별 안내)</h3></div>
          <div className="space-y-4">
            {REGISTER_SECTION_KEYS.map((key) => (
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
