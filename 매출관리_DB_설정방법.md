# 매출관리 DB 저장이 안 될 때 (Supabase 설정)

"DB 저장에 실패했습니다" 알림이 뜨면 **Supabase에 매출관리용 테이블이 없거나, RLS 때문에 쓰기가 막힌 상태**입니다.  
알림에 나오는 **[에러]** 내용을 보면 원인을 더 정확히 알 수 있습니다.

## 해결 방법 (한 번만 하면 됨)

1. **Supabase 대시보드** 접속  
   https://supabase.com → **사이트에서 쓰는 것과 같은 프로젝트** 선택

2. 왼쪽 메뉴 **SQL Editor** 클릭

3. **New query** 로 새 쿼리 창 열기

4. 이 프로젝트 폴더의 **`supabase-setup-4단계-매출관리.sql`** 파일을 열고 **전체 선택(Ctrl+A) → 복사**  
   → SQL Editor에 **붙여넣기**

5. **Run** (또는 Ctrl+Enter) 로 실행  
   → "Success" 또는 오류 없이 끝나면 설정 완료

6. **사이트에서 한 번 로그아웃 후 다시 로그인**  
   (이메일+비밀번호로 로그인해야 Supabase 세션이 생깁니다.)

7. 매출관리 페이지에서 회사/프로젝트 다시 등록 후 저장해 보기

---

## 자주 나오는 에러

| 알림에 보이는 에러 | 의미 | 조치 |
|-------------------|------|------|
| `relation "revenue_... does not exist` | 테이블이 없음 | 위 SQL 전체 실행 |
| `new row violates row-level security` | RLS로 쓰기 차단 | 위 SQL에서 RLS 정책까지 실행했는지 확인, 다시 로그인 |
| `JWT expired` 또는 로그인 관련 | 세션 만료 | 로그아웃 후 이메일+비밀번호로 다시 로그인 |

---

## 참고

- 매출관리 저장은 **Supabase 로그인(이메일·비밀번호)** 으로 들어온 사용자만 가능합니다.
- SQL 실행 시 `revenue_operating_companies`, `revenue_projects`, `revenue_todos`, `revenue_general_expenses` 4개 테이블과 RLS 정책이 생성됩니다.
