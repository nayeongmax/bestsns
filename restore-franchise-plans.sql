-- franchise_plans 실제 데이터 복구
-- Supabase SQL Editor에서 실행하세요.
-- ON CONFLICT DO UPDATE로 덮어쓰기 (기존 데이터 있어도 최신으로 갱신)

INSERT INTO franchise_plans (id, name, price, original_price, period, features, is_active, sort_order)
VALUES
  ('plan_basic', 'BASIC', 150000, 190000, '월',
   '["TO-DO LIST","매출/비용 관리","업체관리 시스템","BESTSNS SHEETS","원고수집 프로그램","마케팅 프로그램 주문 (12만 포인트)"]'::jsonb,
   true, 0),
  ('plan_premium', 'PREMIUM', 250000, 450000, '월',
   '["TO-DO LIST","매출/비용 관리","업체관리 시스템","BESTSNS SHEETS","원고수집 프로그램","마케팅 프로그램 주문 (18만 포인트)","카카오톡 1:1 상담지원"]'::jsonb,
   true, 1),
  ('plan_prestige', 'PRESTIGE', 1000000, 1600000, '월',
   '["TO-DO LIST","매출/비용 관리","업체관리 시스템","BESTSNS SHEETS","원고수집 프로그램","마케팅 프로그램 주문 (40만 포인트)","카카오톡 1:1 상담지원"]'::jsonb,
   true, 2)
ON CONFLICT (id) DO UPDATE
  SET name           = EXCLUDED.name,
      price          = EXCLUDED.price,
      original_price = EXCLUDED.original_price,
      period         = EXCLUDED.period,
      features       = EXCLUDED.features,
      is_active      = EXCLUDED.is_active,
      sort_order     = EXCLUDED.sort_order;
