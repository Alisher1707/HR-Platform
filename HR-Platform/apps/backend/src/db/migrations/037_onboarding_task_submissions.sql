-- =============================================
-- 037: VAZIFANI "TOPSHIRISH" — XODIM ISHINI YUBORISHI
-- =============================================
-- Xodim endi vazifani shunchaki belgilab qo'ymaydi — matn, fayl yoki
-- havola sifatida ishini topshiradi. Bitta topshiriq — bitta
-- onboarding_step_completions qatoriga yoziladi (assignment_id, task_id
-- ustida UNIQUE constraint allaqachon bor).

ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS submission_type VARCHAR(20);
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS submission_text TEXT;
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS submission_file_url VARCHAR(500);
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS submission_file_name VARCHAR(255);
ALTER TABLE onboarding_step_completions ADD COLUMN IF NOT EXISTS submission_link VARCHAR(500);

ALTER TABLE onboarding_step_completions DROP CONSTRAINT IF EXISTS onboarding_step_completions_submission_type_check;
ALTER TABLE onboarding_step_completions
  ADD CONSTRAINT onboarding_step_completions_submission_type_check
  CHECK (submission_type IS NULL OR submission_type IN ('text', 'file', 'link'));
