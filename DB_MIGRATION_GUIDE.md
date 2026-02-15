# DB 저장소 마이그레이션 가이드

현재 앱은 **localStorage**에 데이터를 저장합니다. 브라우저 캐시를 지우면 데이터가 사라집니다.  
**Supabase DB**로 옮기면 데이터가 영구 보존됩니다.

---

## 1. 사전 준비

- Supabase 프로젝트가 있고 `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 설정되어 있어야 합니다.
- 로그인(인증)은 이미 Supabase를 사용 중입니다.

---

## 2. Supabase 테이블 생성

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** → **New query**
3. `supabase-parttime-setup.sql` 파일 내용 전체를 붙여넣고 **Run** 실행

이렇게 생성되는 테이블:
- `parttime_tasks` – 누구나알바 작업 목록
- `parttime_job_requests` – 알바의뢰
- `freelancer_balances` – 프리랜서 수익통장 잔액
- `freelancer_earnings_history` – 수익 적립 내역
- `freelancer_withdraw_requests` – 출금 신청

---

## 3. 코드 변경 흐름 (요약)

`constants.tsx`의 `getPartTimeTasks`, `setPartTimeTasks` 등을 Supabase 호출로 바꿉니다.

**예시 (작업 목록):**

```typescript
// 기존 (localStorage)
export function getPartTimeTasks(): PartTimeTask[] {
  const raw = localStorage.getItem(PARTTIME_TASKS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// 변경 (Supabase)
import { supabase } from '@/supabase';

export async function getPartTimeTasks(): Promise<PartTimeTask[]> {
  const { data, error } = await supabase.from('parttime_tasks').select('*');
  if (error) return [];
  return (data || []).map(rowToTask);
}

function rowToTask(row: any): PartTimeTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    reward: row.reward,
    sections: row.sections || {},
    applicationPeriod: { start: row.application_period_start, end: row.application_period_end },
    workPeriod: { start: row.work_period_start, end: row.work_period_end },
    applicants: row.applicants || [],
    pointPaid: row.point_paid ?? false,
    paidUserIds: row.paid_user_ids || [],
    createdAt: row.created_at,
    createdBy: row.created_by,
    applicantUserId: row.applicant_user_id,
    jobRequestId: row.job_request_id,
    projectNo: row.project_no,
    sentToAdvertiserAt: row.sent_to_advertiser_at,
  };
}
```

`setPartTimeTasks`도 `upsert`로 Supabase에 저장하도록 변경합니다.

---

## 4. 단계별 마이그레이션 순서

| 순서 | 대상 | 파일 | 함수 |
|------|------|------|------|
| 1 | 누구나알바 작업 | constants.tsx | getPartTimeTasks, setPartTimeTasks |
| 2 | 알바의뢰 | constants.tsx | getPartTimeJobRequests, setPartTimeJobRequests |
| 3 | 프리랜서 잔액·내역 | constants.tsx | getFreelancerBalance, addFreelancerEarning, getFreelancerHistory |
| 4 | 출금 신청 | constants.tsx | getFreelancerWithdrawRequests, updateFreelancerWithdrawRequestStatus |
| 5 | App 전체 데이터 | App.tsx | members, ebooks, channels 등 → 각각 Supabase 테이블 필요 |

---

## 5. 비동기 처리

DB 사용 시 대부분 **async/await**가 필요합니다.

- `getPartTimeTasks()` → `getPartTimeTasks()`가 Promise 반환
- 컴포넌트에서 `useState` + `useEffect`로 초기 로드

```typescript
const [tasks, setTasks] = useState<PartTimeTask[]>([]);
useEffect(() => {
  getPartTimeTasks().then(setTasks);
}, []);
```

---

## 6. 기존 localStorage 데이터 이전 (선택)

이미 쌓인 데이터가 있다면, 마이그레이션 직전에 한 번만 localStorage에서 읽어 DB에 넣는 스크립트를 만들 수 있습니다.

```typescript
// 한 번만 실행 (콘솔 또는 임시 페이지)
const oldTasks = JSON.parse(localStorage.getItem('parttime_tasks_v1') || '[]');
for (const t of oldTasks) {
  await supabase.from('parttime_tasks').upsert(taskToRow(t));
}
```

---

## 7. 진행 방식 제안

1. **1단계:** `supabase-parttime-setup.sql` 실행으로 테이블만 먼저 생성
2. **2단계:** `parttime_tasks`만 DB로 옮기고, 나머지는 localStorage 유지
3. **3단계:** 잘 동작하면 다른 데이터도 순서대로 DB로 이전

전체 마이그레이션은 규모가 커서, 위 순서대로 단계별로 진행하는 것을 권장합니다.
