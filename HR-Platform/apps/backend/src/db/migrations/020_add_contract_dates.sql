-- =============================================
-- 020: Add contract start/end dates to employees
-- Xodim shartnomasining boshlanish va tugash sanalari.
-- Tugashiga 2 oy qolganda xodim ro'yxatda qizil rang bilan
-- ajratiladi va ro'yxat boshiga chiqariladi.
-- =============================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;

COMMENT ON COLUMN employees.contract_start_date IS 'Shartnoma boshlanish sanasi';
COMMENT ON COLUMN employees.contract_end_date IS 'Shartnoma tugash sanasi';
