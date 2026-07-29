-- =============================================
-- 023: DAVOMAT YOZUVLARINI KENGAYTIRISH (qo'lda kiritish uchun)
-- =============================================

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'device'
  CHECK (source IN ('device', 'manual'));

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN attendance_records.source IS 'Yozuv qayerdan kelgani: kameradan (device) yoki qo''lda (manual)';
COMMENT ON COLUMN attendance_records.notes IS 'Qo''lda kiritilgan yozuv uchun izoh';
COMMENT ON COLUMN attendance_records.created_by IS 'Qo''lda yozuv kiritgan foydalanuvchi';
