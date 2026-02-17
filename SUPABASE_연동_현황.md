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

## 결론

- **핵심 비즈니스 데이터**와 **매출관리·쿠폰캠페인·채팅방 메타**까지 모두 **Supabase 연동 완료**되었습니다. 로드·저장이 DB 기준으로 동작하며, localStorage는 초기값·백업용으로만 사용합니다.
- **전반적으로 연동이 완료된 상태**이며, 새 7단계 SQL 없이 기존 1·2·4단계 테이블만 사용했습니다.
