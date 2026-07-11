-- =============================================
-- 014: EJM JADVALIGA EMPLOYEE_ID QO'SHISH
-- =============================================

-- ejm_data jadvaliga employee_id ustuni qo'shish
ALTER TABLE ejm_data
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE CASCADE;

-- Index qo'shish
CREATE INDEX IF NOT EXISTS idx_ejm_data_employee ON ejm_data(employee_id);

-- Comment
COMMENT ON COLUMN ejm_data.employee_id IS 'EJM qaysi xodimga tegishli (employee-specific EJM uchun)';
