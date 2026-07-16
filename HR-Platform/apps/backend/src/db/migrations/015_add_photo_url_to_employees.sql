-- =============================================
-- 015: XODIM RASMI (Avatar / yuz tekshiruvi uchun)
-- =============================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN employees.photo_url IS 'Xodim rasmi (avatar) fayl manzili';
