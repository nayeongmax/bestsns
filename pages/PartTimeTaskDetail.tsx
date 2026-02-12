import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning } from '@/constants';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지'];

const PartTimeTaskDetail: React.FC<Props> = ({ user }) => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [applyComment, setApplyComment] = useState('');

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    setTasks(getPartTimeTasks());
  }, [taskId]);

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const isApplicant = user && task?.applicants.some((a) => a.userId === user.id);
  const isCreator = user && task?.createdBy === user.id;

  const handleApply = () => {
    if (!user || !task) return;
    if (task.applicants.some((a) => a.userId === user.id)) {
      alert('이미 신청하셨습니다.');
      return;
    }
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : {
            ...t,
            applicants: [
              ...t.applicants,
              { userId: user.id, nickname: user.nickname, comment: applyComment.trim() || '신청합니다', selected: false, appliedAt: new Date().toISOString() },
            ],
          }
    );
    saveTasks(next);
    setApplyComment('');
    alert('신청되었습니다.');
  };

  const handleToggleSelect = (userId: string) => {
    if (!task) return;
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : { ...t, applicants: t.applicants.map((a) => (a.userId === userId ? { ...a, selected: !a.selected } : a)) }
    );
    saveTasks(next);
  };

  const handlePayPoints = () => {
    if (!task) return;
    const selected = task.applicants.filter((a) => a.selected);
    if (selected.length === 0) {
      alert('선정할 작업자를 선택해 주세요.');
      return;
    }
    if (!confirm(`선정된 ${selected.length}명에게 각 ${task.reward.toLocaleString()} P를 지급하시겠습니까?`)) return;
    selected.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
    const paidIds = selected.map((a) => a.userId);
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, pointPaid: true, paidUserIds: [...(t.paidUserIds || []), ...paidIds] }
    );
    saveTasks(next);
    alert('포인트가 지급되었습니다.');
    navigate('/part-time');
  };

  if (!task) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <p className="text-gray-500 font-bold">작업을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/part-time')} className="mt-4 text-emerald-600 font-black hover:underline">
          목록으로
        </button>
      </div>
    );
  }

  const sections = task.sections || {};

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] p-8 shadow-xl border border-gray-100 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{task.category}</span>
            <h1 className="text-2xl font-black text-gray-900 mt-1">{task.title}</h1>
            <p className="text-gray-500 mt-1">{task.description}</p>
            <p className="text-emerald-600 font-black text-lg mt-2">+{task.reward.toLocaleString()} P</p>
          </div>
          <button onClick={() => navigate('/part-time')} className="shrink-0 text-gray-500 hover:text-gray-800 font-bold text-sm">
            ← 목록
          </button>
        </div>

        <div className="grid gap-4">
          <h3 className="text-sm font-black text-gray-500 uppercase">작업 내용 (작업자가 할 일)</h3>
          {SECTIONS_ORDER.map(
            (key) =>
              sections[key] && (
                <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{key}</p>
                  <p className="text-gray-800 whitespace-pre-wrap">{sections[key]}</p>
                </div>
              )
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-[10px] font-black text-blue-600 uppercase">신청기간</p>
            <p className="text-gray-800 font-bold">{task.applicationPeriod.start} ~ {task.applicationPeriod.end}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <p className="text-[10px] font-black text-amber-600 uppercase">작업기간</p>
            <p className="text-gray-800 font-bold">{task.workPeriod.start} ~ {task.workPeriod.end}</p>
          </div>
        </div>

        {user && !task.pointPaid && (
          <>
            {!isApplicant ? (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm font-bold text-gray-700 mb-2">신청 댓글 (선택)</p>
                <input
                  type="text"
                  value={applyComment}
                  onChange={(e) => setApplyComment(e.target.value)}
                  placeholder="신청합니다"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                <button
                  type="button"
                  onClick={handleApply}
                  className="mt-3 px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all"
                >
                  신청하기
                </button>
              </div>
            ) : (
              <p className="text-gray-500 font-bold">신청 완료되었습니다. 선정 시 수익통장에 포인트가 적립됩니다.</p>
            )}

            {(isCreator || user.role === 'admin') && task.applicants.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-black text-gray-800 mb-3">신청자 목록 (선정 / 미선정)</h3>
                <ul className="space-y-2">
                  {task.applicants.map((a) => (
                    <li key={a.userId} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="font-black text-gray-800">{a.nickname}</p>
                        <p className="text-sm text-gray-500">{a.comment || '신청합니다'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(a.userId)}
                        className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${
                          a.selected ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {a.selected ? '선정됨' : '미선정'}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handlePayPoints}
                  disabled={!task.applicants.some((a) => a.selected)}
                  className="mt-4 px-6 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  포인트 지급하기
                </button>
              </div>
            )}
          </>
        )}

        {task.pointPaid && (
          <p className="text-center text-gray-500 font-bold py-4">이 작업은 마감되었습니다.</p>
        )}

        {!user && (
          <p className="text-center text-gray-500 font-bold">로그인 후 신청할 수 있습니다.</p>
        )}
      </div>
    </div>
  );
};

export default PartTimeTaskDetail;
