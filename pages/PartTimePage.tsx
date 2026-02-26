import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask, PartTimeJobRequest, PartTimeTaskSections, PartTimePostBlock } from '@/types';
import { MIN_WITHDRAW_FREELANCER, compressImageForStorage } from '@/constants';
import {
  fetchPartTimeTasks,
  fetchPartTimeJobRequests,
  upsertPartTimeTask,
  fetchFreelancerBalance,
  fetchPartTimeCompletedIds,
  processAutoApprovalsInDb,
} from '../parttimeDb';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const PartTimePage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [tasks, setTasks] = useState<PartTimeTask[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await processAutoApprovalsInDb();
        const [taskList, completedSet] = await Promise.all([fetchPartTimeTasks(), user?.id ? fetchPartTimeCompletedIds(user.id) : Promise.resolve(new Set<string>())]);
        if (!cancelled) {
          setTasks(taskList);
          setCompletedIds(completedSet);
        }
      } catch (e) {
        if (!cancelled) console.error('PartTime tasks load:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchFreelancerBalance(user.id).then((b) => { if (!cancelled) setBalance(b); }).catch((e) => { if (!cancelled) console.error('Balance load:', e); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const isTaskDone = (task: PartTimeTask) =>
    completedIds.has(task.id) || (task.paidUserIds && user?.id && task.paidUserIds.includes(user.id));

  const todayStrVal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const weekDates = useMemo(() => {
    const arr: string[] = [];
    const base = new Date(todayStrVal);
    base.setDate(base.getDate() + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
    return arr;
  }, [todayStrVal, weekOffset]);

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 font-bold">로딩 중...</p>
      </div>
    );
  }

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
            <p className="text-gray-700 font-black mt-1">프리랜서 작업이 필요하시면 아래에 작업의뢰를 눌러주세요.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  onClick={() => navigate('/part-time/register')}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-700 transition-all ring-2 ring-gray-400/50"
                  title="광고주 결제 후 여기서 작업을 등록하세요 (운영자 전용)"
                >
                  작업 등록 (운영자)
                </button>
              )}
              <button
                onClick={() => navigate('/part-time/request')}
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all"
              >
                작업의뢰
              </button>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  onClick={() => navigate('/part-time/register')}
                  className="px-5 py-3 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition-all ring-2 ring-amber-400/50"
                  title="작업 등록 (운영자 전용)"
                >
                  작업등록
                </button>
              )}
            </div>
          </div>
          {user ? (
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 min-w-[200px]">
              <p className="text-[11px] font-black text-gray-500 uppercase italic">수익통장</p>
              <p className="text-2xl font-black text-gray-900">{balance.toLocaleString()} P</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all"
            >
              로그인 후 이용
            </button>
          )}
        </div>

        <div className="grid gap-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 font-black text-sm"
            >
              ←
            </button>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {weekDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`p-3 rounded-xl border text-sm font-black transition-all ${
                    d === effectiveDate
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="block opacity-80">{d.slice(5).replace('-', '/')}</span>
                  <span className="text-xs">
                    {dateCounts[d]?.done ?? 0}/{dateCounts[d]?.total ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 font-black text-sm"
            >
              →
            </button>
          </div>
          <h3 className="text-xl font-black text-gray-800">작업목록</h3>
          {sortedTasks.length === 0 ? (
            <p className="text-gray-500 font-bold">해당 날짜에 작업이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border ${
                    isTaskDone(task) ? 'bg-gray-50 border-gray-200' : 'border-emerald-100 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-gray-900">{task.title}</span>
                    <span className="text-sm font-bold text-gray-500">{task.reward} P</span>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{task.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      {task.category}
                    </span>
                    {isTaskDone(task) && (
                      <span className="text-xs font-black text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        완료
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-100">
          <p className="text-sm font-bold text-gray-700">
            작업의뢰는 광고주가 요청한 프리랜서 작업을 등록하는 메뉴입니다. 작업 등록은 운영자만 할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/sns')}
          className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200 transition-all"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default PartTimePage;
export { default as PartTimeTaskRegister } from './PartTimeTaskResgister';
