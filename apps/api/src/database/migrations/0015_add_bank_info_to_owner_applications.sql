ALTER TABLE owner_applications
  ADD COLUMN IF NOT EXISTS bank_bin TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_no TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Đồng bộ thông tin tài khoản ngân hàng cho hồ sơ chủ sân của Tran Van Tuyen (nếu có)
UPDATE owner_applications
SET bank_bin = '970415', bank_name = 'VietinBank', account_no = '0376354782', account_name = 'TRAN VAN TUYEN'
WHERE user_id = '01a1c4df-96e2-7664-9e5f-6cd20f05c711' AND bank_bin IS NULL;

-- Đồng bộ tài khoản nhận tiền cho cơ sở của Tran Van Tuyen vào venue_payment_accounts
INSERT INTO venue_payment_accounts (venue_id, bank_bin, account_no, account_name)
SELECT id, '970415', '0376354782', 'TRAN VAN TUYEN'
FROM venues
WHERE owner_id = '01a1c4df-96e2-7664-9e5f-6cd20f05c711'
ON CONFLICT (venue_id) DO UPDATE
SET bank_bin = EXCLUDED.bank_bin, account_no = EXCLUDED.account_no, account_name = EXCLUDED.account_name;
