-- 채널판매 이용 후기 테이블
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS channel_reviews (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  user_nickname TEXT        NOT NULL DEFAULT '',
  product_id    TEXT        NOT NULL DEFAULT '',
  product_name  TEXT        NOT NULL DEFAULT '',
  platform      TEXT        NOT NULL DEFAULT '',
  rating        INTEGER     NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  content       TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE channel_reviews ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (공개 리뷰)
CREATE POLICY "channel_reviews_select_all" ON channel_reviews
  FOR SELECT USING (true);

-- 로그인한 사용자만 자신의 리뷰 작성 가능
CREATE POLICY "channel_reviews_insert_own" ON channel_reviews
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
