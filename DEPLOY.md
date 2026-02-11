# Netlify + Supabase 배포 가이드 (보안 포함)

> **회원가입 제한 없이 사용하려면** 아래 "2. 회원가입 시 email rate limit 방지"에서 **Confirm email을 OFF**로 설정하면 됩니다. (보안상 문제 없음)

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

Supabase는 기본적으로 **이메일 확인(Confirm email)** 이 켜져 있으면, 회원가입할 때마다 확인 메일을 보냅니다.  
무료 플랜에서는 시간당 보낼 수 있는 메일 수가 제한되어 있어, 이 제한에 걸리면 **"email rate limit exceeded"** 오류가 납니다.

**해결 방법:** 이메일 확인 없이 가입만 허용하도록 설정을 바꿉니다.

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **Providers** → **Email** 이동
3. **Confirm email** 옵션을 **OFF** 로 변경 후 저장

이렇게 하면 회원가입 시 메일을 보내지 않아 rate limit에 걸리지 않고, 가입 후 바로 로그인할 수 있습니다.  
(비밀번호 찾기 등 다른 기능에서 메일을 쓰는 경우에는 여전히 시간당 제한이 적용됩니다.)

---

## 3. 보안 체크리스트

- [ ] `.env` 파일을 Git에 커밋하지 않았는지 확인 (`.gitignore`에 `.env` 포함됨)
- [ ] Netlify 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
- [ ] Supabase 대시보드에서 필요한 경우 "Confirm email" OFF 로 설정해 rate limit 오류 방지
- [ ] Supabase의 Row Level Security(RLS) 등 DB 보안 정책은 프로젝트 요구사항에 맞게 별도 설정
