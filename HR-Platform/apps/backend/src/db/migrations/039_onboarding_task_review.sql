-- =============================================
-- 039: HR TOPSHIRIQNI QABUL QILISHI / QAYTARISHI
-- =============================================
-- Xodim vazifani topshirgani hali "bajarildi" degani emas — HR uni
-- ko'rib chiqib, qabul qilishi yoki qaytarishi kerak. Progress foizi
-- endi faqat "approved" (qabul qilingan) vazifalarni hisobga oladi.

ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS review_comment TEXT;

ALTER TABLE onboarding_step_completions DROP CONSTRAINT IF EXISTS onboarding_step_completions_review_status_check;
ALTER TABLE onboarding_step_completions
  ADD CONSTRAINT onboarding_step_completions_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- Bu funksiya endigina qo'shilayotgani uchun mavjud topshiriqlar hali
-- HR tomonidan ko'rib chiqilmagan — hammasi "pending" bo'lib qoladi
-- (ustun DEFAULT'i orqali allaqachon shunday).
