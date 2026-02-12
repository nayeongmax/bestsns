import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { getFreelancerBalance, MIN_WITHDRAW_FREELANCER, getPartTimeTasks } from '@/constants';

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
            <p className="text-gray-500 font-bold mt-2">프리랜서 작업을 하고 수익통장에 포인트를 쌓아보세요.</p>
            <p className="text-gray-400 text-sm mt-1">프리랜서 작업이 필요하시면 고객센터로 문의주세요.</p>
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
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/part-time/register')}
              className="shrink-0 px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-emerald-700 transition-all"
            >
              작업 등록
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
