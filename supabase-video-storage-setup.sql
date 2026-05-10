-- ============================================================
-- 영상제공 기능: Supabase Storage 버킷 생성
--
-- ▶ 아래 SQL 전체를 Supabase SQL Editor에서 실행하세요.
--   (Storage → New Bucket UI 대신 SQL로 한번에 처리)
-- ============================================================

-- 1. 버킷 생성 (public, 최대 500MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parttime-videos', 'parttime-videos', true, 524288000, null)
ON CONFLICT (id) DO NOTHING;

-- 2. 인증된 사용자(회원)는 업로드 가능
CREATE POLICY "members can upload videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'parttime-videos');

-- 3. 누구나 읽기 가능 (어드민 다운로드 URL 접근)
CREATE POLICY "public read videos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'parttime-videos');

-- 4. 본인 영상 삭제 가능
CREATE POLICY "members can delete own videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'parttime-videos');
