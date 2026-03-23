-- 중복 프로필 정리: UUID ID와 커스텀 ID가 같은 이메일로 공존할 때
-- UUID 행을 삭제하고, 커스텀 ID 행에 join_date 등 데이터를 병합합니다.
-- Supabase SQL Editor에서 실행하세요.

-- 1. UUID 패턴 확인용: 중복 쌍 목록 조회 (먼저 확인용으로 실행)
-- SELECT a.id AS uuid_id, b.id AS custom_id, a.email
-- FROM profiles a
-- JOIN profiles b ON LOWER(a.email) = LOWER(b.email) AND a.id != b.id
-- WHERE a.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--   AND b.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. 커스텀 ID 행에 join_date 병합 (UUID 행의 join_date가 있고 커스텀 행이 NULL인 경우)
UPDATE profiles AS custom_p
SET join_date = uuid_p.join_date
FROM profiles AS uuid_p
WHERE LOWER(custom_p.email) = LOWER(uuid_p.email)
  AND custom_p.id != uuid_p.id
  AND uuid_p.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND custom_p.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND custom_p.join_date IS NULL
  AND uuid_p.join_date IS NOT NULL;

-- 3. UUID ID 행 삭제 (같은 이메일의 커스텀 ID 행이 존재하는 경우만)
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
