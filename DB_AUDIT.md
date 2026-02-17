# DB 저장 검열 결과 – 미연동/누락 구간

회원의 구매·판매·계정 등 **DB에 저장되지 않는 부분**을 정리한 검열 결과입니다.

---

## 이미 DB 연동된 부분 (정상)

| 구간 | 테이블 | 비고 |
|------|--------|------|
| N잡스토어 상품/주문/리뷰 | store_products, store_orders, reviews | App 로드/저장 + storeDb |
| 채널판매 상품/주문 | channel_products, channel_orders | App 로드/저장 + channelDb |
| SNS활성화 주문/공급처/상품 | smm_orders, smm_providers, smm_products | App 로드/저장 + smmDb |
| 누구나알바 작업/의뢰/잔액 등 | parttime_*, freelancer_* | 페이지별 parttimeDb (App 상태 아님) |
| 알림 | site_notifications | 추가 시 insert, 읽음 처리 시 update |
| 찜 | user_wishlist | 추가/삭제 시 upsert/delete |
| 접속 로그 | site_access_log | insert |
| 회원 목록 로드 | profiles | App 마운트 시 select (한 번) |
| 회원가입 | profiles | AuthPage에서 upsert |
| 어드민 회원 수정/판매자 승인 | profiles | MemberAdmin에서 update |
| 탈퇴 | profiles | UserInfoSection에서 delete |
| 채팅 메시지 | chat_messages | ChatPage insert |
| AI 컨설팅 | ai_consult_* | AIConsulting insert/update |
| N잡 구매자 플래그/판매자 출금 | order_buyer_flags, seller_withdrawal_batches | storeDb |

---

## 1. 회원 프로필·포인트·쿠폰 (profiles) – **DB 미반영**

- **포인트 충전** (PointPayment): 결제 성공 시 `onUpdateUser({ ...user, points: nextPoints })`만 호출 → **profiles 테이블 update 없음**. 메모리·localStorage만 반영.
- **포인트 사용** (SNS 활성화 주문): `site-user-update`로 포인트 차감 후 `handleGlobalUserUpdate` → **profiles update 없음**.
- **쿠폰 사용** (결제 시 쿠폰 적용): 결제 후 해당 쿠폰을 `used`로 바꾸고 회원 쿠폰 배열을 갱신해도 **profiles.coupons에 반영하는 코드 없음**.
- **쿠폰 대량 발급** (handleMassIssueCoupons): `setMembers`로 쿠폰 추가만 하고 **profiles update 없음**.
- **마이페이지 프로필 수정** (전문가/프리랜서 신청, 계정 정보): `onUpdate({ ...user, ... })`만 호출 → **profiles에 update 없음**. (어드민이 회원 수정할 때만 MemberAdmin에서 profiles update 함.)

**영향**: 새로고침·다른 기기에서 로그인 시 포인트/쿠폰/프로필 수정 내용이 DB 기준으로 덮어써져 사라질 수 있음.

---

## 2. N잡스토어(이북) 구매 시 주문 생성 – **DB 미저장**

- **이북 결제** (EbookDetail → PointPayment): 채널 결제 시에는 `ChannelOrder` 생성 후 `setChannelOrders`로 DB까지 저장되지만, **이북 결제 시에는 `StoreOrder`를 만들지 않고 `setStoreOrders`를 호출하지 않음**.
- **결과**: 이북 구매 내역이 store_orders에 들어가지 않으며, 마이페이지 N잡 구매 내역에 표시되지 않음.

---

## 3. 자유게시판·공지·등급 설정 – **DB 미연동**

- **게시글 (posts)**: `site_posts` 테이블 존재(5단계 SQL)하지만 App은 **로드/저장 모두 localStorage**(site_posts_v2)만 사용.
- **공지 (notices)**: `site_notices` 테이블 존재(1단계)하지만 App은 **로드/저장 모두 localStorage**(site_notices_v2)만 사용.
- **등급 설정 (grade_configs)**: `grade_configs` 테이블 존재(2단계)하지만 App은 **로드/저장 모두 localStorage**(grade_configs_v2)만 사용.

**영향**: 다른 기기·브라우저·새로고침 시 게시글/공지/등급이 DB와 맞지 않거나 초기화될 수 있음.

---

## 4. 알바의뢰 결제(paid) – **DB 미반영**

- **AlbaPaymentPage**: 결제 성공 시 `getPartTimeJobRequests()` / `setPartTimeJobRequests(next)` (constants → **localStorage**)로만 `paid: true` 반영.
- **parttime_job_requests** 테이블에는 `upsertPartTimeJobRequest`로 저장하는 구간이 있지만, **결제 완료 시점에 이 API를 호출하지 않음**.
- **영향**: DB에서 의뢰 목록을 다시 불러오면 결제 완료 상태가 사라짐.

---

## 5. 기타 참고

- **회원 목록(profiles)** 은 App 마운트 시 한 번만 select하고, 이후에는 **setMembers만으로 메모리만 갱신**. 포인트/쿠폰/역할 등이 어드민·결제·쿠폰 발급 등으로 바뀌어도 **profiles 테이블에 쓰는 곳은 MemberAdmin 등 일부만** 있어, 전반적으로 **profiles와 화면 상태가 어긋날 수 있음**.

---

## 조치 완료 요약 (반영됨)

| 순서 | 항목 | 적용 내용 |
|------|------|-----------|
| 1 | 회원 포인트/쿠폰/프로필 | **profileDb.ts** 추가. 포인트 충전(PointPayment), 포인트 사용(SNSActivation), 쿠폰 사용·대량발급(App), 마이페이지 전문가/프리랜서 신청(UserInfoSection) 시 **updateProfile()** 호출로 profiles 반영 |
| 2 | 이북 구매 | PointPayment에서 이북 결제 성공 시 **StoreOrder 생성 후 setStoreOrders** 호출. EbookDetail에서 결제 state에 tier/storeType/sellerNickname 전달 |
| 3 | 알바 결제 | AlbaPaymentPage 결제 성공 시 **upsertPartTimeJobRequest({ ...jobRequest, paid: true })** 호출로 parttime_job_requests에 paid 반영 |
| 4 | 게시글/공지/등급 | **siteDb.ts** 추가. App 마운트 시 fetchNotices/fetchGradeConfigs/fetchPosts, 변경 시 upsertNotices/upsertGradeConfigs/upsertPosts 호출 (기존 1·2·5단계 테이블 사용, 7단계 미사용) |
