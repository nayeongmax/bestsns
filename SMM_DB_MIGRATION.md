# SNS활성화 · 결제/주문 내역 DB 연동

## 적용된 DB 테이블 (Supabase)

- **smm_orders** – SNS 활성화 주문(결제) 내역: 구매자, 주문시각, 플랫폼·상품명·링크·수량, 공급처·원가·판가·이익, 상태·외부주문ID
- **smm_providers** – 공급처: id, 이름, API URL, 숨김 여부
- **smm_products** – 마스터상품(통합인벤토리): id, 이름, 플랫폼·카테고리, 판매가·최소/최대수량, sources(JSONB), 숨김 여부

## SQL 적용

- **supabase-setup-2단계-어드민.sql** – `smm_orders`, `smm_providers`, `smm_products` 테이블 정의 포함

## 코드 연동 요약

| 대상 | 내용 |
|------|------|
| **App** | 마운트 시 `fetchSmmOrders` / `fetchSmmProviders` / `fetchSmmProducts` 로 주문·공급처·상품 로드 → smmOrders, smmProviders, smmProducts 상태 설정. 상태 변경 시 `upsertSmmOrders` / `upsertSmmProviders` / `upsertSmmProducts` 로 DB 저장. |
| **SNS활성화 페이지** | 회원이 주문(결제) 시 `onOrderComplete` → `setSmmOrders(prev => [o, ...prev])` → App 상태 반영 후 자동으로 **smm_orders** 에 저장. |
| **마이페이지 (BuyerDashboard)** | smmOrders는 App(DB)에서 내려받아 **구매 내역 · SNS 활성화** 탭에 표시. |
| **어드민 (SnsAdmin)** | 공급처·상품·주문 목록은 App(DB) 기준으로 표시·수정 시 DB 저장. |

## API 모듈 (`smmDb.ts`)

- **주문**: `fetchSmmOrders`, `upsertSmmOrder`, `upsertSmmOrders`
- **공급처**: `fetchSmmProviders`, `upsertSmmProviders`
- **상품**: `fetchSmmProducts`, `upsertSmmProducts`

SNS활성화 페이지에서 주문 완료 시 생성되는 주문, 어드민에서 수정하는 공급처·상품 정보가 모두 위 흐름으로 DB에 저장됩니다.
