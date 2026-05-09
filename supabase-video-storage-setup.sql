-- ============================================================
-- 영상제공 기능: Supabase Storage 버킷 생성
-- Supabase 대시보드 → Storage → New Bucket 에서 생성하세요.
--
-- 버킷 이름: parttime-videos
-- Public 버킷: ✅ ON  (회원이 업로드한 영상을 어드민이 URL로 바로 접근)
--
-- 생성 후 아래 SQL을 Supabase SQL Editor에서 실행하세요.
-- 제목: parttime-videos Storage 정책 설정
-- ============================================================

-- 인증된 사용자(회원)는 자신의 폴더에 업로드 가능
CREATE POLICY "members can upload videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'parttime-videos');

-- 누구나 읽기 가능 (어드민 다운로드 URL 접근)
CREATE POLICY "public read videos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'parttime-videos');

-- 본인 영상 삭제 가능
CREATE POLICY "members can delete own videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'parttime-videos');
