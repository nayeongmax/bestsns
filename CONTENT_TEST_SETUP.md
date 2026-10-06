# 관리자 실제 제작 테스트

## 구현 범위
원본 1~10개, 파일당 500MB/총 1GB 업로드 → 관리자 주문 → 작업자 원자적 배정 → 결과 업로드 → 사이트 상태/영상/카드뉴스 확인. 테스트에서는 사이트 크레딧을 차감하지 않는다. 실제 AI 비용은 픽셀링 계정에 발생한다.

픽셀링 자동 실행 어댑터는 아직 구현·검증되지 않았다. 아래 API는 작업자 연결 계약이며 픽셀링 API라는 의미가 아니다. 어댑터 없이 연결 완료 플래그를 켜지 않는다.

## 서버 설정
1. Supabase SQL Editor에서 supabase/migrations/20261006_content_test.sql 실행. private content-test bucket과 서비스 전용 테이블/RPC 생성. 기존 콘텐츠에는 영향이 없다.
2. Netlify 서버 환경변수 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CONTENT_WORKER_KEY(32자 이상), CONTENT_ADMIN_SESSION_SECRET(32자 이상) 설정. VITE_ 접두사 금지.
3. 서버 관리자 로그인은 ADMIN_ID=admin, ADMIN_PASSWORD(브라우저에 공개된 VITE_ADMIN_PASSWORD와 다른 새로운 서버 전용 값)로 설정하고 로그인. 기존 브라우저 관리자 로그인은 미리보기만 허용한다. 실제 테스트는 새 서버 로그인 또는 Supabase profiles.role=admin 세션이 필요하다. 비밀번호 설정은 운영자가 수행한다.
4. 실제 픽셀링 어댑터 검증 후 CONTENT_TEST_ENABLED=true, CONTENT_PIXELING_BRIDGE_READY=true. SHORTS_PUBLIC_ENABLED는 false로 유지한다.

## 픽셀링 작업자 계약
POST /.netlify/functions/content-test-worker, Authorization: Bearer CONTENT_WORKER_KEY.
- {action:claim,worker:PC의 고유 이름}: 빈 경우 order=null. 작업이 있으면 id, claim_token, kind, settings, assets의 1시간 서명 다운로드 URL 반환. DB SKIP LOCKED로 같은 주문 중복 배정 방지.
- 어댑터는 주문별 독립 프로젝트를 만들어 모든 원본, settings의 대본/업종/스타일/길이/장수를 전달해야 한다. 임의 고객정보를 생성하지 않는다.
- {action:outputs,id,claimToken,files:[{name,type,size}]}: 결과 업로드 경로와 서명 token 반환. 영상은 MP4, 카드뉴스는 JPEG/PNG/WebP.
- Supabase storage uploadToSignedUrl로 결과 업로드 후 {action:complete,id,claimToken}. 업로드 존재·크기 확인 후에만 완료된다.
- 실패 시 {action:failed,id,claimToken,message}. 차감/환불은 이 테스트 API에서 실행하지 않는다. 작업자 중단 시 관리자가 상태를 확인해야 하며 자동 재시도는 하지 않는다.

## 검증 남은 항목
실제 Supabase 마이그레이션/환경 설정, 서버 관리자 로그인, 실제 파일 업로드, 픽셀링 어댑터 구현, 영상 및 카드뉴스 각각 1건 완성, 두 작업자의 동시 배정. 이 과정이 끝나기 전 제작 연동 완료라고 표시하면 안 된다.
