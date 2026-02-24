-- ============================================================
-- Supabase: auth.users ↔ profiles 자동 동기화 트리거
-- ============================================================
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.
-- 실행 후에는 구글/카카오 소셜 가입, 이메일 가입 시
-- auth.users에 유저가 추가되는 즉시 profiles 테이블에도
-- 자동으로 행이 생성됩니다.
--
-- [주의] 탈퇴 시 profiles 삭제는 아래 삭제 트리거도 함께 적용하세요.
-- ============================================================

-- 1) profiles 테이블에 auth_id 컬럼이 없으면 추가 (이미 있으면 건너뜀)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) 신규 가입 시 profiles에 자동 INSERT 하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nickname text;
  _email    text;
BEGIN
  -- 닉네임: user_metadata의 nickname > name > full_name > 이메일 앞부분 순서
  _nickname := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nickname'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'),     ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),
    split_part(NEW.email, '@', 1)
  );
  _email := lower(trim(NEW.email));

  INSERT INTO public.profiles (id, auth_id, email, nickname, updated_at)
  VALUES (
    NEW.id,      -- profiles.id = auth.users.id (UUID)
    NEW.id,      -- auth_id도 동일하게 저장 (조회 편의)
    _email,
    _nickname,
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      auth_id    = EXCLUDED.auth_id,
      email      = COALESCE(EXCLUDED.email, profiles.email),
      nickname   = CASE WHEN profiles.nickname IS NULL OR profiles.nickname = ''
                        THEN EXCLUDED.nickname
                        ELSE profiles.nickname END,
      updated_at = now();

  RETURN NEW;
END;
$$;

-- 3) auth.users INSERT 시 위 함수 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4) 탈퇴(auth.users DELETE) 시 profiles도 함께 삭제하는 함수
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- 5) auth.users DELETE 시 위 함수 실행
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_deleted();

-- ============================================================
-- 기존 auth.users 유저 중 profiles에 없는 유저 일괄 동기화
-- (트리거 적용 전에 이미 가입한 소셜/이메일 유저 백필)
-- ============================================================
INSERT INTO public.profiles (id, auth_id, email, nickname, updated_at)
SELECT
  u.id,
  u.id,
  lower(trim(u.email)),
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'nickname'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'),     ''),
    NULLIF(trim(u.raw_user_meta_data->>'full_name'),''),
    split_part(u.email, '@', 1)
  ),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
