# 관리자 인증 보안 전환

브라우저 UI 코드는 방문자가 내려받는다. 비밀번호·서비스키·실제 권한 검증은 서버에서만 처리한다. 공개 GitHub 저장소의 서버 코드도 읽을 수 있으므로 코드 자체를 비밀로 간주하지 않는다.

## 적용 순서
1. 이 PR 코드 검토 및 배포 전 Netlify Functions 환경변수에 ADMIN_ID=admin, ADMIN_PASSWORD(기존 값과 다른 새 값), ADMIN_SESSION_SECRET(32자 이상 무작위 값), 기존 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY를 설정한다. CONTENT_ADMIN_SESSION_SECRET도 호환된다.
2. VITE_ADMIN_PASSWORD/VITE_ADMIN_PANEL_PASSWORD/VITE_ADMIN_ID를 제거한다. 새 비밀번호를 VITE_ 변수에 넣지 않는다. 새 서버 값이 남아 있는 기존 VITE 비밀번호와 같으면 로그인을 차단한다.
3. 배포 후 새 서버 비밀번호로 admin 로그인, 새로고침, 관리자 상품·SMM·프리랜서 API, 로그아웃을 확인한다. 이전 비밀번호와 x-admin-key는 관리자 API에서 거부된다. 서버 설정이 없으면 관리자 로그인이 차단된다.
4. Supabase에서 supabase/migrations/20261006_admin_security.sql을 검토 후 실행한다. 기존 store_products RLS 비활성화를 복구하고 profiles.role의 자기 승격을 차단한다. 실제 DB 정책은 이 대화에서 조회/적용하지 못했다.
5. 이전에 공개된 비밀번호는 다른 서비스에서 재사용했다면 그 서비스에서도 교체한다. 이전 Netlify 미리보기/배포 파일은 기존 값을 포함할 수 있으므로 접근을 정리한다. 코드 재배포가 이전 배포 파일을 소급해서 지우지는 않는다.

## 검증 및 한계
프런트엔드에 관리자 비밀번호가 포함되지 않는 빌드 검증, 위조 세션/기존 공개 키/비관리자 JWT/다른 사이트 요청 거부를 테스트한다. Supabase에 SQL 적용 후 실제 관리자/판매자 계정으로 데이터를 확인해야 한다.

이번 변경은 관리자 로그인·패널·SMM/상품/프리랜서 서버 API·쇼츠 접근 경로의 공개 비밀번호 인증을 제거한다. profiles의 기타 개인정보 접근, 결제/잔액/출금 RPC, 모든 테이블 RLS의 전체 보안 감사 완료를 의미하지 않는다. 해당 DB 정책은 서버 설정과 함께 별도 확인이 필요하다.
