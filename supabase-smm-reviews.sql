-- SMM 이용 후기 테이블
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS smm_reviews (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  user_nickname TEXT      NOT NULL DEFAULT '',
  product_name  TEXT      NOT NULL DEFAULT '',
  platform      TEXT      NOT NULL DEFAULT '',
  rating        INT       NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content       TEXT      NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE smm_reviews ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (공개 리뷰)
CREATE POLICY "smm_reviews_select_all" ON smm_reviews
  FOR SELECT USING (true);

-- 로그인한 사용자만 자신의 리뷰 작성 가능
CREATE POLICY "smm_reviews_insert_own" ON smm_reviews
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 자신의 리뷰만 삭제 가능
CREATE POLICY "smm_reviews_delete_own" ON smm_reviews
  FOR DELETE USING (auth.uid()::text = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS smm_reviews_created_at_idx ON smm_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS smm_reviews_user_id_idx ON smm_reviews (user_id);
