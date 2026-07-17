-- =============================================
-- 018: Add interview date to applications
-- Nomzod suhbatga chaqirilganda (QOSHILDI bosqichi)
-- HR tomonidan belgilanadigan suhbat vaqti
-- =============================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_date TIMESTAMPTZ;

COMMENT ON COLUMN applications.interview_date IS 'Suhbat uchun belgilangan sana va vaqt';
