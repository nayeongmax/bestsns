-- ============================================================
-- 자유게시판 자동 게시 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 게시글 풀 (미리 작성해 둔 글 목록)
CREATE TABLE IF NOT EXISTS auto_post_pool (
  id            SERIAL PRIMARY KEY,
  category      TEXT NOT NULL DEFAULT '자유게시판',
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  author        TEXT NOT NULL DEFAULT '베스트SNS',
  is_used       BOOLEAN NOT NULL DEFAULT false,
  random_order  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 자동 게시 스케줄 설정 (다음 게시 시각 저장)
CREATE TABLE IF NOT EXISTS auto_post_config (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  next_post_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 비활성화 (Netlify 함수의 service_role 키로 접근)
ALTER TABLE auto_post_pool   DISABLE ROW LEVEL SECURITY;
ALTER TABLE auto_post_config DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 샘플 게시글 (원하시는 내용으로 추가/수정하세요)
-- INSERT로 글을 미리 넣어두면 매일 순환하며 자동 게시됩니다.
-- ============================================================
INSERT INTO auto_post_pool (category, title, content, author, random_order) VALUES
('자유게시판', '인스타그램 팔로워 늘리는 현실적인 방법', '인스타그램 팔로워를 늘리는 데 있어 가장 중요한 건 꾸준함입니다. 매일 1~2개의 게시물을 올리고, 해시태그를 적절히 활용하면 자연스러운 성장이 가능합니다.', '베스트SNS', 1),
('자유게시판', '블로그 상위노출을 위한 핵심 키워드 전략', '블로그 상위노출의 핵심은 경쟁이 낮고 검색량이 적당한 키워드를 찾는 것입니다. 롱테일 키워드를 공략하면 초반에도 충분히 노출 효과를 볼 수 있습니다.', '베스트SNS', 2),
('자유게시판', '유튜브 알고리즘 이해하기', '유튜브 알고리즘은 시청 시간과 클릭률(CTR)을 가장 중요하게 봅니다. 썸네일과 제목을 매력적으로 만들고, 영상 초반 30초 안에 핵심 내용을 담아야 합니다.', '베스트SNS', 3),
('자유게시판', '스마트스토어 판매량 올리는 꿀팁', '스마트스토어에서 판매량을 높이려면 상품 대표 이미지의 품질이 매우 중요합니다. 깔끔한 흰 배경에 제품을 선명하게 찍고, 상세 페이지는 구매자가 궁금해할 내용을 빠짐없이 담으세요.', '베스트SNS', 4),
('자유게시판', 'SNS 마케팅 시작 전 꼭 알아야 할 것들', 'SNS 마케팅을 시작하기 전에 먼저 타깃 고객이 누구인지 명확히 정의해야 합니다. 타깃이 주로 사용하는 플랫폼에 집중하는 것이 분산된 전략보다 훨씬 효과적입니다.', '베스트SNS', 5),
('자유게시판', '카페 회원 늘리는 방법 총정리', '네이버 카페 회원을 늘리기 위해서는 꾸준한 양질의 게시글이 핵심입니다. 회원들이 실제로 도움받을 수 있는 정보를 제공하면 자연스럽게 추천과 공유로 이어집니다.', '베스트SNS', 6),
('자유게시판', '온라인 부업으로 월 50만원 버는 현실적인 방법', '온라인 부업으로 꾸준히 수익을 내려면 한 가지 분야를 깊이 파고드는 것이 중요합니다. 블로그, 유튜브, SNS 중 자신에게 맞는 채널을 선택하고 6개월 이상 꾸준히 해보세요.', '베스트SNS', 7),
('자유게시판', '디지털 마케팅 트렌드 2025', '2025년 디지털 마케팅의 핵심은 숏폼 콘텐츠와 AI 활용입니다. 릴스, 쇼츠 등 짧은 영상으로 빠르게 주목을 끌고, AI 도구를 활용해 콘텐츠 제작 시간을 줄이는 것이 경쟁력입니다.', '베스트SNS', 8),
('자유게시판', '리뷰 마케팅의 중요성', '온라인 쇼핑에서 구매 결정의 80% 이상이 리뷰에 의해 이루어집니다. 진정성 있는 리뷰를 모으고 적극적으로 활용하면 전환율을 크게 높일 수 있습니다.', '베스트SNS', 9),
('자유게시판', '인플루언서 협업 시 주의할 점', '인플루언서와 협업할 때는 팔로워 수보다 참여율(Engagement Rate)을 먼저 확인하세요. 팔로워 1만 명이지만 댓글과 좋아요가 활발한 마이크로 인플루언서가 더 효과적인 경우가 많습니다.', '베스트SNS', 10);

-- 초기 게시 시각 설정 (지금 바로 게시 시작)
INSERT INTO auto_post_config (id, next_post_at)
VALUES (1, now())
ON CONFLICT (id) DO UPDATE SET next_post_at = now();
