# 매출관리 페이지 DB 저장 계획

매출관리 페이지의 **대시보드 / 작업일정 / 프로젝트등록 / 현황관리 / 수익관리** 모든 데이터를 DB에 저장하기 위한 상세 계획입니다.

---

## 실행 순서

1. `supabase-setup-1단계.sql`
2. `supabase-setup-2단계-어드민.sql`
3. `supabase-setup-3단계-마이페이지.sql`
4. **`supabase-setup-4단계-매출관리.sql`**

---

## 탭별 데이터 매핑

| 탭 | 표시 내용 | 현재 localStorage | DB 테이블 |
|----|----------|------------------|-----------|
| **대시보드** | 달력(작업일정+to-do), 통합비즈니스실적, 운영사별 현황 | rev_projects, rev_todos, rev_companies | `revenue_projects`, `revenue_todos`, `revenue_operating_companies` |
| **작업일정 (TO-DO)** | 할 일 목록, 신규 추가, 완료 체크 | rev_todos | `revenue_todos` |
| **프로젝트 등록** | 신규/수정 프로젝트 폼 | rev_projects, rev_companies | `revenue_projects`, `revenue_operating_companies` |
| **현황 관리** | 차수/작업종류/업체명/운영사/마감일/금액/관리(재연장/수정/삭제) | rev_projects | `revenue_projects` |
| **수익 관리** | 당월 수입(프로젝트), 당월 지출(비용), 월별 정산 요약 | rev_projects, rev_general_expenses | `revenue_projects`, `revenue_general_expenses` |

---

## 1. 대시보드

### 저장 데이터
- **달력**: `revenue_projects`(start_date, end_date, clientName), `revenue_todos`(startDate~endDate, text, completed)
- **통합 비즈니스 실적**: 현재월 projects/expenses 집계 (테이블에서 계산)
- **운영사 카드**: `revenue_operating_companies` + 해당 운영사 프로젝트 집계

### 테이블: revenue_operating_companies

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| user_id | TEXT | (선택) 다중 사용자 지원 |
| name | TEXT | 회사명(운영사명) |
| opening_date | TEXT | 개업일 |
| type | TEXT | 개인사업자 \| 법인사업자 \| 기타 |
| tax_business_names | JSONB | 세금계산서 발행 사업자명 목록 |
| created_at | TIMESTAMPTZ | 생성 시각 |

---

## 2. 작업일정 (TO-DO)

### 저장 데이터
- 할 일 내용(text), 시작일(start_date), 종료일(end_date), 완료여부(completed)

### 테이블: revenue_todos

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| user_id | TEXT | (선택) |
| text | TEXT | 할 일 내용 |
| start_date | TEXT | YYYY-MM-DD |
| end_date | TEXT | YYYY-MM-DD |
| completed | BOOLEAN | 완료 체크 |
| created_at | TIMESTAMPTZ | 생성 시각 |

---

## 3. 신규 프로젝트 / 현황 관리

### 저장 데이터
- 차수, 작업종류, 업체명, 브랜드/카페명, 작업페이지링크
- 결제금액, 실제정산금, 세금계산서, 계약방식, 진행차수
- 기간/마감설정(시작일, 마감유형, 소요일수, 고정일, 특정일)
- 운영사 연결

### 테이블: revenue_projects

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| user_id | TEXT | (선택) |
| operating_company_id | TEXT | FK → revenue_operating_companies |
| type | TEXT | 카페관리 \| 블로그대행 \| 블로그체험단 \| 유튜브 \| 인스타그램 \| 기타작업 |
| client_name | TEXT | 업체명 |
| cafe_name | TEXT | 브랜드/카페명 |
| work_link | TEXT | 작업 페이지 링크 |
| payment_amount | INTEGER | 결제금액(원) |
| settlement_amount | INTEGER | 실제 정산금(원) |
| tax_invoice | TEXT | 발행 \| 미발행 |
| channel | TEXT | 크몽 \| 직거래 \| 숨고 \| 쇼핑몰 \| 키플랫 \| 기타 |
| round | INTEGER | 진행 차수 |
| start_date | TEXT | 시작일 |
| end_date | TEXT | 마감일 |
| status | TEXT | 진행중 \| 완료 |
| deadline_type | TEXT | weekday \| fixed \| specific |
| duration | INTEGER | 평일 기준 소요일수 |
| fixed_day | INTEGER | 고정일 마감 시 일(예: 25) |
| created_at | TEXT | 생성 시각(ISO) |

---

## 4. 수익 관리 (비용)

### 저장 데이터
- **수입**: revenue_projects에서 당월 payment_amount 합산
- **지출**: 날짜, 항목(카테고리), 상세설명, 금액

### 테이블: revenue_general_expenses

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| user_id | TEXT | (선택) |
| date | TEXT | YYYY-MM-DD |
| category | TEXT | 운영비 \| 인건비 \| 식비 \| 집기구입비 \| 구독비 \| 기타비용 |
| note | TEXT | 지출 상세 설명 |
| amount | INTEGER | 금액(원) |
| created_at | TIMESTAMPTZ | 생성 시각 |

---

## 5. 코드 연동 체크리스트

### RevenueManagement.tsx

- [ ] `companies` → Supabase `revenue_operating_companies` CRUD
- [ ] `projects` → Supabase `revenue_projects` CRUD
- [ ] `todos` → Supabase `revenue_todos` CRUD
- [ ] `generalExpenses` → Supabase `revenue_general_expenses` CRUD

### 로드 시점
- 페이지 마운트 시 Supabase에서 select
- user_id가 있으면 해당 사용자 데이터만, 없으면 전체(또는 빈 배열)

### 저장 시점
- companies/projects/todos/generalExpenses 변경 시 Supabase upsert/insert/delete

---

## 6. localStorage 키 → DB 매핑

| localStorage 키 | DB 테이블 |
|----------------|-----------|
| rev_companies | revenue_operating_companies |
| rev_projects | revenue_projects |
| rev_todos | revenue_todos |
| rev_general_expenses | revenue_general_expenses |
