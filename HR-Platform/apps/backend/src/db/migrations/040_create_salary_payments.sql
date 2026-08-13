-- =============================================
-- 040: ISH HAQI TO'LOVLARI (SALARY PAYMENTS)
-- =============================================
-- Ilgari "Ish haqi to'lovini qo'shish" faqat brauzer xotirasida (React
-- state) ishlar edi — sahifa yangilansa yo'qolib ketardi. Endi haqiqiy
-- jadvalga yoziladi.

CREATE TABLE IF NOT EXISTS salary_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(year, month);

COMMENT ON TABLE salary_payments IS 'Xodimga qilingan ish haqi to''lovlari — "Ish haqi to''lovini qo''shish" tugmasi orqali to''ldiriladi';
