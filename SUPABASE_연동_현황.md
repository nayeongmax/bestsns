# Supabase 연동 현황

SQL로 테이블을 만든 뒤, **App·각 페이지의 localStorage 사용을 Supabase 호출로 바꾼 작업** 기준으로 정리했습니다.

---

## ⚠️ 배포 전 필수: 쿠키/캐시 삭제 시 상품이 사라져 보이는 문제 방지

**회원이 브라우저에서 쿠키·캐시(이미지 데이터)를 지우면** 로그인 세션이 사라져, Supabase는 요청을 **비로그인(anon)** 으로 처리합니다.  
기본 RLS가 "로그인한 사용자만 조회"라서 이때 **channel_products / store_products 조회가 막혀 빈 목록**만 내려오고, 화면에는 "NO PRODUCTS FOUND"처럼 보입니다.  
**데이터는 DB에 그대로 있지만**, 회원 입장에선 "내가 올린 상품이 삭제됐다"로 느껴져 **신뢰가 크게 떨어지는 심각한 문제**입니다.

**해결:** Supabase 대시보드 → SQL Editor에서 **`supabase-rls-public-read-channel-store.sql`** 스크립트를 **반드시 한 번 실행**해 주세요.  
- 상품 **목록 조회(SELECT)** 만 비로그인도 허용하고, 등록·수정·삭제는 기존처럼 로그인 사용자만 가능합니다.  
- 적용 후에는 로그인 여부·쿠키 삭제와 관계없이 상품 목록이 항상 DB에서 불러와져 정상 표시됩니다.

**상품을 올려도 Supabase 테이블이 비어 있을 때:**  
- RLS가 **등록(INSERT)·수정(UPDATE)·삭제(DELETE)** 도 막고 있기 때문입니다. 관리자 로그인은 Supabase 세션이 없어서 기존 정책(로그인만 허용)이면 저장이 거부됩니다.  
- **같은 파일** `supabase-rls-public-read-channel-store.sql` 에 **쓰기 정책(INSERT/UPDATE/DELETE)** 이 추가되어 있으므로, **SQL Editor에서 해당 스크립트를 다시 한 번 실행**해 주세요. (기존 조회 정책에 더해 쓰기 정책이 생성됩니다.)

**포인트·수익(돈)이 쿠키 삭제 후 0으로 바뀌는 문제:**  
- 로그인 시 **DB(profiles)** 에서 포인트·누적 구매/판매·프리랜서 수익을 불러와 덮어쓰고, **마이페이지 진입 시**에도 DB에서 다시 조회해 동기화합니다. 회원 목록 로드 후에도 DB 기준으로 user를 맞춥니다.  
- **`supabase-rls-public-all-site-data.sql`** 에 **profiles** 테이블에 대한 **SELECT·UPDATE** 정책이 포함되어 있으므로, 이 스크립트를 실행해야 충전·수익이 DB에 저장되고 삭제 후에도 유지됩니다.

**어드민에서 회원 목록이 전체가 안 나오는 문제:**  
- 회원 목록은 Supabase **profiles**에서 불러옵니다. RLS가 로그인 사용자만 허용하면 관리자(세션 없음)일 때 빈 목록이 됩니다.  
- 위와 동일하게 **`supabase-rls-public-all-site-data.sql`** 실행 후, 어드민에서 **「회원 및 권한 관리」** 탭을 열면 **profiles를 다시 조회**해 전체 회원이 나오도록 했습니다.

**AI 상담 이력·통계가 안 나오는 문제:**  
- **ai_consult_sessions**, **ai_consult_messages** 테이블도 RLS가 authenticated만 허용하면 관리자(anon)일 때 조회가 막혀 통계가 비어 보입니다.  
- **`supabase-rls-public-all-site-data.sql`** 에 AI 상담 테이블에 대한 **SELECT·INSERT·UPDATE** 정책이 추가되어 있습니다. (6단계 AI컨설팅 SQL 실행으로 테이블이 있어야 합니다.)

**RLS 적용했는데도 상품이 비어 보일 때:**  
1. **배포 환경(Netlify 등)에 env 설정**  
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 가 **실제 사용하는 Supabase 프로젝트** 값으로 설정되어 있어야 합니다.  
   - 설정이 없으면 요청이 placeholder URL로 가서 실패하고, 화면에는 빈 목록만 나옵니다.  
2. **브라우저 개발자도구 → Network**  
   - 쿠키 삭제 후 새로고침하고, `rest/v1/channel_products` 또는 `rest/v1/store_products` 요청이 **본인 Supabase URL**로 나가는지, 응답이 **200**인지 확인하세요.  
3. **Supabase 대시보드 → Table Editor**  
   - `channel_products` / `store_products` 테이블에 행이 실제로 있는지 확인하세요.

---

## ✅ 전반적으로 Supabase 연동된 것 (로드·저장 모두 DB)

| 데이터 | 테이블 | App/페이지 동작 |
|--------|--------|------------------|
| N잡스토어 상품 | store_products | App 마운트 시 fetch, 변경 시 upsert. localStorage는 **초기값·백업**만 |
| N잡스토어 주문 | store_orders | 위와 동일 |
| 리뷰 | reviews | 위와 동일 |
| 채널 상품 | channel_products | 위와 동일 |
| 채널 주문 | channel_orders | 위와 동일 |
| SNS활성화 주문 | smm_orders | 위와 동일 |
| SNS 공급처/상품 | smm_providers, smm_products | 위와 동일 |
| 게시글·댓글 | site_posts, site_post_comments | App에서 fetch/upsert (siteDb). localStorage 백업 |
| 공지 | site_notices | 위와 동일 |
| 등급 설정 | grade_configs | 위와 동일 |
| 회원 목록 | profiles | App 마운트 시 한 번 select. 회원가입·어드민 수정·포인트/쿠폰/프로필 변경 시 updateProfile 등으로 DB 반영 |
| 알림 | site_notifications | 로그인 시 select, 추가 시 insert, 읽음 시 update |
| 찜 | user_wishlist | 로그인 시 select, 추가/삭제 시 upsert/delete |
| 채팅 메시지 | chat_messages | 전송 시 insert |
| 누구나알바 작업/의뢰/잔액/출금 등 | parttime_*, freelancer_* | 해당 페이지에서 parttimeDb로 fetch/upsert (App 상태 아님) |
| 알바의뢰 결제(paid) | parttime_job_requests | AlbaPaymentPage에서 upsertPartTimeJobRequest 호출 |

**정리:** 위 항목들은 **데이터 소스가 Supabase**이고, localStorage는 앱 초기 로딩·백업용으로만 쓰입니다. env 설정하면 DB에 저장·로드됩니다.

---

## ✅ 추가 연동 완료 (매출·쿠폰캠페인·채팅방 메타)

| 데이터 | SQL 테이블 | 연동 내용 |
|--------|------------|-----------|
| 매출관리 (회사/프로젝트/할일/경비) | revenue_operating_companies, revenue_projects, revenue_todos, revenue_general_expenses (4단계) | **revenueDb.ts** 추가. RevenueManagement에 user 전달, 마운트 시 fetch, 변경 시 upsert. localStorage 백업 유지. |
| 쿠폰·마케팅 캠페인 목록 | coupon_campaigns (2단계) | **campaignDb.ts** 추가. MarketingAdmin 마운트 시 fetchCouponCampaigns, 변경 시 upsertCouponCampaigns, 삭제 시 deleteCouponCampaign. localStorage 백업 유지. |
| 채팅방 메모/거래중/즐겨찾기 | chat_room_meta (1단계) | **chatRoomMetaDb.ts** 추가. ChatPage loadRooms 시 fetchChatRoomMeta, setMeta 시 upsertChatRoomMeta. localStorage 백업 유지. |

---

## 🔹 localStorage만 쓰는 작은 것들 (DB 테이블 없거나 보조용)

- **AuthPage** – 로그인 ID 저장 (SAVED_LOGIN_ID_KEY): 편의용, DB 불필요
- **UserInfoSection** – 알림 설정(마케팅/SMS 등) on/off: 사용자별 설정, 테이블 없음
- **SnsAdmin** – 마지막 동기화 시간 표시 (smm_last_sync_full): UI용
- **ReviewWritePage** – “이미 리뷰 쓴 주문” ID 목록 (reviewed_orders): 중복 방지용. order_buyer_flags.reviewed_at 으로 대체 가능하나 현재는 localStorage
- **PartTimeTaskDetail** – “오늘/이틀 전 안내 봤음” 플래그: UI 1회 안내용
- **ChatPage** – violation 카운트 임시 저장, 채팅방 목록 fallback: 일부는 profiles.violation_count, user_violations와 연동 가능

---

## ✅ 전체 데이터가 쿠키/캐시 삭제 후에도 유지되도록 (RLS 2개 스크립트)

**지금처럼 모든 DB가 남고, "삭제되는 현상"이 없으려면** 다음 두 스크립트를 **모두** Supabase SQL Editor에서 실행해야 합니다.

| 스크립트 | 대상 | 적용 후 |
|----------|------|----------|
| **supabase-rls-public-read-channel-store.sql** | channel_products, store_products | 채널·스토어 상품 등록/목록이 쿠키 삭제 후에도 유지 |
| **supabase-rls-public-all-site-data.sql** | store_orders, channel_orders, reviews, smm_*, grade_configs, site_notices, site_posts, site_post_comments, coupon_campaigns | 주문·리뷰·공지·게시글·SNS활성화·쿠폰캠페인 등 **사이트 전체 공개 데이터**가 쿠키 삭제 후에도 그대로 노출 |

- 두 스크립트 모두 **Run** 해 두면, 로그인 여부·쿠키/캐시 삭제와 관계없이 **등록한 정보가 DB에 저장되고, 화면에도 유지**됩니다.
- 회원 목록(profiles)이 쿠키 삭제 후 비어 보이면, Supabase에서 `profiles` 테이블에 RLS가 켜져 있는지 확인한 뒤, 필요 시 동일한 방식으로 SELECT 정책을 추가하면 됩니다.

---

## 결론

- **핵심 비즈니스 데이터**와 **매출관리·쿠폰캠페인·채팅방 메타**까지 모두 **Supabase 연동 완료**되었습니다. 로드·저장이 DB 기준으로 동작하며, localStorage는 초기값·백업용으로만 사용합니다.
- **전반적으로 연동이 완료된 상태**이며, 새 7단계 SQL 없이 기존 1·2·4단계 테이블만 사용했습니다.
- **데이터가 “사라지는” 현상 방지**를 위해 위 두 RLS 스크립트 적용을 권장합니다.
