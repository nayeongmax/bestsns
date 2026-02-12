import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import { getFreelancerBalance, addFreelancerEarning, MIN_WITHDRAW } from '@/services/freelancerEarnings';

interface Props {
  user: UserProfile | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

interface FreelanceTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  category: string;
  done?: boolean;
}

const MOCK_TASKS: FreelanceTask[] = [
  { id: 't1', title: '간단 설문 참여', description: '1분 소요 설문에 참여해 주세요.', reward: 300, category: '설문' },
  { id: 't2', title: 'SNS 공유 인증', description: '지정 포스트 공유 후 캡처 제출', reward: 500, category: 'SNS' },
  { id: 't3', title: '리뷰 작성', description: '이용 후 리뷰 한 건 작성', reward: 400, category: '리뷰' },
  { id: 't4', title: '콘텐츠 검수', description: '짧은 텍스트/이미지 검수', reward: 600, category: '검수' },
  { id: 't5', title: '데이터 라벨링 (소량)', description: '이미지/텍스트 분류 10건', reward: 800, category: '라벨링' },
  { id: 't6', title: '번역/교정 (1페이지)', description: 'A4 1페이지 분량 번역 또는 교정', reward: 1500, category: '번역' },
];

const PartTimePage: React.FC<Props> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('parttime_completed_v1');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      setBalance(getFreelancerBalance(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem('parttime_completed_v1', JSON.stringify(Array.from(completedIds)));
  }, [completedIds]);

  const handleCompleteTask = (task: FreelanceTask) => {
    if (!user?.id) {
      alert('로그인 후 이용 가능합니다.');
      navigate('/login');
      return;
    }
    if (completedIds.has(task.id)) return;
    setProcessingId(task.id);
    addFreelancerEarning(user.id, task.reward, task.title);
    setBalance((prev) => prev + task.reward);
    setCompletedIds((prev) => new Set(prev).add(task.id));
    setProcessingId(null);
  };

  const tasksWithDone = MOCK_TASKS.map((t) => ({ ...t, done: completedIds.has(t.id) }));

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
          </div>
          {user ? (
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 min-w-[200px]">
              <p className="text-[11px] font-black text-gray-500 uppercase italic">수익통장</p>
              <p className="text-2xl font-black text-emerald-700 italic">{balance.toLocaleString()} P</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {balance >= MIN_WITHDRAW ? '출금 가능' : `${(MIN_WITHDRAW - balance).toLocaleString()} P 더 모으면 출금 가능`}
              </p>
              <Link
                to="/mypage"
                state={{ activeTab: 'freelancer' } as any}
                className="inline-block mt-3 text-emerald-600 font-black text-sm hover:underline"
              >
                마이페이지에서 출금하기 →
              </Link>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black hover:bg-emerald-600 transition-all"
            >
              로그인 후 이용
            </button>
          )}
        </div>

        <div className="grid gap-4">
          <h3 className="text-xl font-black text-gray-800">진행 가능한 작업</h3>
          {tasksWithDone.map((task) => (
            <div
              key={task.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border ${
                task.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-emerald-200'
              }`}
            >
              <div className="flex-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{task.category}</span>
                <h4 className="font-black text-gray-900">{task.title}</h4>
                <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-black text-emerald-600">+{task.reward.toLocaleString()} P</span>
                {task.done ? (
                  <span className="px-4 py-2 rounded-xl bg-gray-200 text-gray-500 text-sm font-black">완료됨</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCompleteTask(task)}
                    disabled={!user || processingId === task.id}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {processingId === task.id ? '처리 중...' : '완료하기'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50/80 p-6 rounded-2xl border border-blue-100">
          <p className="text-blue-800 font-bold">
            💡 수익통장에 쌓인 포인트는 <strong>{MIN_WITHDRAW.toLocaleString()} P</strong> 이상일 때 마이페이지 &gt; 프리랜서 워크페이스에서 포인트로 출금할 수 있습니다.
          </p>
        </div>

        <button
          onClick={() => navigate('/sns')}
          className="bg-gray-100 text-gray-600 px-6 py-3 rounded-xl font-black hover:bg-gray-200 transition-all"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default PartTimePage;
