# Supabase RLS 적용 체크리스트 (그래도 안 될 때)

포인트가 0으로 바뀌거나, 어드민에서 회원 목록/AI 상담 통계가 안 나오면 아래를 순서대로 확인하세요.

---

## 0. `column profiles.xxx does not exist` 에러가 날 때

콘솔에 **profiles.manual_grade does not exist** 또는 **profiles.coupons does not exist** 등이 보이면, **RLS가 아니라** `profiles` 테이블에 해당 컬럼이 없어서 조회가 실패하는 것입니다.

- **앱 수정:** profiles 조회를 **select('*')** 로 바꿔 두었습니다. 테이블에 **있는 컬럼만** 내려오므로, `manual_grade`, `coupons` 등이 없어도 조회는 성공하고, 없는 값은 0/빈 배열로 처리됩니다.
- **포인트·쿠폰·수익 등을 DB에 저장하려면:** 프로젝트 루트의 **`supabase-profiles-add-columns.sql`** 파일을 Supabase SQL Editor에서 실행하면, `profiles`에 `points`, `coupons`, `total_purchase_amount`, `total_sales_amount`, `total_freelancer_earnings` 등 누락된 컬럼이 한 번에 추가됩니다.

---

## 1. Supabase 프로젝트가 앱과 같은지 확인

- 브라우저 개발자도구(F12) → **Console** 탭에서 `[Supabase] profiles 로드 실패` 또는 `프로필 재조회 실패` 메시지가 나오는지 봅니다.
- **Network** 탭에서 `rest/v1/profiles` 요청이 **본인 Supabase URL** (`https://xxxxx.supabase.co`) 로 나가는지 확인합니다.
- `.env`(또는 Netlify 환경변수)의 `VITE_SUPABASE_URL` 이 위 주소와 **완전히 같은지** 확인합니다. 다르면 다른 프로젝트를 보고 있는 것이므로 RLS를 적용해도 반영되지 않습니다.

---

## 2. profiles만 먼저 적용 (가장 중요)

다른 스크립트에서 에러가 나서 전체가 롤백됐을 수 있으므로, **가장 작은 스크립트**부터 실행합니다.

1. Supabase 대시보드 → **SQL Editor**
2. **`supabase-rls-profiles-only.sql`** 파일 내용 **전부** 복사해서 붙여넣기
3. **Run** 클릭
4. **Success** 가 나오는지 확인. 에러가 나오면 에러 메시지 전체를 복사해 두세요.

적용되면:

- 앱 새로고침 후 **어드민 → 회원 및 권한 관리** 탭을 열면 회원 목록이 불러와져야 하고,
- **마이페이지**에 들어가면 포인트가 DB 값으로 맞춰져야 합니다.

---

## 3. RLS 정책이 실제로 있는지 확인

1. Supabase 대시보드 → **Table Editor** → 왼쪽에서 **profiles** 테이블 선택
2. 오른쪽 상단 **RLS policies** (또는 자물쇠 아이콘) 클릭
3. **profiles_select_public**, **profiles_update_public** 정책이 **목록에 보이는지** 확인합니다.

보이지 않으면 2번 스크립트가 실패한 것이므로, Run 시 나온 에러 메시지를 확인해 주세요.

---

## 4. 나머지 테이블 RLS (상품·주문·공지 등)

- **`supabase-rls-public-read-channel-store.sql`** 실행 (채널/스토어 상품)
- **`supabase-rls-public-all-site-data.sql`** 실행 (주문, 리뷰, 공지, 게시글, 쿠폰, **profiles** 등)

`supabase-rls-public-all-site-data.sql` 실행 시 **에러가 나면**:

- 에러가 나는 **테이블 이름**을 확인합니다. (예: `relation "site_notices" does not exist`)
- 해당 테이블을 만드는 단계 SQL(1단계·5단계 등)을 먼저 실행했는지 확인한 뒤, 없으면 그 테이블 관련 구문만 주석 처리하고 다시 Run 하거나, **2번의 profiles 전용 스크립트만** 사용해도 포인트·회원 목록은 동작합니다.

---

## 5. AI 상담 이력·통계

- **`supabase-setup-6단계-AI컨설팅.sql`** 로 `ai_consult_sessions`, `ai_consult_messages` 테이블을 만든 뒤
- **`supabase-rls-ai-consult.sql`** 실행

6단계를 실행하지 않았다면 `supabase-rls-ai-consult.sql` 은 에러가 나므로, AI 상담을 쓰지 않는다면 이 파일은 실행하지 않아도 됩니다.

---

## 정리

| 증상 | 먼저 할 일 |
|------|------------|
| 포인트 0으로 바뀜 | 2번 **supabase-rls-profiles-only.sql** 실행 후, 3번에서 정책 존재 확인 |
| 어드민 회원 목록 비어 있음 | 위와 동일 + 어드민에서 **회원 및 권한 관리** 탭 클릭(재조회 트리거) |
| AI 상담 통계 안 나옴 | 6단계 SQL 실행 후 **supabase-rls-ai-consult.sql** 실행 |
| 그래도 안 됨 | F12 Console에 `[Supabase]` 로그가 나오는지, Network에서 `profiles` 요청이 본인 프로젝트 URL로 가는지 확인 |
