-- =============================================
-- 021: Add interview attendance status to applications
-- Suhbatga chaqirilgan nomzod keldi yoki kelmadi —
-- HR modal oynada belgilaydi, Kanban kartasida ko'rinadi.
-- =============================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_status VARCHAR(10);

COMMENT ON COLUMN applications.interview_status IS 'Suhbat natijasi: KELDI yoki KELMADI (NULL — hali belgilanmagan)';
