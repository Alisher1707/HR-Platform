-- =============================================
-- 036: "HUJJAT" VAZIFALARI UCHUN FAYL MAYDONI
-- =============================================
-- "Hujjat" turidagi vazifalarga PDF/DOC/DOCX fayl biriktirish imkoniyati.

ALTER TABLE onboarding_step_tasks ADD COLUMN IF NOT EXISTS document_url VARCHAR(500);
ALTER TABLE onboarding_step_tasks ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);
