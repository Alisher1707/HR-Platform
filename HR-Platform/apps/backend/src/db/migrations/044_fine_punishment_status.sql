-- =============================================
-- 044: JAZO BAJARILGANLIGINI BELGILASH
-- =============================================
-- HR endi har bir tayinlangan jarimaning "Jarima turi" (jazo — masalan
-- "30 daqiqalik qo'shimcha ish") xodim tomonidan haqiqatan bajarilgan-
-- bajarilmaganini, sababi bilan birga belgilab qo'yishi mumkin.

ALTER TABLE employee_fines
  ADD COLUMN IF NOT EXISTS punishment_status VARCHAR(15) CHECK (punishment_status IN ('bajarildi', 'bajarilmadi')),
  ADD COLUMN IF NOT EXISTS punishment_note TEXT,
  ADD COLUMN IF NOT EXISTS punishment_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS punishment_recorded_at TIMESTAMPTZ;

COMMENT ON COLUMN employee_fines.punishment_status IS 'Jazo turi (fine_type) xodim tomonidan bajarilganmi — "bajarildi"/"bajarilmadi"/null (hali belgilanmagan)';
COMMENT ON COLUMN employee_fines.punishment_note IS 'HR yozgan sabab — nega bajarildi yoki bajarilmadi';
