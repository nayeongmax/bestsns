# N잡스토어 · 구매자/판매자 워크페이스 DB 연동

## 적용된 DB 테이블 (Supabase)

- **store_products** – N잡 상품(전자책·마케팅·강의 등): 제목, 카테고리, 가격, 티어, 설명, FAQ, 이미지, 상태, 반려사유, 스냅샷 등
- **store_orders** – 주문: 구매자/판매자, 결제·구매확정·다운로드·리뷰 ID
- **reviews** – 리뷰: 평점, 내용, 답글, 날짜
- **order_buyer_flags** – 구매자별 주문 플래그: 구매확정 시각, 리뷰 완료 시각, 다운로드 시작 시각
- **seller_withdrawal_batches** – 판매자 출금 신청: 확정일, 금액, 주문 ID 목록, 상태(지급 예정/완료)

## SQL 적용 순서

1. **supabase-setup-2단계-어드민.sql** – store_products, store_orders, reviews
2. **supabase-setup-3단계-마이페이지.sql** – order_buyer_flags, seller_withdrawal_batches, store_orders 컬럼 보완

## 코드 연동 요약

| 대상 | 내용 |
|------|------|
| **App** | 마운트 시 store_products / store_orders / reviews Supabase 로드 → ebooks, storeOrders, reviews 상태 설정. 상태 변경 시 upsert로 DB 저장. |
| **N잡 스토어 페이지** | ebooks(상품)·storeOrders·reviews는 App 상태 = DB 기준으로 표시. 등록·수정·삭제는 setEbooks/setStoreOrders/setReviews → 자동 DB 반영. |
| **구매자 워크페이스** (BuyerDashboard) | 구매확정·리뷰완료·다운로드시작 → order_buyer_flags 에 저장/조회. |
| **판매자 워크페이스** | 상품·주문·리뷰는 App(DB) 사용. 수익 관리(ProfitManagement) 출금 신청 → seller_withdrawal_batches 저장/조회. |

## API 모듈 (`storeDb.ts`)

- **상품**: `fetchStoreProducts`, `upsertStoreProduct`, `upsertStoreProducts`, `deleteStoreProduct`
- **주문**: `fetchStoreOrders`, `upsertStoreOrder`, `upsertStoreOrders`
- **리뷰**: `fetchReviews`, `upsertReview`, `upsertReviews`
- **구매자 플래그**: `fetchOrderBuyerFlags`, `upsertOrderBuyerFlag`
- **판매자 출금**: `fetchSellerWithdrawalBatches`, `addSellerWithdrawalBatch`

상품 등록(EbookRegistration), 어드민(StoreAdmin), 결제(PointPayment), 상세(EbookDetail), 리뷰 작성 등은 기존처럼 App의 setEbooks/setStoreOrders/setReviews 를 사용하며, 변경분은 위 흐름으로 DB에 저장됩니다.
