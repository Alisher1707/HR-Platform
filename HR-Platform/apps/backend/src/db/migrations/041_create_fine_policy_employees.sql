-- =============================================
-- 041: JARIMA SIYOSATIGA XODIM BIRIKTIRISH
-- =============================================
-- "Jarima yaratish" muzardining 2-qadami (xodim tanlash) ilgari hech
-- qanday joyga saqlanmasdi — bu jadval shu bog'lanishni saqlaydi. Bitta
-- xodim bir nechta jarima siyosatiga tegishli bo'lishi mumkin (ish
-- jadvallaridan farqli o'laroq, shuning uchun employee_id'ga UNIQUE
-- qo'yilmagan).

CREATE TABLE IF NOT EXISTS fine_policy_employees (
  policy_id    UUID NOT NULL REFERENCES fine_policies(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (policy_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_fine_policy_employees_employee ON fine_policy_employees(employee_id);

COMMENT ON TABLE fine_policy_employees IS '"Jarima yaratish" 2-qadamida tanlangan xodimlar — qaysi jarima siyosati kimga tegishli';
