# 누구나알바 / 프리랜서 워크페이스 DB 연동

## 적용된 DB 테이블 (Supabase)

- **parttime_tasks** – 작업 등록, 작업 목록, 캘린더 날짜별 작업, 신청자/선정/포인트 지급
- **parttime_job_requests** – 작업의뢰(광고주 신청), 견적, 승인/거절, 결제 여부
- **parttime_task_completed_checks** – 캘린더 “완료 체크” (user_id, task_id)
- **freelancer_balances** – 수익통장 잔액
- **freelancer_earnings_history** – 수익/출금 내역
- **freelancer_withdraw_requests** – 출금 신청, 입금 완료/실패 처리

## SQL 적용 순서

1. **supabase-setup-2단계-어드민.sql**  
   - 기존 parttime/freelancer 테이블 + **parttime_task_completed_checks** 포함  
   - 한 번만 실행하면 됨 (이미 2단계 실행했으면, 추가된 `parttime_task_completed_checks` 블록만 실행해도 됨)

## 코드 연동 요약

| 화면 | 변경 내용 |
|------|-----------|
| **누구나알바 페이지** (PartTimePage) | 작업 목록·캘린더 수치·완료 체크·수익통장 잔액 → Supabase에서 로드 |
| **작업 등록** (PartTimeTaskRegister) | 새 작업 생성 시 `upsertPartTimeTask()`로 DB 저장 |
| **작업의뢰** (PartTimeJobRequestPage) | 신청/수정/삭제 시 `upsertPartTimeJobRequest`, `deletePartTimeJobRequest` 사용 |
| **작업 상세** (PartTimeTaskDetail) | 작업/의뢰 목록 DB 로드, 선정·링크 제출·즉시 지급 시 DB 반영 |
| **마이페이지 프리랜서** (FreelancerDashboard) | 작업/의뢰/잔액/내역/출금 신청 전부 DB 연동 |
| **어드민 누구나알바** (PartTimeAdmin) | 견적·승인·거절·작업 선정·즉시 지급·출금 완료/실패 → DB 저장 |

## API 모듈 (`parttimeDb.ts`)

- `fetchPartTimeTasks`, `upsertPartTimeTask`, `upsertPartTimeTasks`, `deletePartTimeTask`
- `fetchPartTimeJobRequests`, `upsertPartTimeJobRequest`, `upsertPartTimeJobRequests`, `deletePartTimeJobRequest`
- `fetchFreelancerBalance`, `setFreelancerBalance`, `fetchFreelancerHistory`, `addFreelancerEarningToDb`
- `fetchFreelancerWithdrawRequests`, `addFreelancerWithdrawRequestToDb`, `updateFreelancerWithdrawRequestStatusToDb`
- `withdrawFreelancerEarningsInDb`, `refundFreelancerWithdrawalInDb`
- `fetchPartTimeCompletedIds`, `addPartTimeCompletedCheck`, `removePartTimeCompletedCheck`
- `processAutoApprovalsInDb` – 3일 경과 자동 승인(DB 기준)

기존 localStorage 기반 `constants.tsx`의 parttime/freelancer 함수는 **사용하지 않음** (다른 모듈에서만 쓰이는 상수/유틸은 그대로 둠).
