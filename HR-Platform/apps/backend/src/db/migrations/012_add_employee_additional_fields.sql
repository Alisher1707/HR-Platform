-- =============================================
-- 012: XODIMLAR JADVLIGA QO'SHIMCHA FIELDLAR
-- =============================================

-- Add employee number (unique identifier)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50);

-- Add position
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS position VARCHAR(100);

-- Add telegram username
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);

-- Create unique index for employee_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_number
ON employees(employee_number)
WHERE employee_number IS NOT NULL;

-- Create index for position queries
CREATE INDEX IF NOT EXISTS idx_employees_position
ON employees(position);

-- Create index for telegram username lookups
CREATE INDEX IF NOT EXISTS idx_employees_telegram
ON employees(telegram_username)
WHERE telegram_username IS NOT NULL;

-- Comments
COMMENT ON COLUMN employees.employee_number IS 'Xodim raqami (noyob identifikator)';
COMMENT ON COLUMN employees.position IS 'Lavozim';
COMMENT ON COLUMN employees.telegram_username IS 'Telegram foydalanuvchi nomi (@username)';
