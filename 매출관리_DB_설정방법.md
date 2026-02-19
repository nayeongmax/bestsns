# 매출관리 DB 저장이 안 될 때 (Supabase 설정)

"DB 저장에 실패했습니다" 알림이 뜨면 **Supabase에 매출관리용 테이블이 아직 없거나, RLS가 막고 있는 상태**입니다.

## 해결 방법 (한 번만 하면 됨)

1. **Supabase 대시보드** 접속  
   https://supabase.com → 본인 프로젝트 선택

2. 왼쪽 메뉴에서 **SQL Editor** 클릭

3. **New query** 로 새 쿼리 열기

4. 프로젝트 폴더에 있는 **`supabase-setup-4단계-매출관리.sql`** 파일을 연 다음, **전체 내용을 복사**해서 SQL Editor에 붙여넣기

5. **Run** (또는 Ctrl+Enter) 실행

6. "Success" 나 오류 없이 끝나면 설정 완료입니다.

7. 사이트에서 **다시 로그인**한 뒤, 매출관리 페이지에서 회사/프로젝트를 다시 등록해 보세요.

---

## 참고

- 매출관리는 **Supabase 로그인(이메일·비밀번호 등)** 으로 들어온 사용자만 DB에 저장됩니다.
- 위 SQL을 실행하면 `revenue_operating_companies`, `revenue_projects`, `revenue_todos`, `revenue_general_expenses` 4개 테이블과 RLS 정책이 생성됩니다.
