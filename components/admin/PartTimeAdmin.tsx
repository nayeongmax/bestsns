import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PartTimeTask } from '@/types';
import { NotificationType } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning } from '@/constants';

interface Props {
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const PartTimeAdmin: React.FC<Props> = ({ addNotif }) => {
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());

  useEffect(() => {
    setTasks(getPartTimeTasks());
  }, []);

  const tasksWithSelected = tasks.filter(
    (t) => !t.pointPaid && t.applicants.some((a) => a.selected)
  );

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const handlePayPoints = (task: PartTimeTask) => {
    const selectedWithLink = task.applicants.filter((a) => a.selected && a.workLink?.trim());
    if (selectedWithLink.length === 0) {
      alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다.');
      return;
    }
    if (!confirm(`작업을 확인하셨나요? ${selectedWithLink.length}명에게 각 ${task.reward.toLocaleString()} P를 수익통장에 지급합니다.`)) return;
    selectedWithLink.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
    if (addNotif) {
      selectedWithLink.forEach((a) =>
        addNotif(a.userId, 'freelancer', '포인트 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()} P가 수익통장에 적립되었습니다.`, task.id)
      );
    }
    const paidIds = selectedWithLink.map((a) => a.userId);
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, pointPaid: true, paidUserIds: [...(t.paidUserIds || []), ...paidIds] }
    );
    saveTasks(next);
    alert('포인트가 지급되었습니다.');
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
      <h3 className="text-xl font-black text-gray-900 mb-2">누구나알바 · 프리랜서 작업 관리</h3>
      <p className="text-sm text-gray-500 mb-6">선정된 프리랜서의 작업 링크를 확인한 후, 작업이 잘 되었으면 포인트 지급 버튼을 눌러 수익통장에 적립해 주세요.</p>

      {tasksWithSelected.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
          링크 확인 후 포인트 지급이 필요한 작업이 없습니다.
        </div>
      ) : (
        <ul className="space-y-6">
          {tasksWithSelected.map((task) => {
            const selectedWithLink = task.applicants.filter((a) => a.selected && a.workLink?.trim());
            const selectedNoLink = task.applicants.filter((a) => a.selected && !a.workLink?.trim());
            return (
              <li key={task.id} className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-500">+{task.reward.toLocaleString()} P · <Link to={`/part-time/${task.id}`} className="text-emerald-600 font-bold hover:underline">작업 상세 보기</Link></p>
                  </div>
                  {selectedWithLink.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePayPoints(task)}
                      className="px-6 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-all"
                    >
                      작업 확인 후 포인트 지급 ({selectedWithLink.length}명)
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {task.applicants.filter((a) => a.selected).map((a) => (
                    <div key={a.userId} className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-white border border-gray-100">
                      <span className="font-bold text-gray-800">{a.nickname}</span>
                      {a.workLink ? (
                        <a href={a.workLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold text-sm truncate max-w-[280px] hover:underline">
                          작업 링크 확인
                        </a>
                      ) : (
                        <span className="text-amber-600 text-sm font-bold">링크 미제출</span>
                      )}
                    </div>
                  ))}
                </div>
                {selectedNoLink.length > 0 && (
                  <p className="text-xs text-gray-500">링크 미제출 {selectedNoLink.length}명은 링크 제출 후 지급 가능합니다.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PartTimeAdmin;
