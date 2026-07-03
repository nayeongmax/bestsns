-- franchise_plans 기본 데이터 복구
-- Supabase SQL Editor에서 실행하세요.
-- 이미 있는 데이터는 덮어쓰지 않음 (ON CONFLICT DO NOTHING)

INSERT INTO franchise_plans (id, name, price, original_price, period, features, is_active, sort_order)
VALUES
  ('basic', '기본 플랜', 39000, NULL, '월',
   '["매출관리","원고시트","원고수집기","마케팅상품 주문","카카오톡 기본 지원"]'::jsonb,
   true, 0),
  ('premium', '프리미엄 플랜', 79000, NULL, '월',
   '["기본 플랜 전체 포함","우선 지원 (당일 응답)","맞춤 원고 컨설팅 월 2회","월 1회 전략 미팅 (30분)"]'::jsonb,
   true, 1)
ON CONFLICT (id) DO NOTHING;
