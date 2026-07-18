-- =============================================
-- 019: Add sinov (probation) start/end dates to applications
-- SINOV_MUDDATI bosqichidagi nomzod uchun sinov muddatining
-- boshlanish va tugash sanalari. Tugash kuni kelganda karta
-- doskada alohida rang bilan ajratiladi.
-- =============================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS sinov_start_date DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sinov_end_date DATE;

COMMENT ON COLUMN applications.sinov_start_date IS 'Sinov muddati boshlanish sanasi';
COMMENT ON COLUMN applications.sinov_end_date IS 'Sinov muddati tugash sanasi';
