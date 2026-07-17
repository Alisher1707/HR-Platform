-- =============================================
-- 016: Add resume fields to employees
-- Nomzod ariza topshirganda yuklagan rezyume fayli
-- =============================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resume_original_name VARCHAR(255);

COMMENT ON COLUMN employees.resume_url IS 'Rezyume faylining server yo''li (/uploads/resumes/...)';
COMMENT ON COLUMN employees.resume_original_name IS 'Rezyume faylining asl nomi (foydalanuvchi yuklagan)';
