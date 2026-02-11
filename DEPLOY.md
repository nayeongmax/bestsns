# Netlify + Supabase 배포 가이드 (보안 포함)

> **회원가입 제한 없이 사용하려면** 아래 "2. 회원가입 시 email rate limit 방지"에서 **Confirm sign up(이메일 확인)을 OFF**로 설정하면 됩니다. (보안상 문제 없음)

## 1. 환경 변수 설정

- **로컬:** 프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채운 뒤 저장합니다. (`.env`는 Git에 올라가지 않습니다.)
- **Netlify:** 사이트 설정 → Environment variables 에서 다음 변수를 추가합니다.

| 변수 이름 | 설명 |
|-----------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL (예: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase 프로젝트의 anon(public) key |

Supabase 키는 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택 → Settings → API 에서 확인할 수 있습니다.  
**anon key는 공개되어도 되는 키이지만, 서버용 secret key는 절대 프론트엔드나 Git에 넣지 마세요.**

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

### 접속 절차

1. **로그인 페이지**에서 `VITE_ADMIN_ID` 에 설정한 **아이디**와 `VITE_ADMIN_PASSWORD` 에 설정한 **비밀번호**로 로그인합니다.
2. 로그인 후 **화면 우측 하단** **ADMIN PANEL** 버튼을 누르거나, 주소창에 `/#/admin` 을 입력합니다.
3. 「관리자 인증 센터」에서 `VITE_ADMIN_PASSWORD`(또는 `VITE_ADMIN_PANEL_PASSWORD`) 비밀번호를 한 번 더 입력하면 운영 대시보드가 표시됩니다.

**보안:** `/admin` 은 **role 이 admin 인 사용자만** 접근 가능합니다.  
환경 변수는 **빌드된 JS에 포함**되므로, 배포된 사이트를 매우 자세히 분석하면 이론상 노출될 수 있습니다. 금융/의료 등 높은 보안이 필요하면 백엔드(서버)에서만 관리자 인증을 검사하는 방식을 권장합니다.
