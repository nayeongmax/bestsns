import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { NotificationType } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning } from '@/constants';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif', '작업링크', '작업안내'];

const PartTimeTaskDetail: React.FC<Props> = ({ user, addNotif }) => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [applyComment, setApplyComment] = useState('');
  const [workLink, setWorkLink] = useState('');

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    setTasks(getPartTimeTasks());
  }, [taskId]);

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const isApplicant = user && task?.applicants.some((a) => a.userId === user.id);
  const isOperator = user?.role === 'admin';

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

  /** 운영자: 신청자 선정 (선정만 가능) → 선정자에게 알림 + 알림페이지/워크페이스 반영 */
  const handleSelect = (userId: string) => {
    if (!task) return;
    const applicant = task.applicants.find((a) => a.userId === userId);
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : { ...t, applicants: t.applicants.map((a) => (a.userId === userId ? { ...a, selected: true } : a)) }
    );
    saveTasks(next);
    if (applicant && addNotif) {
      addNotif(
        userId,
        'freelancer',
        '프리랜서 선정',
        `[${task.title}]에 선정되었습니다. 작업 완료 후 작업 링크를 제출해 주세요.`,
        task.id
      );
    }
  };

  /** 선정된 프리랜서: 작업링크 제출 */
  const handleSubmitWorkLink = () => {
    if (!user || !task) return;
    const link = workLink.trim();
    if (!link) {
      alert('작업 링크를 입력해 주세요.');
      return;
    }
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : {
            ...t,
            applicants: t.applicants.map((a) =>
              a.userId === user.id ? { ...a, workLink: link } : a
            ),
          }
    );
    saveTasks(next);
    setWorkLink('');
    alert('작업 링크가 제출되었습니다. 운영자 확인 후 포인트가 지급됩니다.');
  };

  /** 운영자: 작업링크 확인 후 포인트 지급 (작업링크 제출한 선정자만) → 수익통장 적립 + 알림 */
  const handlePayPoints = () => {
    if (!task) return;
    const selectedWithLink = task.applicants.filter((a) => a.selected && a.workLink?.trim());
    if (selectedWithLink.length === 0) {
      alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다. 선정 후 작업자가 링크를 제출하면 지급할 수 있습니다.');
      return;
    }
    if (!confirm(`작업 링크를 확인하셨나요? ${selectedWithLink.length}명에게 각 ${task.reward.toLocaleString()} P를 지급합니다.`)) return;
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
            (key) => {
              const hasImageList = key === '이미지' && sections.이미지목록?.length;
              const hasImageContent = key === '이미지' && (sections[key] || hasImageList);
              if (key === '이미지' && !hasImageContent) return null;
              if (key !== '이미지' && !sections[key]) return null;
              return (
                <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{key}</p>
                  {key === '이미지' ? (
                    <>
                      {sections.이미지목록 && sections.이미지목록.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {sections.이미지목록.map((src, i) => (
                            <img key={i} src={src} alt={`참고 ${i + 1}`} className="max-h-32 rounded-lg object-contain border border-gray-200" />
                          ))}
                        </div>
                      )}
                      {sections.이미지?.startsWith('data:') && !sections.이미지목록?.length ? (
                        <img src={sections.이미지} alt="참고" className="max-h-40 rounded-lg object-contain border border-gray-200" />
                      ) : sections.이미지 ? (
                        <p className="text-gray-800 whitespace-pre-wrap">{sections.이미지}</p>
                      ) : null}
                    </>
                  ) : key === '작업링크' && sections.작업링크 && (sections.작업링크.startsWith('http://') || sections.작업링크.startsWith('https://')) ? (
                    <p className="text-gray-800 whitespace-pre-wrap"><a href={sections.작업링크} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{sections.작업링크}</a></p>
                  ) : (
                    <p className="text-gray-800 whitespace-pre-wrap">{sections[key]}</p>
                  )}
                </div>
              );
            }
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
              <>
                <p className="text-gray-500 font-bold">신청 완료되었습니다. 선정 시 수익통장에 포인트가 적립됩니다.</p>
                {(() => {
                  const me = task.applicants.find((a) => a.userId === user?.id);
                  if (me?.selected) {
                    return (
                      <div className="border-t border-gray-100 pt-6 mt-4">
                        <h3 className="text-lg font-black text-gray-800 mb-2">작업 링크 제출</h3>
                        <p className="text-sm text-gray-500 mb-3">작업을 완료한 후 결과 링크를 남겨 주세요. 운영자 확인 후 포인트가 지급됩니다.</p>
                        {me.workLink ? (
                          <p className="text-gray-700 font-bold">제출된 링크: <a href={me.workLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">{me.workLink}</a></p>
                        ) : (
                          <>
                            <input
                              type="url"
                              value={workLink}
                              onChange={(e) => setWorkLink(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none mb-2"
                            />
                            <button type="button" onClick={handleSubmitWorkLink} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all">
                              작업 링크 제출
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}

            {isOperator && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-black text-gray-800 mb-3">프리랜서 신청자 목록</h3>
                {task.applicants.length === 0 ? (
                  <p className="text-gray-500 py-4">아직 신청자가 없습니다.</p>
                ) : (
                <ul className="space-y-3">
                  {task.applicants.map((a) => (
                    <li key={a.userId} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-black text-gray-800">{a.nickname}</p>
                          <p className="text-sm text-gray-500">{a.comment || '신청합니다'}</p>
                        </div>
                        {a.selected ? (
                          <span className="px-4 py-2 rounded-lg text-sm font-black bg-emerald-600 text-white">선정됨</span>
                        ) : (
                          <button type="button" onClick={() => handleSelect(a.userId)} className="px-4 py-2 rounded-lg text-sm font-black bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all">
                            선정
                          </button>
                        )}
                      </div>
                      {a.selected && (
                        <div className="text-sm">
                          {a.workLink ? (
                            <p className="text-gray-700">작업 링크: <a href={a.workLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{a.workLink}</a></p>
                          ) : (
                            <p className="text-amber-600 font-bold">작업 링크 미제출</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                )}
                <p className="text-sm text-gray-500 mt-3">선정된 프리랜서가 작업 링크를 제출한 후, 확인하시고 포인트를 지급해 주세요.</p>
                <button
                  type="button"
                  onClick={handlePayPoints}
                  disabled={!task.applicants.some((a) => a.selected && a.workLink?.trim())}
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
