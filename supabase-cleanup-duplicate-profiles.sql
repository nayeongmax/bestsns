-- 중복 프로필 정리: UUID ID와 커스텀 ID가 같은 이메일로 공존할 때
-- UUID 행을 삭제하고, 커스텀 ID 행에 join_date 등 데이터를 병합합니다.
-- Supabase SQL Editor에서 실행하세요.
--
-- 발생 원인:
--   supabase.auth.signUp() 시 Auth 트리거가 UUID 기반 profiles 행을 자동 생성하고,
--   앱 코드에서 커스텀 ID(예: payverse, kgininis)로 profiles 행을 추가 생성해 중복 발생.
-- 향후 예방:
--   앱 코드(AuthPage.tsx)에서 커스텀 ID 프로필 저장 후 UUID 중복 행을 자동 삭제합니다.

-- 0. 현재 중복 쌍 확인 (실행 전 목록 조회)
SELECT a.id AS uuid_id, b.id AS custom_id, a.email
FROM profiles a
JOIN profiles b ON LOWER(a.email) = LOWER(b.email) AND a.id != b.id
WHERE a.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND b.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 1. 커스텀 ID 행에 points, join_date 병합 (UUID 행 데이터가 더 최신이거나 커스텀 행이 NULL인 경우)
UPDATE profiles AS custom_p
SET
  join_date = COALESCE(custom_p.join_date, uuid_p.join_date),
  points = GREATEST(COALESCE(custom_p.points, 0), COALESCE(uuid_p.points, 0))
FROM profiles AS uuid_p
WHERE LOWER(custom_p.email) = LOWER(uuid_p.email)
  AND custom_p.id != uuid_p.id
  AND uuid_p.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND custom_p.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. UUID ID 행 삭제 (같은 이메일의 커스텀 ID 행이 존재하는 경우만)
DELETE FROM profiles
WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND email IS NOT NULL
  AND email != ''
  AND EXISTS (
    SELECT 1 FROM profiles AS p2
    WHERE LOWER(p2.email) = LOWER(profiles.email)
      AND p2.id != profiles.id
      AND p2.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- 3. 정리 후 확인 (중복이 0건이어야 함)
SELECT COUNT(*) AS remaining_duplicates
FROM profiles a
JOIN profiles b ON LOWER(a.email) = LOWER(b.email) AND a.id != b.id
WHERE a.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND b.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
