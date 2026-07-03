-- franchise_products 실제 데이터 복구 (마케팅상품 주문)
-- Supabase SQL Editor에서 실행하세요.

INSERT INTO franchise_products (id, name, description, price, original_price, min_quantity, max_quantity, category, is_hidden, sort_order)
VALUES
  ('fp_001',
   '올인원 마케팅 주문 (앱구동+검색조회수+게시글조회수)',
   '앱구독 3만+검색조회수 3만+게시글조회수 (1~100)',
   0, NULL, 1, 10000, '네이버카페', false, 0),
  ('fp_002',
   '올인원 마케팅 주문 (앱구동+검색조회수+게시글조회수)',
   '앱구독 10만+검색조회수 10만+게시글조회수 (101~300)',
   0, NULL, 1, 10000, '네이버카페', false, 1),
  ('fp_003',
   '올인원 마케팅 주문 (앱구동+검색조회수+게시글조회수)',
   '앱구독 30만+검색조회수 30만+게시글조회수 (301~)',
   0, NULL, 1, 10000, '네이버카페', false, 2)
ON CONFLICT (id) DO UPDATE
  SET name         = EXCLUDED.name,
      description  = EXCLUDED.description,
      price        = EXCLUDED.price,
      min_quantity = EXCLUDED.min_quantity,
      max_quantity = EXCLUDED.max_quantity,
      category     = EXCLUDED.category,
      is_hidden    = EXCLUDED.is_hidden,
      sort_order   = EXCLUDED.sort_order;
