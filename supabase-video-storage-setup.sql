-- ============================================================
-- 영상제공 기능: Supabase Storage 버킷 생성
--
-- ▶ 아래 SQL 전체를 Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 버킷 생성 (public, 용량제한 없음)
--    이미 버킷이 있으면 file_size_limit 을 NULL 로 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parttime-videos', 'parttime-videos', true, null, null)
ON CONFLICT (id) DO UPDATE SET file_size_limit = null, public = true;

-- 2. 인증된 사용자(회원)는 업로드 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can upload videos'
  ) THEN
    EXECUTE 'CREATE POLICY "members can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''parttime-videos'')';
  END IF;
END $$;

-- 3. 누구나 읽기 가능 (어드민 다운로드 URL 접근)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='public read videos'
  ) THEN
    EXECUTE 'CREATE POLICY "public read videos" ON storage.objects FOR SELECT TO public USING (bucket_id = ''parttime-videos'')';
  END IF;
END $$;

-- 4. 본인 영상 삭제 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='members can delete own videos'
  ) THEN
    EXECUTE 'CREATE POLICY "members can delete own videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''parttime-videos'')';
  END IF;
END $$;
