# 채널판매 · 구매 내역 DB 연동

## 적용된 DB 테이블 (Supabase)

- **channel_products** – 채널 상품: 플랫폼, 제목, 카테고리, 구독자·수익·비용, 가격, 썸네일·첨부이미지, 품절·승인·핫, 링크, 판매자 정보 등
- **channel_orders** – 채널 구매 내역: 구매자, 주문시각, 상품ID·이름·플랫폼·가격, 상태, 결제ID·결제수단·결제로그

## SQL 적용

- **supabase-setup-2단계-어드민.sql** – `channel_products`, `channel_orders` 테이블 정의 포함

## 코드 연동 요약

| 대상 | 내용 |
|------|------|
| **App** | 마운트 시 `fetchChannelProducts` / `fetchChannelOrders` 로 채널 상품·주문 로드 → channels, channelOrders 상태 설정. 상태 변경 시 `upsertChannelProducts` / `upsertChannelOrders` 로 DB 저장. |
| **채널판매 페이지** | 채널 등록·수정·삭제는 ChannelAdmin 등에서 setChannels 사용 → App 상태 반영 후 자동 DB 저장. |
| **결제 (PointPayment)** | 채널 즉시구매 결제 성공 시 ChannelOrder 생성 후 setChannelOrders 호출 → App이 channelOrders 변경 시 DB에 저장. |
| **마이페이지 (BuyerDashboard)** | channelOrders는 App(DB)에서 내려받아 채널 구매 내역 탭에 표시. |

## API 모듈 (`channelDb.ts`)

- **상품**: `fetchChannelProducts`, `upsertChannelProduct`, `upsertChannelProducts`, `deleteChannelProduct`
- **주문**: `fetchChannelOrders`, `upsertChannelOrder`, `upsertChannelOrders`

채널 상품 업로드(ChannelAdmin), 채널 결제(PointPayment → 채널 상품 결제 시)는 App의 setChannels / setChannelOrders 를 사용하며, 변경분은 위 흐름으로 DB에 저장됩니다.
