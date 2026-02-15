# 어드민 패널 DB 저장 가이드

어드민 패널의 **모든 탭, 모든 목록, 모든 정보**를 Supabase에 저장하기 위한 설정입니다.

---

## 실행 순서

1. **1단계** → `supabase-setup-1단계.sql` 실행 (profiles, site_access_log, site_notifications, chat_messages)
2. **2단계** → `supabase-setup-2단계-어드민.sql` 실행

---

## 2단계 생성 테이블 매핑

| 어드민 탭 | 서브 탭 | 테이블명 | 저장 데이터 |
|----------|---------|----------|-------------|
| **SNS 활성화 관리** | 공급처 시스템 설정 | `smm_providers` | id, name, api_url, is_hidden |
| | 마스터 상품 등록 | `smm_products` | 상품명, 플랫폼, 카테고리, sources(공급처 연동) |
| | 통합 상품 인벤토리 | `smm_products` | 동일 |
| | 주문 성과 분석 | `smm_orders` | 주문 전체 (주문시간, 수익, 상태 등) |
| **채널 거래 관리** | 채널 인벤토리 관리 | `channel_products` | 채널 전체 (썸네일, 가격, 판매자 등) |
| | 채널 거래 계약 현황 | `channel_orders` | 주문 전체 |
| **N잡 스토어 관리** | 인벤토리 마스터 | `store_products` | 전자책/상품 전체 (tiers, faqs, attached_images) |
| | 심사 대기함 | `store_products` | status=pending/revision, rejection_reason, snapshot |
| | 전체 판매 기록 | `store_orders` | 주문 전체 |
| **회원 및 권한** | 전체 회원 데이터 | `profiles` | 1단계에 있음 |
| | 판매자 승인 대기 | `profiles` | seller_status, pending_application |
| | 프리랜서 승인 대기 | `profiles` | freelancer_status, freelancer_application |
| | 등급 관리 | `grade_configs` | 등급명, min_sales, min_purchase, color, sort_order |
| | (리뷰) | `reviews` | 상품 리뷰, 답글 |
| **마케팅 캠페인** | 쿠폰/캠페인 관제 | `coupon_campaigns` | 운영 중 캠페인, 쿠폰 발행 이력 |
| | 운영 중인 캠페인 | `coupon_campaigns` | is_active=true |
| | 쿠폰 발행 이력 | `coupon_campaigns` | is_active=false (수동 발행 완료) |
| **누구나알바** | 견적 진행 | `parttime_job_requests` | operator_estimate(견적서), example_images |
| | 프리랜서 모집 | `parttime_tasks` | sections(작업지시), applicants(신청자, workLinks, revisionRequest 등) |
| | 수익 탭 | `freelancer_balances`, `freelancer_earnings_history`, `freelancer_withdraw_requests` | 잔액, 적립 내역, 출금 신청 |

---

## 세부 JSON 필드 (모두 저장됨)

### parttime_tasks.applicants
- userId, nickname, comment, selected, appliedAt, contact
- **workLink**, **workLinks** (작업 링크 제출)
- **revisionRequest** (수정 요청 내용)
- deliveryAt, autoApproveAt, workLinkSubmittedAt, selectedAt, advertiserConfirmedAt, reApprovalRequestedAt

### parttime_tasks.sections
- 제목, 내용, 댓글, 키워드, 이미지, 동영상, gif
- 게시글목록, 댓글목록, 이미지목록, 작업링크목록, 작업안내
- sectionOrder

### parttime_job_requests.operator_estimate
- totalAmount, fee, note, sentAt, recipientName, recipientContact, workPeriod, workName
- **items**: [{ seq, content, unitPrice, quantity, amount, remarks }] (견적 항목)

### store_products
- **tiers**: [{ name, price, description, pageCount, pdfFile }]
- **faqs**: [{ question, answer }]
- **snapshot**: 반려 시점 전체 데이터 (재심사 비교용)

---

## 다음 단계 (코드 연동)

테이블 생성 후, `App.tsx` 및 각 Admin 컴포넌트에서 localStorage 대신 Supabase를 사용하도록 수정해야 합니다.

- `smmProviders` → `smm_providers` select/upsert
- `smmProducts` → `smm_products` select/upsert
- `smmOrders` → `smm_orders` select/upsert
- `channels` → `channel_products` select/upsert
- `channelOrders` → `channel_orders` select/upsert
- `ebooks` → `store_products` select/upsert
- `storeOrders` → `store_orders` select/upsert
- `gradeConfigs` → `grade_configs` select/upsert
- `reviews` → `reviews` select/upsert
- `auto_coupon_campaigns` (localStorage) → `coupon_campaigns` select/upsert
