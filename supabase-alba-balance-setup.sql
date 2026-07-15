-- 알바비 잔액 거래 내역
CREATE TABLE IF NOT EXISTS alba_balance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'usage')),
  amount INTEGER NOT NULL,
  description TEXT,
  task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alba_balance_transactions_user_id_idx ON alba_balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS alba_balance_transactions_created_at_idx ON alba_balance_transactions(created_at DESC);

-- RLS
ALTER TABLE alba_balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own" ON alba_balance_transactions FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "service_all"   ON alba_balance_transactions USING (true) WITH CHECK (true);

-- 앱 전역 설정 (계좌번호 등)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all"    ON app_settings FOR SELECT USING (true);
CREATE POLICY "service_all" ON app_settings USING (true) WITH CHECK (true);
