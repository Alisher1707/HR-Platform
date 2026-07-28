-- =============================================
-- 022: KAMERA PERSON ID VA DAVOMAT YOZUVLARI
-- =============================================

-- Xodimni kameradagi yuz-shabloni ID'siga bog'lash uchun
ALTER TABLE employees ADD COLUMN IF NOT EXISTS person_id VARCHAR(50);

COMMENT ON COLUMN employees.person_id IS 'Yuz tanish kamerasida shu xodimga berilgan Employee ID (person_id)';

-- Bir xil person_id ikki xodimga tegishli bo'lib qolmasligi uchun
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_person_id
  ON employees(person_id)
  WHERE person_id IS NOT NULL;

-- Kameradan kelgan hodisalar asosida yoziladigan keldi/ketdi jadvali
CREATE TABLE IF NOT EXISTS attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          VARCHAR(10) NOT NULL CHECK (type IN ('keldi', 'ketdi')),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_token  VARCHAR(100),
  raw_person_id VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date
  ON attendance_records(employee_id, recorded_at);

COMMENT ON TABLE attendance_records IS 'Kameradan kelgan yuz-tanish hodisalari asosida yozilgan keldi/ketdi jurnali';
