import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OperatingCompany, RevenueProject, RevenueTodo, WorkType, GeneralExpense, ExpenseCategory, UserProfile } from '@/types';
import {
  fetchRevenueCompanies,
  upsertRevenueCompanies,
  fetchRevenueProjects,
  upsertRevenueProjects,
  fetchRevenueTodos,
  upsertRevenueTodos,
  fetchRevenueGeneralExpenses,
  upsertRevenueGeneralExpenses,
  deleteRevenueProject,
} from '../revenueDb';

const PROJECT_TYPES: WorkType[] = ['카페관리', '블로그대행', '블로그체험단', '유튜브', '인스타그램', '기타작업'];
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['운영비', '인건비', '식비', '집기구입비', '구독비', '기타비용'];
const CHANNEL_OPTIONS = ['크몽', '직거래', '숨고', '쇼핑몰', '키플랫', '기타'];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface Props {
  user: UserProfile;
}

const RevenueManagement: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'todo' | 'project' | 'data' | 'profit'>('dashboard');
  const revenueDbLoaded = useRef(false);

  const [companies, setCompanies] = useState<OperatingCompany[]>(() => loadFromStorage('rev_companies', []));
  const [projects, setProjects] = useState<RevenueProject[]>(() => loadFromStorage('rev_projects', []));
  const [todos, setTodos] = useState<RevenueTodo[]>(() => loadFromStorage('rev_todos', []));
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>(() => loadFromStorage('rev_general_expenses', []));

  // DB 저장 실패 시 화면에 표시 (로컬에만 저장됨 안내)
  const [dbSaveError, setDbSaveError] = useState<string | null>(null);

  // Supabase 저장 (데이터 있으면 즉시 저장)
  const saveErrShown = useRef<Record<string, boolean>>({});
  const showSaveError = (key: string, err: unknown) => {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : String(err);
    setDbSaveError(msg || 'DB 저장 실패');
    if (saveErrShown.current[key]) return;
    saveErrShown.current[key] = true;
    console.error(`매출관리 ${key} 저장 실패:`, err);
    alert(`DB 저장에 실패했습니다.\n\n[에러] ${msg}\n\n지금 보이는 데이터는 이 기기 브라우저에만 저장됩니다. 다른 기기·캐시 삭제 시 사라집니다.\n\n해결: Supabase SQL Editor에서 supabase-setup-4단계-매출관리.sql 실행 후, 이메일+비밀번호로 다시 로그인해 주세요.`);
  };

  // 쿠키/캐시 삭제 후에도 DB에서 복원 — 마운트 시 1회 로드
  useEffect(() => {
    if (!user?.id || revenueDbLoaded.current) return;
    revenueDbLoaded.current = true;
    (async () => {
      try {
        const [companiesData, projectsData, todosData, expensesData] = await Promise.all([
          fetchRevenueCompanies(user.id),
          fetchRevenueProjects(user.id),
          fetchRevenueTodos(user.id),
          fetchRevenueGeneralExpenses(user.id),
        ]);
        setCompanies(companiesData);
        setProjects(projectsData);
        setTodos(todosData);
        setGeneralExpenses(expensesData);
      } catch (e) {
        console.error('매출관리 DB 로드 실패:', e);
        revenueDbLoaded.current = false;
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    upsertRevenueCompanies(user.id, companies).catch((err) => showSaveError('회사', err));
  }, [user?.id, companies]);
  useEffect(() => {
    if (!user?.id) return;
    upsertRevenueProjects(user.id, projects).catch((err) => showSaveError('프로젝트', err));
  }, [user?.id, projects]);
  useEffect(() => {
    if (!user?.id) return;
    upsertRevenueTodos(user.id, todos).catch((err) => showSaveError('할일', err));
  }, [user?.id, todos]);
  useEffect(() => {
    if (!user?.id) return;
    upsertRevenueGeneralExpenses(user.id, generalExpenses).catch((err) => showSaveError('지출', err));
  }, [user?.id, generalExpenses]);

  // localStorage 백업 (다른 페이지 갔다 와도 복원용)
  useEffect(() => localStorage.setItem('rev_companies', JSON.stringify(companies)), [companies]);
  useEffect(() => localStorage.setItem('rev_projects', JSON.stringify(projects)), [projects]);
  useEffect(() => localStorage.setItem('rev_todos', JSON.stringify(todos)), [todos]);
  useEffect(() => localStorage.setItem('rev_general_expenses', JSON.stringify(generalExpenses)), [generalExpenses]);

  // UI 상태
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'work' | 'todo'>('all');
  const [currentDate, setCurrentDate] = useState(new Date());

  // 지출 입력 임시 상태
  const [tempExpense, setTempExpense] = useState<Partial<GeneralExpense>>({
    date: new Date().toISOString().split('T')[0],
    category: '운영비',
    note: '',
    amount: 0
  });

  // 폼 상태
  const [newCompany, setNewCompany] = useState<Partial<OperatingCompany>>({ name: '', openingDate: '', type: '개인사업자', taxBusinessNames: [] });
  const [projectForm, setProjectForm] = useState<Partial<RevenueProject>>({
    type: '카페관리', operatingCompanyId: '', round: 1, taxInvoice: '미발행', channel: '크몽', 
    startDate: new Date().toISOString().split('T')[0], duration: 20, status: '진행중', deadlineType: 'weekday', workLink: ''
  });
  const [todoForm, setTodoForm] = useState<Partial<RevenueTodo>>({
    text: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0]
  });

  // --- 헬퍼 함수 ---

  const calculateEndDate = (startDate: string, duration: number) => {
    let date = new Date(startDate);
    let count = 0;
    while (count < duration - 1) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return date.toISOString().split('T')[0];
  };

  const calculateFixedEndDate = (startDate: string, fixedDay: number) => {
    const sDate = new Date(startDate);
    let target = new Date(sDate.getFullYear(), sDate.getMonth(), fixedDay);
    if (target <= sDate) {
      target = new Date(sDate.getFullYear(), sDate.getMonth() + 1, fixedDay);
    }
    return target.toISOString().split('T')[0];
  };

  const getCalculatedDeadline = (startDate: string, type: 'weekday' | 'fixed' | 'specific', duration?: number, fixedDay?: number, specificEndDate?: string) => {
    if (type === 'weekday') return calculateEndDate(startDate, duration || 20);
    if (type === 'fixed') return calculateFixedEndDate(startDate, fixedDay || 25);
    return specificEndDate || startDate;
  };

  const finalDeadline = useMemo(() => {
    return getCalculatedDeadline(
      projectForm.startDate!, 
      projectForm.deadlineType as any, 
      projectForm.duration, 
      projectForm.fixedDay, 
      projectForm.endDate
    );
  }, [projectForm]);

  const copyIntegratedDataForSheets = () => {
    if (currentMonthProjects.length === 0 && currentMonthExpenses.length === 0) {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    let clipboardText = "[ 수입 내역 ]\n차수\t작업종류\t업체명\t금액\t마감일\n";
    currentMonthProjects.forEach(p => {
      clipboardText += `${p.round}\t${p.type}\t${p.clientName}\t${p.paymentAmount}\t${p.endDate}\n`;
    });
    clipboardText += `\n총 수입 합계\t\t\t${totalIncome}\n\n`;

    clipboardText += "[ 지출 내역 ]\n날짜\t항목\t설명\t금액\n";
    currentMonthExpenses.forEach(e => {
      clipboardText += `${e.date}\t${e.category}\t${e.note}\t${e.amount}\n`;
    });
    clipboardText += `\n총 지출 합계\t\t\t${totalOutgo}\n\n`;
    clipboardText += `최종 순수익\t\t\t${totalIncome - totalOutgo}`;

    navigator.clipboard.writeText(clipboardText).then(() => {
      alert('복사되었습니다. 구글시트에서 붙여넣기하세요.');
    });
  };

  const copyDataListForSheets = () => {
    const headers = ['round', 'type', 'clientName', 'endDate', 'paymentAmount'];
    const rows = [
      headers.join('\t'),
      ...currentMonthProjects.map(row => headers.map(header => (row as any)[header] || '').join('\t'))
    ];
    navigator.clipboard.writeText(rows.join('\n')).then(() => {
      alert('복사되었습니다. 구글시트에서 붙여넣기하세요.');
    });
  };

  // --- 비즈니스 로직 ---

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProjectId) {
      setProjects(prev => prev.map(p => p.id === editingProjectId ? { ...projectForm as RevenueProject, id: editingProjectId, endDate: finalDeadline!, createdAt: p.createdAt } : p));
      setEditingProjectId(null);
    } else {
      const newProj: RevenueProject = { ...projectForm as RevenueProject, id: `pj_${Date.now()}`, endDate: finalDeadline!, createdAt: new Date().toISOString() };
      setProjects(prev => [newProj, ...prev]);
    }
    setProjectForm({ type: '카페관리', operatingCompanyId: '', round: 1, taxInvoice: '미발행', channel: '크몽', startDate: new Date().toISOString().split('T')[0], duration: 20, status: '진행중', deadlineType: 'weekday', workLink: '' });
    setActiveTab('data');
  };

  const startEditProject = (p: RevenueProject) => {
    setProjectForm({ ...p });
    setEditingProjectId(p.id);
    setActiveTab('project');
  };

  const handleExtendProject = (p: RevenueProject) => {
    const nextDay = new Date(p.endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    const newStartDateStr = nextDay.toISOString().split('T')[0];
    const newEndDate = getCalculatedDeadline(newStartDateStr, p.deadlineType, p.duration, p.fixedDay, p.endDate);
    const extendedProj: RevenueProject = {
      ...p,
      id: `pj_${Date.now()}`,
      round: p.round + 1,
      startDate: newStartDateStr,
      endDate: newEndDate,
      status: '진행중',
      createdAt: new Date().toISOString()
    };
    setProjects(prev => [extendedProj, ...prev]);
    const extDate = new Date(newStartDateStr);
    const extMonth = extDate.getMonth() + 1;
    alert(`${p.clientName} 업체의 ${extendedProj.round}차 연장이 완료되었습니다.\n새 시작일: ${newStartDateStr} (주말 제외)\n해당 데이터는 ${extMonth}월 리스트에서 확인 가능합니다.`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user?.id) return;
    if (!window.confirm('이 프로젝트를 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
      await deleteRevenueProject(user.id, projectId);
      setProjects(prev => prev.filter(item => item.id !== projectId));
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('프로젝트 삭제 실패:', err);
      alert('DB 삭제에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const addGeneralExpense = () => {
    if (!tempExpense.note || !tempExpense.amount) return alert('지출 항목과 금액을 입력하세요.');
    const entry: GeneralExpense = { id: `ex_${Date.now()}`, date: tempExpense.date!, category: tempExpense.category as any, note: tempExpense.note!, amount: tempExpense.amount! };
    setGeneralExpenses(prev => [entry, ...prev]);
    setTempExpense({ date: new Date().toISOString().split('T')[0], category: '운영비', note: '', amount: 0 });
  };

  const deleteExpense = (id: string) => {
    setGeneralExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleCompanySubmit = () => {
    if (!newCompany.name || !newCompany.openingDate) return alert('필수 정보를 입력하세요.');
    if (editingCompanyId) {
      setCompanies(prev => prev.map(c => c.id === editingCompanyId ? { ...newCompany as OperatingCompany, id: editingCompanyId } : c));
      setEditingCompanyId(null);
    } else {
      const company: OperatingCompany = { id: `com_${Date.now()}`, name: newCompany.name!, openingDate: newCompany.openingDate!, type: (newCompany.type as any) || '개인사업자', taxBusinessNames: newCompany.taxBusinessNames || [] };
      setCompanies(prev => [...prev, company]);
    }
    setNewCompany({ name: '', openingDate: '', type: '개인사업자', taxBusinessNames: [] });
  };

  const currentMonthProjects = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return projects.filter(p => {
      const pDate = new Date(p.startDate);
      return pDate.getFullYear() === year && pDate.getMonth() === month;
    });
  }, [projects, currentDate]);

  const currentMonthExpenses = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return generalExpenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getFullYear() === year && eDate.getMonth() === month;
    });
  }, [generalExpenses, currentDate]);

  const totalIncome = currentMonthProjects.reduce((sum, p) => sum + p.paymentAmount, 0);
  const totalOutgo = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalProfit = currentMonthProjects.reduce((sum, p) => sum + p.settlementAmount, 0);

  // --- 렌더링 ---

  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-gray-900 rounded-[40px] p-10 shadow-2xl border border-gray-800 space-y-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h5 className="font-black text-2xl italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">통합 비즈니스 실적</h5>
              <p className="text-[11px] font-bold text-gray-400 mt-3 uppercase tracking-[0.2em]">{currentDate.getFullYear()}. {currentDate.getMonth() + 1} TOTAL PERFORMANCE</p>
            </div>
            <span className="bg-blue-600 text-[10px] font-black px-4 py-1.5 rounded-full italic uppercase shadow-lg tracking-widest">Global Overview</span>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
               <span className="text-[10px] font-bold text-gray-400 uppercase">총 계약 건수</span>
               <p className="text-2xl font-black mt-1">{currentMonthProjects.length}건</p>
            </div>
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
               <span className="text-[10px] font-bold text-gray-400 uppercase">총 매출액</span>
               <p className="text-2xl font-black mt-1 italic tracking-tighter">₩{totalIncome.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-blue-600/20 p-8 rounded-[32px] border border-blue-500/30">
              <div className="flex justify-between items-center">
                 <span className="text-[12px] font-black text-blue-300 uppercase tracking-widest">당월 통합 순수익</span>
                 <span className="text-4xl font-black text-green-400 italic tracking-tighter">₩{totalProfit.toLocaleString()}</span>
              </div>
          </div>
        </div>

        <h4 className="font-black text-gray-400 text-[11px] uppercase tracking-[0.4em] px-6 pt-4">Operating Companies</h4>
        {companies.map(com => {
          const comProjects = currentMonthProjects.filter(p => p.operatingCompanyId === com.id);
          const comRevenue = comProjects.reduce((sum, p) => sum + p.paymentAmount, 0);
          const comProfit = comProjects.reduce((sum, p) => sum + p.settlementAmount, 0);
          const estTax = Math.floor(comRevenue * 0.1);

          return (
            <div key={com.id} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 space-y-6 relative overflow-hidden group hover:border-blue-200 transition-all">
              <div className="flex justify-between items-start">
                <h5 className="font-black text-gray-900 text-lg italic">{com.name}</h5>
                <span className="text-[10px] font-bold text-gray-300 uppercase">{com.type}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px] font-bold">
                  <span className="text-gray-400">계약</span>
                  <span className="text-gray-900 font-black">{comProjects.length} 건</span>
                </div>
                <div className="flex justify-between items-center text-[13px] font-bold">
                  <span className="text-gray-400">매출</span>
                  <span className="text-gray-900 font-black">₩{comRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] font-bold">
                  <span className="text-gray-400">수익</span>
                  <span className="text-green-600 font-black">₩{comProfit.toLocaleString()}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-[11px] font-bold text-gray-300">예상 세액 (10%)</span>
                <span className="text-sm font-black text-gray-400 italic">₩{estTax.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lg:col-span-8 bg-white rounded-[48px] p-10 shadow-sm border border-gray-100 min-h-[900px]">
        <div className="flex justify-between items-center mb-10 px-4">
          <div className="flex items-center gap-8">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="text-gray-300 hover:text-gray-900 transition-colors">◀</button>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="text-gray-300 hover:text-gray-900 transition-colors">▶</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCalendarFilter('all')} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black italic shadow-sm tracking-widest border transition-all ${calendarFilter === 'all' ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>전체</button>
            <button onClick={() => setCalendarFilter('work')} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black italic shadow-sm tracking-widest border transition-all ${calendarFilter === 'work' ? 'bg-blue-600 text-white border-blue-600' : 'bg-red-50 text-red-500 border-red-100'}`}>작업</button>
            <button onClick={() => setCalendarFilter('todo')} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black italic shadow-sm tracking-widest border transition-all ${calendarFilter === 'todo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-green-50 text-green-600 border-green-100'}`}>TO-DO</button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-l border-gray-100 rounded-3xl overflow-hidden">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
            <div key={day} className={`p-4 text-center text-[10px] font-black border-r border-b border-gray-100 bg-gray-50/50 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{day}</div>
          ))}
          {Array.from({ length: 42 }).map((_, i) => {
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
            const date = i - firstDay + 1;
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const isCurrentMonth = date > 0 && date <= lastDay;
            const dateStr = isCurrentMonth ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}` : null;
            
            const dayTodos = dateStr ? todos.filter(t => dateStr >= t.startDate && dateStr <= t.endDate) : [];
            const dayProjectsStart = dateStr ? projects.filter(p => p.startDate === dateStr) : [];
            const dayProjectsEnd = dateStr ? projects.filter(p => p.endDate === dateStr) : [];

            return (
              <div key={i} className={`min-h-[160px] p-3 border-r border-b border-gray-100 transition-colors ${!isCurrentMonth ? 'bg-gray-50/20 opacity-30' : 'hover:bg-blue-50/20'}`}>
                {isCurrentMonth && (
                  <>
                    <span className={`text-[12px] font-black ${i % 7 === 0 ? 'text-red-400' : i % 7 === 6 ? 'text-blue-400' : 'text-gray-900'}`}>{date}</span>
                    <div className="mt-3 space-y-1.5">
                       {(calendarFilter === 'all' || calendarFilter === 'work') && dayProjectsStart.map(p => <div key={p.id} className="text-[9px] font-black bg-blue-600 text-white p-1 rounded-md shadow-sm truncate italic">🚀 시작: {p.clientName}</div>)}
                       {(calendarFilter === 'all' || calendarFilter === 'work') && dayProjectsEnd.map(p => <div key={p.id} className="text-[9px] font-black bg-red-600 text-white p-1 rounded-md shadow-sm truncate italic">🏁 마감: {p.clientName}</div>)}
                       {(calendarFilter === 'all' || calendarFilter === 'todo') && dayTodos.map(t => <div key={t.id} className={`text-[9px] font-black p-1 rounded-md shadow-sm truncate italic border ${t.completed ? 'bg-gray-100 text-gray-300 border-gray-200 line-through' : 'bg-green-50 text-green-600 border-green-100'}`}>✓ {t.text}</div>)}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDataList = () => (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="bg-white rounded-[60px] p-16 shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-16 px-4">
            <div className="flex items-center gap-10">
              <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-12">작업 현황 관리</h3>
              <div className="flex items-center gap-6 bg-gray-50 px-8 py-3 rounded-3xl shadow-inner">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="text-gray-400 hover:text-black">◀</button>
                <span className="font-black text-xl text-gray-900 italic">{currentDate.getFullYear()}. {currentDate.getMonth() + 1}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="text-gray-400 hover:text-black">▶</button>
              </div>
            </div>
            <button onClick={copyDataListForSheets} className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-[13px] shadow-lg hover:bg-blue-600 transition-all uppercase italic">구글시트 복사</button>
         </div>

         <div className="overflow-x-auto rounded-[48px] border border-gray-50 shadow-sm">
           <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-8">차수</th><th className="px-10 py-8">작업 종류</th><th className="px-10 py-8">업체명</th><th className="px-10 py-8 text-center">운영사</th><th className="px-10 py-8 text-center">마감일</th><th className="px-10 py-8 text-right">금액</th><th className="px-10 py-8 text-center">링크</th><th className="px-10 py-8 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentMonthProjects.map(p => {
                  const com = companies.find(c => c.id === p.operatingCompanyId);
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-all group">
                      <td className="px-10 py-8"><span className="bg-gray-900 text-white px-4 py-1.5 rounded-full font-black text-[11px] italic">{p.round}차</span></td>
                      <td className="px-10 py-8 text-[11px] font-black text-orange-500 uppercase italic">{p.type}</td>
                      <td className="px-10 py-8 font-black text-gray-900 text-[16px] italic">{p.clientName}</td>
                      <td className="px-10 py-8 text-center font-bold text-gray-400 text-xs italic">{com?.name || '-'}</td>
                      <td className="px-10 py-8 text-center font-black text-red-400 text-[13px] italic">{p.endDate}</td>
                      <td className="px-10 py-8 text-right font-black text-gray-900 text-lg italic">₩{p.paymentAmount.toLocaleString()}</td>
                      <td className="px-10 py-8 text-center">
                        {p.workLink?.trim() ? (
                          <a href={p.workLink.trim()} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-xs hover:underline break-all">
                            링크 열기
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-10 py-8 text-center">
                         <div className="flex justify-center gap-4">
                            <button onClick={() => handleExtendProject(p)} className="text-[11px] font-black text-green-500 hover:text-green-700 italic uppercase">재연장</button>
                            <button onClick={() => startEditProject(p)} className="text-[11px] font-black text-blue-400 hover:text-blue-600 italic uppercase">수정</button>
                            <button onClick={() => handleDeleteProject(p.id)} className="text-[11px] font-black text-red-200 hover:text-red-500 italic uppercase">삭제</button>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
           </table>
         </div>
      </div>
    </div>
  );

  const renderProfitTab = () => (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-32">
      <div className="bg-white rounded-[60px] p-16 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-16 px-4">
           <div className="flex items-center gap-10">
              <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-green-500 underline-offset-12">정산 및 수익 관리</h3>
              <div className="flex items-center gap-6 bg-gray-50 px-8 py-3 rounded-3xl shadow-inner">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="text-gray-400 hover:text-black">◀</button>
                <span className="font-black text-xl text-gray-900 italic">{currentDate.getFullYear()}. {currentDate.getMonth() + 1}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="text-gray-400 hover:text-black">▶</button>
              </div>
           </div>
           <button onClick={copyIntegratedDataForSheets} className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-[13px] shadow-lg hover:bg-blue-600 transition-all uppercase italic">내역 통합 복사</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h4 className="text-xl font-black text-blue-600 flex items-center gap-2 italic"><span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 당월 수입 내역 (현황관리 연동)</h4>
            <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[11px] font-black text-gray-400 uppercase tracking-widest"><tr><th className="px-6 py-4">업체명</th><th className="px-6 py-4 text-right">금액</th><th className="px-6 py-4 text-center">링크</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {currentMonthProjects.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/20">
                      <td className="px-6 py-4 font-black text-sm">{p.clientName}</td>
                      <td className="px-6 py-4 text-right font-black">₩{p.paymentAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        {p.workLink?.trim() ? (
                          <a href={p.workLink.trim()} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-xs hover:underline break-all">
                            링크 열기
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/50"><td className="px-6 py-5 font-black text-blue-600">총 수입 합계</td><td className="px-6 py-5 text-right font-black text-blue-600 text-lg" colSpan={2}>₩{totalIncome.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xl font-black text-red-500 flex items-center gap-2 italic"><span className="w-1.5 h-6 bg-red-500 rounded-full"></span> 당월 지출 내역 (비용 직접 입력)</h4>
            <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={tempExpense.date} onChange={e => setTempExpense({...tempExpense, date: e.target.value})} className="p-3 rounded-xl border-none font-black text-xs shadow-inner" />
                <select value={tempExpense.category} onChange={e => setTempExpense({...tempExpense, category: e.target.value as any})} className="p-3 rounded-xl border-none font-black text-xs shadow-inner">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <input type="text" value={tempExpense.note} onChange={e => setTempExpense({...tempExpense, note: e.target.value})} placeholder="지출 상세 설명" className="w-full p-4 rounded-xl border-none font-black text-xs shadow-inner" />
              <div className="flex gap-4">
                <input type="number" value={tempExpense.amount || ''} onChange={e => setTempExpense({...tempExpense, amount: Number(e.target.value)})} placeholder="금액" className="flex-1 p-4 rounded-xl border-none font-black text-xs shadow-inner text-right" />
                <button onClick={addGeneralExpense} className="bg-black text-white px-8 rounded-xl font-black text-xs">기록</button>
              </div>
            </div>
            <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[11px] font-black text-gray-400 uppercase tracking-widest"><tr><th className="px-6 py-4">항목</th><th className="px-6 py-4 text-right">금액</th><th className="px-6 py-4 text-center">X</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {currentMonthExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-red-50/20">
                      <td className="px-6 py-4"><p className="font-black text-sm">{e.note}</p><p className="text-[10px] text-gray-400 uppercase">{e.date} | {e.category}</p></td>
                      <td className="px-6 py-4 text-right font-black">₩{e.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-red-500">✕</button></td>
                    </tr>
                  ))}
                  <tr className="bg-red-50/50"><td className="px-6 py-5 font-black text-red-600">총 지출 합계</td><td className="px-6 py-5 text-right font-black text-red-600 text-lg" colSpan={2}>₩{totalOutgo.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-16 bg-gray-900 rounded-[48px] p-12 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-10">
           <div><p className="text-[14px] font-black text-gray-400 uppercase tracking-widest italic mb-2">Settlement Summary</p><h4 className="text-3xl font-black italic tracking-tighter">당월 비즈니스 성과 보고</h4></div>
           <div className="flex gap-16 items-center">
              <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic">Revenue</p><p className="text-2xl font-black">₩{totalIncome.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic">Expense</p><p className="text-2xl font-black text-red-400">- ₩{totalOutgo.toLocaleString()}</p></div>
              <div className="text-right border-l border-white/10 pl-16"><p className="text-[12px] font-black text-green-400 uppercase italic mb-1">Net Profit</p><p className="text-5xl font-black italic tracking-tighter text-green-400">₩{(totalIncome - totalOutgo).toLocaleString()}</p></div>
           </div>
        </div>
      </div>
    </div>
  );

  const renderProjectForm = () => (
    <div className="max-w-[1600px] mx-auto animate-in zoom-in-95 duration-500">
      <div className="bg-white rounded-[60px] p-16 lg:p-24 shadow-2xl border border-gray-100 space-y-16">
        <h3 className="text-3xl font-black text-gray-900 flex items-center gap-4 mb-16 italic tracking-tighter"><span className="w-12 h-12 bg-blue-600 text-white rounded-3xl flex items-center justify-center text-xl shadow-lg">✍</span> {editingProjectId ? '프로젝트 정보 수정' : '신규 프로젝트 등록'}</h3>
        <form onSubmit={handleProjectSubmit} className="space-y-16">
          <div className="space-y-6">
            <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-4 italic">운영사 선택</label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {companies.map(com => (
                <button key={com.id} type="button" onClick={() => setProjectForm({...projectForm, operatingCompanyId: com.id})} className={`py-6 rounded-3xl text-[14px] font-black transition-all border-4 ${projectForm.operatingCompanyId === com.id ? 'bg-blue-50 border-blue-600 text-blue-600 shadow-xl' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-white hover:border-gray-200'}`}>{com.name}</button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 p-10 rounded-[48px] border border-gray-100 space-y-8">
            <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest italic">작업 종류</label>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              {PROJECT_TYPES.map(type => (
                <label key={type} className="flex items-center gap-3 cursor-pointer group"><input type="radio" checked={projectForm.type === type} onChange={() => setProjectForm({...projectForm, type: type as any})} className="w-5 h-5 accent-blue-600" /><span className={`text-[15px] font-black ${projectForm.type === type ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>{type}</span></label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
             <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4 italic">업체명</label><input type="text" value={projectForm.clientName || ''} onChange={e => setProjectForm({...projectForm, clientName: e.target.value})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" required /></div>
             <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4 italic">브랜드/카페명</label><input type="text" value={projectForm.cafeName || ''} onChange={e => setProjectForm({...projectForm, cafeName: e.target.value})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" /></div>
             <div className="space-y-3"><label className="text-[12px] font-black text-blue-500 px-4 italic underline decoration-blue-200">작업 페이지 링크</label><input type="text" value={projectForm.workLink || ''} onChange={e => setProjectForm({...projectForm, workLink: e.target.value})} placeholder="https://..." className="w-full p-6 bg-blue-50/50 border-none rounded-[32px] font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
             <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4">결제금액 (원)</label><input type="number" value={projectForm.paymentAmount || ''} onChange={e => setProjectForm({...projectForm, paymentAmount: Number(e.target.value)})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black shadow-inner" required /></div>
             <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4">실제 정산금 (원)</label><input type="number" value={projectForm.settlementAmount || ''} onChange={e => setProjectForm({...projectForm, settlementAmount: Number(e.target.value)})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black shadow-inner" required /></div>
             <div className="space-y-6">
                <label className="text-[12px] font-black text-gray-400 px-4 italic">세금계산서 발행 여부</label>
                <div className="flex gap-4">
                  {['발행', '미발행'].map(status => (
                    <button key={status} type="button" onClick={() => setProjectForm({...projectForm, taxInvoice: status as any})} className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all border-2 ${projectForm.taxInvoice === status ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>{status}</button>
                  ))}
                </div>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4 italic">계약 진행 방식</label><select value={projectForm.channel} onChange={e => setProjectForm({...projectForm, channel: e.target.value})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-900 shadow-inner outline-none appearance-none cursor-pointer focus:ring-4 focus:ring-blue-50">{CHANNEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-4 italic">진행 차수 (ROUND)</label><input type="number" value={projectForm.round} onChange={e => setProjectForm({...projectForm, round: Number(e.target.value)})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-900 text-center shadow-inner" /></div>
          </div>
          <div className="bg-blue-600 p-12 lg:p-16 rounded-[60px] text-white shadow-2xl space-y-12 relative overflow-hidden">
             <h4 className="text-2xl font-black italic tracking-tighter flex items-center gap-3">🗓 기간 및 마감 설정</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-8">
                   <div className="space-y-3"><label className="text-[11px] font-black text-blue-200 uppercase tracking-widest px-2">시작일</label><input type="date" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} className="w-full p-6 bg-white/10 border-2 border-white/20 rounded-[32px] font-black outline-none" /></div>
                   <div className="space-y-6">
                      <label className="flex items-center gap-4 cursor-pointer py-2 group"><input type="radio" checked={projectForm.deadlineType === 'weekday'} onChange={() => setProjectForm({...projectForm, deadlineType: 'weekday'})} className="w-6 h-6 accent-white" /><span className="font-black text-xl italic">평일 기준 소요</span><input type="number" value={projectForm.duration} onChange={e => setProjectForm({...projectForm, duration: Number(e.target.value)})} className="w-24 p-2 bg-white/20 rounded-xl text-center font-black" /><span className="text-blue-100 text-sm">일</span></label>
                      <label className="flex items-center gap-4 cursor-pointer py-2 group"><input type="radio" checked={projectForm.deadlineType === 'fixed'} onChange={() => setProjectForm({...projectForm, deadlineType: 'fixed'})} className="w-6 h-6 accent-white" /><span className="font-black text-xl italic">고정일 마감 (당/익월)</span><input type="number" value={projectForm.fixedDay || 25} onChange={e => setProjectForm({...projectForm, fixedDay: Number(e.target.value)})} className="w-20 p-2 bg-white/20 rounded-xl text-center font-black" /><span className="text-blue-100 text-sm">일</span></label>
                      <label className="flex items-center gap-4 cursor-pointer py-2 group"><input type="radio" checked={projectForm.deadlineType === 'specific'} onChange={() => setProjectForm({...projectForm, deadlineType: 'specific'})} className="w-6 h-6 accent-white" /><span className="font-black text-xl italic">특정일 직접 지정</span><input type="date" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} className="p-3 bg-white/20 rounded-xl font-black text-xs" /></label>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-white/5 border-2 border-white/10 rounded-[48px] p-10"><span className="text-blue-200 font-black text-sm uppercase tracking-[0.3em] mb-4 italic">최종 마감 예정일</span><p className="text-7xl font-black tracking-tighter italic">{finalDeadline}</p><p className="mt-8 text-blue-100 font-bold text-sm text-center leading-relaxed">계산된 마감일은 주말을 고려한<br/>가장 정확한 비즈니스 스케줄입니다.</p></div>
             </div>
          </div>
          <div className="flex gap-6">
             <button type="button" onClick={() => { setActiveTab('dashboard'); setEditingProjectId(null); }} className="flex-1 py-8 bg-gray-100 text-gray-400 rounded-[40px] font-black text-xl hover:bg-gray-200 transition-all italic uppercase">취소 / 돌아가기</button>
             <button type="submit" className="flex-[2] py-8 bg-black text-white rounded-[40px] font-black text-2xl shadow-2xl hover:bg-blue-600 transition-all italic uppercase tracking-widest">{editingProjectId ? '정보 수정 완료' : '신규 등록 완료'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderTodoTab = () => (
    <div className="max-w-[1600px] mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[56px] p-16 shadow-sm border border-gray-100">
        <h3 className="text-3xl font-black text-gray-900 italic mb-12 flex items-center gap-4"><span className="w-2 h-8 bg-blue-600 rounded-full"></span> 전체 할 일 관리 (TO-DO)</h3>
        <div className="bg-gray-50 p-10 rounded-[40px] border border-gray-100 mb-16 space-y-8">
           <div className="space-y-4"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">할 일 내용</label><input type="text" value={todoForm.text} onChange={e => setTodoForm({...todoForm, text: e.target.value})} placeholder="어떤 일을 하실 건가요?" className="w-full p-6 bg-white border-none rounded-[32px] font-black text-gray-800 text-lg shadow-sm outline-none focus:ring-4 focus:ring-blue-50" /></div>
           <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">시작일</label><input type="date" value={todoForm.startDate} onChange={e => setTodoForm({...todoForm, startDate: e.target.value})} className="w-full p-5 bg-white border-none rounded-2xl font-black shadow-sm" /></div>
              <div className="space-y-4"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">종료일</label><input type="date" value={todoForm.endDate} onChange={e => setTodoForm({...todoForm, endDate: e.target.value})} className="w-full p-5 bg-white border-none rounded-2xl font-black shadow-sm" /></div>
           </div>
           <button onClick={() => { if (!todoForm.text) return; setTodos(prev => [...prev, { id: `td_${Date.now()}`, text: todoForm.text!, startDate: todoForm.startDate!, endDate: todoForm.endDate!, completed: false }]); setTodoForm({ text: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }); }} className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-xl shadow-blue-100 hover:bg-black transition-all">할 일 추가하기</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {todos.map(t => (
             <div key={t.id} className="flex items-center gap-6 p-8 bg-white border border-gray-100 rounded-[40px] hover:shadow-xl transition-all group">
                <input type="checkbox" checked={t.completed} onChange={() => setTodos(prev => prev.map(item => item.id === t.id ? {...item, completed: !item.completed} : item))} className="w-10 h-10 rounded-full accent-blue-600 cursor-pointer" />
                <div className="flex-1"><p className={`text-xl font-black ${t.completed ? 'text-gray-200 line-through' : 'text-gray-700'}`}>{t.text}</p><p className="text-[11px] font-black text-gray-300 mt-2 italic tracking-widest uppercase">{t.startDate} ~ {t.endDate}</p></div>
                <button onClick={() => setTodos(prev => prev.filter(item => item.id !== t.id))} className="text-gray-100 group-hover:text-red-400 transition-colors font-black text-3xl">✕</button>
             </div>
           ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto pb-32 space-y-8 px-8">
      {dbSaveError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900 text-sm">DB에 저장되지 않고 이 기기 브라우저에만 저장됩니다.</p>
            <p className="text-amber-800 text-xs mt-1">새로고침하면 보이지만, 다른 기기나 캐시 삭제 시 사라집니다. Supabase SQL Editor에서 supabase-setup-4단계-매출관리.sql 실행 후 이메일+비밀번호로 다시 로그인해 주세요.</p>
          </div>
          <button type="button" onClick={() => setDbSaveError(null)} className="text-amber-600 hover:text-amber-900 text-xl font-black shrink-0">×</button>
        </div>
      )}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-[40px] shadow-2xl border border-white/50 flex justify-between items-center sticky top-24 z-[45] transition-all">
        <div className="flex gap-3">
          {[
            { id: 'dashboard', label: '대시보드' },
            { id: 'todo', label: '작업 일정 (TO-DO)' },
            { id: 'project', label: '프로젝트 등록' },
            { id: 'data', label: '현황 관리' },
            { id: 'profit', label: '수익 관리' }
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); if(tab.id !== 'project') setEditingProjectId(null); }} className={`px-10 py-4 rounded-[28px] text-[13px] font-black transition-all tracking-widest italic ${activeTab === tab.id ? 'bg-black text-white shadow-2xl' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>{tab.label}</button>
          ))}
        </div>
        <button onClick={() => { setShowCompanyModal(true); setEditingCompanyId(null); setNewCompany({ name: '', openingDate: '', type: '개인사업자', taxBusinessNames: [] }); }} className="bg-blue-600 text-white px-10 py-4 rounded-[28px] font-black text-[13px] hover:bg-black transition-all shadow-xl shadow-blue-100 italic tracking-widest uppercase">내 회사 관리</button>
      </div>

      <main className="min-h-screen">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'todo' && renderTodoTab()}
        {activeTab === 'project' && renderProjectForm()}
        {activeTab === 'data' && renderDataList()}
        {activeTab === 'profit' && renderProfitTab()}
      </main>

      {showCompanyModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[64px] p-16 shadow-2xl space-y-12 animate-in zoom-in-95 relative overflow-y-auto max-h-[90vh] no-scrollbar border-4 border-blue-50">
            <button onClick={() => setShowCompanyModal(false)} className="absolute top-12 right-12 text-gray-300 hover:text-gray-900 text-3xl font-black">✕</button>
            <div className="flex items-center gap-6"><span className="text-5xl">🏢</span><h3 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-blue-500 underline-offset-8">내 회사 관리</h3></div>
            <div className="space-y-6">
               <label className="text-[11px] font-black text-gray-400 px-4 uppercase tracking-[0.4em] italic block">등록된 운영사 목록</label>
               <div className="grid grid-cols-1 gap-4">
                 {companies.map(c => (
                   <div key={c.id} className="bg-gray-50 p-8 rounded-[40px] flex justify-between items-center group hover:bg-blue-50 transition-all border-2 border-transparent hover:border-blue-200">
                      <div><p className="font-black text-gray-900 text-xl italic">{c.name}</p><p className="text-[11px] font-bold text-blue-400 mt-1 uppercase tracking-widest italic">{c.type} / 개업일: {c.openingDate}</p></div>
                      <div className="flex gap-3"><button onClick={() => startEditCompany(c)} className="w-12 h-12 bg-white text-orange-400 rounded-2xl shadow-sm flex items-center justify-center text-xl hover:bg-orange-50 transition-colors">✏️</button><button onClick={() => setCompanies(prev => prev.filter(item => item.id !== c.id))} className="w-12 h-12 bg-white text-red-300 rounded-2xl shadow-sm flex items-center justify-center text-xl hover:bg-red-50 transition-colors">✕</button></div>
                   </div>
                 ))}
               </div>
            </div>
            <div className="pt-16 border-t border-gray-100 space-y-10">
               <h4 className="text-blue-600 font-black text-lg italic tracking-tighter uppercase underline decoration-blue-100 underline-offset-4">{editingCompanyId ? '운영사 정보 수정' : '새 운영사 정보 등록'}</h4>
               <div className="space-y-6">
                  <input value={newCompany.name || ''} onChange={e => setNewCompany({...newCompany, name: e.target.value})} placeholder="회사명(운영사명) 입력" className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-lg outline-none shadow-inner" />
                  <div className="grid grid-cols-2 gap-6">
                     <input type="date" value={newCompany.openingDate || ''} onChange={e => setNewCompany({...newCompany, openingDate: e.target.value})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black outline-none shadow-inner" />
                     <select value={newCompany.type || '개인사업자'} onChange={e => setNewCompany({...newCompany, type: e.target.value as any})} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black outline-none shadow-inner"><option>개인사업자</option><option>법인사업자</option><option>기타</option></select>
                  </div>
               </div>
               <button onClick={handleCompanySubmit} className="w-full py-8 bg-black text-white rounded-[40px] font-black text-2xl shadow-2xl hover:bg-blue-600 transition-all italic uppercase tracking-[0.2em]">{editingCompanyId ? '수정 완료' : '신규 운영사 등록 완료'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function startEditCompany(c: OperatingCompany) {
    setNewCompany({ ...c });
    setEditingCompanyId(c.id);
  }
};

export default RevenueManagement;
