-- =============================================
-- 042: XODIMGA TAYINLANGAN JARIMALAR
-- =============================================
-- "Tayinlangan jarimalar ro'yxati" ilgari faqat brauzer xotirasida
-- ishlar edi (sahifa yangilansa yo'qolardi, hech qanday fayl yoki
-- jarima turi bog'lanmasdi). Endi haqiqiy jadvalga yoziladi va
-- fine_types katalogiga, ixtiyoriy isbot fayliga bog'lanadi.

CREATE TABLE IF NOT EXISTS employee_fines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  fine_type_id  UUID REFERENCES fine_types(id) ON DELETE SET NULL,
  note          TEXT,
  file_url      TEXT,
  file_name     TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_fines_employee ON employee_fines(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_fines_created_at ON employee_fines(created_at);

COMMENT ON TABLE employee_fines IS 'Xodimga haqiqatan tayinlangan (tortilgan) jarimalar — "Tayinlangan jarimalar ro''yxati" shu yerdan o''qiydi';
