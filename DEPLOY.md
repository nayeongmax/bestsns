# Netlify + Supabase 배포 가이드 (보안 포함)

> **회원가입 제한 없이 사용하려면** 아래 "2. 회원가입 시 email rate limit 방지"에서 **Confirm sign up(이메일 확인)을 OFF**로 설정하면 됩니다. (보안상 문제 없음)

## 1. 환경 변수 설정

- **로컬:** 프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채운 뒤 저장합니다. (`.env`는 Git에 올라가지 않습니다.)
- **Netlify:** 사이트 설정 → Environment variables 에서 다음 변수를 추가합니다.

| 변수 이름 | 설명 |
|-----------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL (예: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase 프로젝트의 anon(public) key |
| `SUPABASE_URL` | (탈퇴 기능용) 위와 같은 Supabase 프로젝트 URL. **6절** 참고. |
| `SUPABASE_SERVICE_ROLE_KEY` | (탈퇴 기능용) Supabase **service_role** 키. **6절** 참고. 절대 프론트/Git에 넣지 마세요. |

Supabase 키는 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택 → Settings → API 에서 확인할 수 있습니다.  
**anon key는 공개되어도 되는 키이지만, service_role 키는 절대 프론트엔드나 Git에 넣지 마세요.**

### 회원 정보 로직 (단일 소스: Supabase `profiles`)

**흐름 요약**

1. **회원가입** → Supabase **Authentication (Users)**에 계정 생성 + **`profiles`** 테이블에 한 행 추가 (id, email, nickname 등).  
2. **앱 로드 시** → 회원 목록을 **Supabase `profiles`**에서 조회해 사용 (어드민 패널·채팅 등에서 사용하는 목록과 동일).  
3. **로그인** → `profiles`에서 아이디로 이메일을 찾아 `signInWithPassword(이메일, 비밀번호)` 호출. 로그인 성공 시 해당 계정을 `profiles`에 다시 한 번 upsert.  
4. **어드민 패널** → 위에서 불러온 **`profiles` 기반 회원 목록**을 그대로 표시.  
   → 따라서 **Table Editor의 `profiles` 행 수 = 어드민에 보이는 회원 수** (admin 1명은 profiles에 없고 앱에서만 추가해 표시).

**테이블 구조**

- **`profiles`**는 **회원 목록의 단일 소스**입니다.  
  반드시 **id(text), email(text), nickname(text)** 컬럼이 있고, 필요 시 **profile_image, phone, created_at, updated_at** 도 있어야 합니다.  
  구조가 다르면(예: `email` 없음) upsert가 실패해 Table Editor·어드민에 회원이 안 뜨거나 로그인이 안 됩니다.

1. **처음 설정:** Supabase **SQL Editor** → **`supabase-profiles-setup.sql`** 전체 실행.  
2. **이미 테이블이 있는데 컬럼이 다르거나, 예전 가입자가 안 보일 때:**  
   **`supabase-profiles-alter-and-backfill.sql`** 을 **순서대로** 실행.  
   - 누락된 컬럼 추가 + **Authentication → Users**에 있는 기존 회원을 **profiles**로 한 번에 백필.  
3. 이후 회원가입·로그인 시 자동으로 `profiles`에 반영되며, 앱은 **항상 profiles에서 회원 목록을 불러와** Table Editor와 어드민이 일치합니다.

**▶ "추가가 안 되어 있다" / Table Editor와 어드민 목록 맞추기 – 이렇게 하세요**

1. **Supabase 대시보드 접속**  
   브라우저에서 https://supabase.com/dashboard 로그인 후, 사용 중인 **프로젝트**를 선택합니다.

2. **SQL Editor 열기**  
   왼쪽 메뉴에서 **SQL Editor** (또는 **Database** → **SQL Editor**)를 클릭합니다.

3. **새 쿼리 만들기**  
   **New query** 버튼을 눌러 빈 편집 창을 엽니다.

4. **스크립트 붙여넣기**  
   프로젝트 폴더의 **`supabase-profiles-alter-and-backfill.sql`** 파일을 연 뒤, **파일 내용 전체**를 복사해서 SQL Editor 빈 칸에 **붙여넣기** 합니다.

5. **실행**  
   편집 창 오른쪽 아래(또는 상단)의 **Run** (실행) 버튼을 클릭합니다.  
   - "Success" 또는 실행 완료 메시지가 나오면 정상입니다.  
   - 에러가 나오면 메시지 내용을 확인한 뒤, 아래 "에러가 날 때"를 참고하세요.

6. **Table Editor에서 확인**  
   왼쪽 메뉴에서 **Table Editor**를 클릭하고, **profiles** 테이블을 선택합니다.  
   - **id, email, nickname** 등 컬럼이 보이고,  
   - **Authentication → Users**에 있던 회원 수만큼 **행**이 보이면 성공입니다.

7. **사이트 새로고침**  
   운영 중인 사이트(예: bestsns.com 또는 로컬 주소)를 브라우저에서 **새로고침(F5)** 합니다.  
   - 앱이 **profiles**에서 회원 목록을 다시 불러와서,  
   - **어드민 패널에 보이는 회원 = Table Editor의 profiles 행**과 맞춰집니다. (admin 1명은 profiles에 없어도 앱에서만 표시됩니다.)

**에러가 날 때**  
- **"relation auth.users does not exist"** 또는 **auth.users** 접근 오류  
  → Supabase 프로젝트가 맞는지, SQL Editor가 해당 프로젝트에서 열려 있는지 확인하세요.  
- **"column ... does not exist"**  
  → 같은 SQL Editor에서 **맨 위 5줄(ALTER TABLE ... ADD COLUMN ...)** 만 먼저 실행한 뒤, 나머지(INSERT, UPDATE)를 다시 실행해 보세요.  
- **"duplicate key"**  
  → 이미 백필이 된 상태일 수 있습니다. Table Editor에서 profiles 행 수만 확인하고, 사이트만 새로고침하면 됩니다.

**▶ 어드민에는 3명인데 Table Editor(profiles)에는 2명만 있을 때**

- **원인:** 빠진 회원(예: nayeong0)이 **Supabase Authentication → Users**에 없거나, 백필 시 반영되지 않은 경우입니다.  
  앱은 **profiles만** 보고 회원 목록을 만들기 때문에, profiles에 없으면 어드민에도 안 나옵니다(또는 예전 캐시만 보이다가 새로고침 시 사라짐).

**해결 방법 (둘 중 하나)**

1. **Authentication → Users에 해당 회원이 있을 때**  
   - **방법 A:** `supabase-profiles-alter-and-backfill.sql` 을 **한 번 더** 실행해서 Auth 사용자 전부를 다시 profiles로 넣기.  
   - **방법 B:** **`supabase-profiles-add-one-user.sql`** 파일을 연 뒤, 안에 있는 **이메일** `'nayeong0@naver.com'` 을 **빠진 회원의 실제 가입 이메일**로 바꾼 다음, SQL Editor에 붙여넣고 **Run** 실행.  
     → 그 한 명만 profiles에 추가(또는 업데이트)됩니다.

2. **Authentication → Users에 해당 회원이 없을 때**  
   - 그 회원은 **Supabase에 가입된 적이 없는 상태**입니다.  
   - **해당 회원**이 사이트에서 **로그인** 페이지 → **"비밀번호 재설정했는데 로그인이 안 되나요?"** → **이메일 + 비밀번호**로 한 번 로그인하면, 그때 profiles에 자동으로 추가됩니다.  
   - (이메일이 Auth에 없다면 먼저 **회원가입**을 그 이메일로 다시 해야 합니다.)

마친 뒤 **사이트를 새로고침(F5)** 하면, 어드민 회원 수와 Table Editor 행 수가 맞습니다.

**Table Editor에는 있는데 어드민에 안 보이거나, 그 반대인 경우**  
- 앱은 **페이지 로드 시** `profiles`만 보고 회원 목록을 만듭니다.  
- **admin**은 profiles에 없어도 앱에서 목록 맨 앞에 한 명 추가해 표시합니다.  
- **해결:** 새로고침 후에도 같으면, 브라우저 콘솔에서 "회원 목록(profiles) 로드 실패" 메시지 여부와, Table Editor의 `profiles` 컬럼 구조를 확인하세요.

**콘솔에 "Failed to load resource: 400" / grant_type=password 에러가 보일 때**  
→ 로그인 요청이 Supabase에서 거절된 상태입니다. (아이디·비밀번호 불일치 또는 해당 이메일이 Supabase [Authentication → Users]에 없을 때 흔히 발생합니다.)  
→ **Authentication → Users**에 로그인에 쓰는 **이메일**으로 사용자가 있는지, 비밀번호가 맞는지 확인하고, 없으면 해당 이메일로 회원가입을 먼저 진행하세요.

### 채팅 기능 (문의하기) 사용 시

채팅은 **N잡 스토어·채널 상품의 "문의하기"**로만 시작할 수 있습니다. (전체 회원 목록 노출 없음)  
Supabase **SQL Editor** → **`supabase-chat-setup.sql`** 실행으로 `chat_messages` 테이블을 생성하세요.

---

## 2. 회원가입 시 "email rate limit exceeded" 방지

Supabase는 **가입 확인 메일**이 켜져 있으면 회원가입할 때마다 이메일을 보냅니다.  
내장 이메일을 쓰면 **시간당 2통** 제한(Rate Limits에 "Rate limit for sending emails: 2 emails/h")이 있어, 이 제한에 걸리면 **"email rate limit exceeded"** 오류가 납니다.

### 방법 A: 가입 시 이메일 확인 끄기 (가장 간단)

**ON/OFF 스위치는 "Emails > Confirm sign up" 템플릿 화면이 아니라, 로그인 제공자 설정에 있습니다.**

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. 왼쪽에서 **Authentication** → **Sign In / Providers** (CONFIGURATION 아래) 클릭
3. 목록에서 **Email** 프로바이더 행을 클릭해서 펼치기
4. **"Confirm email"** 토글을 **OFF** 로 바꾼 뒤 **Save** (또는 변경 사항 저장)

※ **Authentication → Email** 메뉴의 **"Confirm sign up"** 은 **메일 내용(제목/본문 코드)** 만 바꾸는 곳이라 ON/OFF가 없습니다. OFF 하려면 반드시 **Sign In / Providers → Email** 로 가세요.

이렇게 하면 회원가입 시 메일을 보내지 않아 rate limit에 걸리지 않고, 가입 후 바로 로그인할 수 있습니다.

### 방법 B: Custom SMTP 사용 (가입 확인 메일을 계속 보내고 싶을 때)

- **Enable custom SMTP** 를 **끄면** = Supabase **내장 이메일** 사용 → 시간당 2통 제한 그대로입니다.
- **Enable custom SMTP** 를 **켜고** Gmail, SendGrid, Resend 등 SMTP를 설정하면, 발송 한도는 사용하는 서비스 기준이 됩니다.  
  (Authentication → Email → **SMTP Settings** 탭에서 설정)

---

## 3. 보안 체크리스트

- [ ] `.env` 파일을 Git에 커밋하지 않았는지 확인 (`.gitignore`에 `.env` 포함됨)
- [ ] Netlify 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
- [ ] Supabase 대시보드에서 필요한 경우 "Confirm sign up" OFF 로 설정해 rate limit 오류 방지
- [ ] Supabase의 Row Level Security(RLS) 등 DB 보안 정책은 프로젝트 요구사항에 맞게 별도 설정

---

## 4. 어드민(운영자) 패널 접속 방법

어드민 패널은 **별도 가입 없이**, 환경 변수로 설정한 계정으로 로그인하면 됩니다. **비밀번호는 코드에 두지 않고** `.env` 및 Netlify 환경 변수로만 설정합니다.

### 환경 변수 (필수)

| 변수 | 설명 |
|------|------|
| `VITE_ADMIN_ID` | 운영자 로그인 아이디 (미설정 시 `admin`) |
| `VITE_ADMIN_PASSWORD` | 운영자 로그인 비밀번호 + 패널 2차 인증 비밀번호 |
| `VITE_ADMIN_PANEL_PASSWORD` | (선택) 패널 2차 인증만 다른 비밀번호로 쓰려면 설정 |

- **로컬:** `.env` 에 위 변수를 넣고, 아이디/비밀번호를 **코드에 적지 않은 값**으로 설정합니다.
- **Netlify:** Site settings → Environment variables 에 같은 변수를 추가합니다. (빌드 시 적용되므로 배포 후에는 코드만 봐서는 비밀번호를 알 수 없습니다.)
- **중요:** Netlify에서 `VITE_ADMIN_ID`, `VITE_ADMIN_PASSWORD` 를 추가할 때 **"Contains secret values"를 체크하지 마세요.**  
  이 값들은 Vite 빌드 시 JS 번들에 포함되는 것이 정상이라, "secret"으로 표시하면 Netlify 시크릿 스캔이 빌드 결과물에서 감지해 **빌드를 실패**시킵니다. 체크 해제해도 값은 환경 변수에만 있고, 빌드는 정상 통과합니다.

### 접속 절차

1. **로그인 페이지**에서 `VITE_ADMIN_ID` 에 설정한 **아이디**와 `VITE_ADMIN_PASSWORD` 에 설정한 **비밀번호**로 로그인합니다.
2. 로그인 후 **화면 우측 하단** **ADMIN PANEL** 버튼을 누르거나, 주소창에 `/#/admin` 을 입력합니다.
3. 「관리자 인증 센터」에서 `VITE_ADMIN_PASSWORD`(또는 `VITE_ADMIN_PANEL_PASSWORD`) 비밀번호를 한 번 더 입력하면 운영 대시보드가 표시됩니다.

**보안:** `/admin` 은 **role 이 admin 인 사용자만** 접근 가능합니다.  
환경 변수는 **빌드된 JS에 포함**되므로, 배포된 사이트를 매우 자세히 분석하면 이론상 노출될 수 있습니다. 금융/의료 등 높은 보안이 필요하면 백엔드(서버)에서만 관리자 인증을 검사하는 방식을 권장합니다.

---

## 5. 카카오·구글 소셜 로그인 / 회원가입

로그인·회원가입 화면의 **카카오**, **구글** 버튼을 사용하려면 Supabase에서 해당 프로바이더를 활성화해야 합니다.

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **Sign In / Providers** 이동
3. **Google**, **Kakao** 중 사용할 행을 펼친 뒤 **Enable** 켜기
4. 각 서비스 개발자 콘솔에서 앱을 만들고 **Redirect URL**을 Supabase에 표시된 URL로 설정한 뒤, **Client ID**·**Client Secret**을 Supabase에 입력 후 저장

- **구글:** [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성 → 승인된 리디렉션 URI에 Supabase 제공 URL 등록
- **카카오:** [Kakao Developers](https://developers.kakao.com) → 앱 생성 → 카카오 로그인 활성화 → Redirect URI에 Supabase 제공 URL 등록

설정 전에 버튼을 누르면 "소셜 로그인 설정이 필요할 수 있습니다" 안내가 나올 수 있습니다.

### 5-1. 구글 동의 화면에 "Supabase 도메인"만 보일 때 (수상해 보이는 경우)

구글로 로그인/회원가입 시 **"xxxxx.supabase.co 서비스로 로그인"**처럼 Supabase 도메인만 보이면 사용자가 피싱으로 오해할 수 있습니다.  
**Google Cloud Console**에서 **앱 이름**을 바꾸면 동의 화면에 서비스 이름이 친숙하게 표시됩니다.

1. [Google Cloud Console](https://console.cloud.google.com) → 해당 프로젝트 선택
2. **API 및 서비스** → **OAuth 동의 화면** 이동
3. **앱 정보**에서 **앱 이름**을 **"THEBESTSNS"** 또는 **"더베스트SNS"** 등으로 설정 후 저장
4. (선택) **앱 로고**, **개인정보처리방침 URL** 등을 입력하면 더 신뢰도가 올라갑니다.

이후 구글 로그인 시 **"THEBESTSNS(또는 설정한 이름) 계정으로 로그인"** 형태로 표시됩니다. (도메인 주소는 일부 노출될 수 있으나, 앱 이름이 눈에 띄게 보입니다.)

### 5-2. 소셜(구글/카카오) 가입해도 profiles 목록에 계정이 안 들어오는 경우

**증상:** 구글이나 카카오로 **가입했는데** 회원 목록(Table Editor → **profiles**)에 그 계정이 **아예 없음**. 탈퇴해서 사라진 게 아니라, **가입할 때부터 profiles에 행이 안 만들어짐**. (Authentication → Users에는 있는데 profiles에만 없음.)  
**원인:** auth.users에는 행이 생기지만, **profiles에 행을 넣는 설정(트리거)**이 적용되지 않아서 그럼.  
**해결:** 아래 **① 트리거** 적용 후 **② 백필** 한 번 실행하면 됩니다.

---

**① 트리거 적용 (앞으로 가입하는 사람부터 profiles에 자동 추가)**

1. **Supabase 대시보드** → **SQL Editor** → 새 쿼리
2. **`supabase-auth-profiles-trigger.sql`** 파일 내용 **전체**를 복사해 붙여넣기 → **Run**
3. 이제부터 **새로** 구글/카카오로 가입하는 사용자는 **profiles**에 자동으로 한 행씩 추가됩니다.

**② 백필 (이미 Users에만 있고 profiles에 없는 계정 한 번에 추가)**

1. **Supabase 대시보드** → **SQL Editor** → 새 쿼리
2. **`supabase-profiles-backfill-from-auth.sql`** 파일 내용 **전체**를 복사해 붙여넣기 → **Run**
3. **auth.users에는 있는데 profiles에는 없던** 계정(예: 구글로 가입한 쇼츠7 등)이 **profiles**에 추가됩니다. 회원 목록과 Users가 맞춰집니다.

---

#### 방법 A 상세: Auth 트리거

구글/카카오 등 **auth.users에 새 사용자가 생성될 때** DB에서 자동으로 **profiles**에 한 행을 넣는 트리거를 켜면, RLS와 관계없이 항상 행이 생깁니다.

#### 방법 B: RLS INSERT 정책만 추가

1. **Supabase 대시보드** → **SQL Editor** → 새 쿼리
2. 아래 SQL을 붙여넣고 **Run** 실행:

```sql
DROP POLICY IF EXISTS "profiles_insert_public" ON profiles;
CREATE POLICY "profiles_insert_public" ON profiles FOR INSERT WITH CHECK (true);
```

3. 또는 **`supabase-rls-profiles-only.sql`** / **`supabase-rls-public-all-site-data.sql`** 을 **다시 한 번** 실행해 주세요.
4. 그래도 안 되면 **방법 A(트리거)** 를 적용해 보세요.

#### RLS가 켜져 있는지 확인하는 방법

- **Database** → **Tables** → **profiles** 테이블 선택 후, 상단 또는 테이블 설정에서 **RLS** 표시가 있는지 확인합니다. (Supabase UI 버전에 따라 "RLS enabled" 토글이나 방패 아이콘으로 보입니다.)
- SQL로 확인: `SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles';` → `t`이면 RLS 켜짐.

---

## 6. 회원 탈퇴 시 Users + profiles 둘 다 삭제되게 하기

**원하는 동작:** 탈퇴하면 **profiles**와 **Authentication → Users** 둘 다 삭제. 가입/로그인하면 **profiles**에 추가.

이 프로젝트는 **Netlify 함수**로 탈퇴 처리를 합니다. **터미널(Supabase CLI) 없이** Netlify 환경 변수만 넣고 **Git push → 자동 배포**하면 됩니다.

### 6-1. Netlify 환경 변수 추가 (한 번만)

1. [Netlify 대시보드](https://app.netlify.com) → 해당 사이트 → **Site configuration** → **Environment variables**
2. **Add a variable** → **Add single variable** (또는 기존에 추가)
3. 아래 두 개를 추가합니다.

| 이름 | 값 | 비고 |
|------|-----|------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase 대시보드 → Settings → API 의 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (긴 키) | Supabase 대시보드 → Settings → API 의 **service_role** (secret 키). **절대 프론트엔드 코드나 Git에 넣지 마세요.** |

4. **Save** 후, **Deploys**에서 **Trigger deploy** → **Deploy site** 로 한 번 재배포합니다. (환경 변수 반영)

이후 회원이 **마이페이지 → 회원 탈퇴**를 하면 **profiles 삭제 + Users 삭제**가 한 번에 되고, 목록에서 사라집니다.

### 6-2. 가입/로그인 시 profiles에 추가

**소셜(구글/카카오) 가입 시 profiles에 안 들어오는 경우** → **5-2절**대로 **트리거** + **백필** 한 번 실행하면, 가입/로그인하는 대로 profiles에 추가됩니다.

### 6-3. (참고) 이미 탈퇴했는데 Users에만 남아 있는 계정

Netlify 함수 배포 전에 탈퇴한 계정은 **profiles만** 삭제된 상태일 수 있습니다. Supabase **Authentication → Users**에서 해당 사용자를 **수동 삭제**하면 됩니다.
