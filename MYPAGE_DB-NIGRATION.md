# 마이페이지 DB 저장 전체 계획

마이페이지 **구매자대시보드 / 판매자워크페이스 / 프리랜서워크페이스**의 모든 목록·내역·결제정보·작업진행정보를 DB에 저장하기 위한 상세 계획입니다.

---

## 실행 순서

1. `supabase-setup-1단계.sql` 실행
2. `supabase-setup-2단계-어드민.sql` 실행
3. **`supabase-setup-3단계-마이페이지.sql`** 실행

---

## 1. 구매자 대시보드

| 하위 탭 | 표시 내용 | 현재 저장소 | DB 테이블 |
|--------|----------|------------|-----------|
| **SNS활성화내역** | SNS 주문 전체 | smmOrders (localStorage) | `smm_orders` |
| **채널구매내역** | 채널 주문 전체 | channelOrders (localStorage) | `channel_orders` |
| **N잡스토어내역** | 스토어 주문 전체 | storeOrders (localStorage) | `store_orders` |
| **구매확정/리뷰/다운로드** | 구매자별 플래그 | confirmed_ids_v4, reviewed_ids_v4, download_start_times_v1 (localStorage) | `order_buyer_flags` |

### order_buyer_flags (3단계 신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| order_id | TEXT | smm_order / channel_order / store_order의 id |
| user_id | TEXT | 구매자 userId |
| order_type | TEXT | sns \| channel \| store |
| confirmed_at | TIMESTAMPTZ | 구매확정 시각 |
| reviewed_at | TIMESTAMPTZ | 리뷰 작성 시각 |
| download_started_at | TIMESTAMPTZ | N잡 다운로드 시작 시각 (90일 제한용) |

### 코드 연동 위치

- **BuyerDashboard.tsx**: `confirmedList`, `reviewedList`, `downloadStarts` → Supabase `order_buyer_flags` CRUD

---

## 2. 판매자 워크페이스

| 하위 탭 | 표시 내용 | 현재 저장소 | DB 테이블 |
|--------|----------|------------|-----------|
| **실시간판매현황** | 내 N잡 판매 주문 | storeOrders (localStorage) | `store_orders` |
| **내판매상품관리** | 내 ebook/서비스 | ebooks (localStorage) | `store_products` |
| **광고노출신청** | (준비중) | - | - |
| **수익관리** | 수익·정산 통계 | storeOrders + withdrawalHistory | `store_orders` + `seller_withdrawal_batches` |
| **만족도** | 내 상품 리뷰 | reviews (localStorage) | `reviews` |
| **출금신청히스토리** | 출금 신청 목록 | withdrawal_history_v21_{userId} (localStorage) | `seller_withdrawal_batches` |
| **월별수수료매출증빙** | 월별 매출/수수료 | storeOrders에서 계산 | `store_orders` (confirmed_at 기준) |

### seller_withdrawal_batches (3단계 신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK (예: W-{timestamp}) |
| user_id | TEXT | 판매자 userId |
| confirmed_date | TEXT | 확정 일시 (표시용) |
| amount | INTEGER | 실지급 순수익 |
| gross_amount | INTEGER | 판매 금액 합계 |
| status | TEXT | 지급 예정 \| 지급 완료 |
| order_ids | JSONB | 해당 주문 id 목록 |
| product_name | TEXT | 대표 상품명 (표시용) |
| created_at | TIMESTAMPTZ | 생성 시각 |

### store_orders 보완 (2단계 이미 포함)

| 컬럼 | 용도 |
|------|------|
| confirmed_at | 구매확정 일시 |
| downloaded_at | 다운로드 완료 |
| buyer_tax_info | 세금계산서 정보 |
| review_id | 연결된 리뷰 id |

### 코드 연동 위치

- **SellerDashboard.tsx**: storeOrders, ebooks, reviews → Supabase에서 로드
- **ProfitManagement.tsx**: `withdrawalHistory` → `seller_withdrawal_batches` CRUD

---

## 3. 프리랜서 워크페이스

| 하위 탭 | 표시 내용 | 현재 저장소 | DB 테이블 |
|--------|----------|------------|-----------|
| **작업내역** | 참여한 알바 작업 | parttime_tasks (localStorage) | `parttime_tasks` |
| **정산내역** | 수익통장 잔액·입금·출금 | freelancer_balance, freelancer_history, withdraw_requests (localStorage) | `freelancer_balances`, `freelancer_earnings_history`, `freelancer_withdraw_requests` |
| **알바의뢰(광고주전용)** | 내 알바의뢰 신청 | job_requests (localStorage) | `parttime_job_requests` |

### 2단계 테이블 (이미 정의됨)

- `parttime_tasks`: applicants, sections, point_paid, paid_user_ids 등 전체
- `parttime_job_requests`: applicant_user_id, operator_estimate, status 등 전체
- `freelancer_balances`, `freelancer_earnings_history`, `freelancer_withdraw_requests`

### 코드 연동 위치

- **FreelancerDashboard.tsx**: constants의 `getPartTimeTasks`, `getFreelancerBalance`, `getFreelancerHistory`, `getPartTimeJobRequests` 등 → Supabase 호출로 교체
- **constants.tsx**: localStorage 기반 함수 → Supabase 클라이언트 호출

---

## 4. 공통 주문 테이블 (2단계)

| 테이블 | 저장 대상 |
|--------|----------|
| `smm_orders` | order_time, platform, product_name, link, quantity, initial_count, remains, status, 결제정보 등 |
| `channel_orders` | order_time, product_id, product_name, platform, price, status, payment_id, payment_method 등 |
| `store_orders` | order_time, product_id, product_name, tier_name, price, status, confirmed_at, downloaded_at, buyer_tax_info, review_id 등 |

---

## 5. 마이그레이션 체크리스트

### DB 설정
- [ ] supabase-setup-1단계.sql 실행
- [ ] supabase-setup-2단계-어드민.sql 실행
- [ ] supabase-setup-3단계-마이페이지.sql 실행

### 구매자 연동
- [ ] BuyerDashboard: order_buyer_flags 로드/저장
- [ ] App: smm_orders, channel_orders, store_orders Supabase 로드/저장

### 판매자 연동
- [ ] SellerDashboard: store_orders, store_products, reviews Supabase 사용
- [ ] ProfitManagement: seller_withdrawal_batches 로드/저장

### 프리랜서 연동
- [ ] constants: getPartTimeTasks, setPartTimeTasks → Supabase
- [ ] constants: getFreelancerBalance, addFreelancerEarning, getFreelancerHistory → Supabase
- [ ] constants: getFreelancerWithdrawRequests, addFreelancerWithdrawRequest → Supabase
- [ ] constants: getPartTimeJobRequests, setPartTimeJobRequests → Supabase
- [ ] FreelancerDashboard: 위 함수들 Supabase 버전 사용
