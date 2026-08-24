-- =============================================
-- 055: ONBOARDING BOSQICH/VAZIFALARINI "YO'QOTMASDAN OLIB TASHLASH"
-- =============================================
-- Muammo: reja tahrirlanganda (updatePlan) barcha bosqichlar DELETE qilinib
-- qaytadan INSERT qilinardi. onboarding_step_completions jadvali
-- onboarding_step_tasks(id) ga ON DELETE CASCADE bilan bog'langani uchun
-- HR bitta vazifa sarlavhasidagi imlo xatosini tuzatsa ham, o'sha rejaga
-- biriktirilgan BARCHA xodimlarning topshirgan ishlari (matn, fayl, ko'rib
-- chiqish holati) jimgina o'chib ketardi.
--
-- Yechim: endi tahrirlashda mavjud bosqich/vazifalar (id orqali) joyida
-- YANGILANADI, faqat rostdan olib tashlangan va hech qanday topshiriqqa
-- ega bo'lmagan qatorlar DELETE qilinadi. Topshiriqqa ega bo'lgan, lekin
-- HR tomonidan rejadan olib tashlangan qator esa "arxivlanadi"
-- (archived_at qo'yiladi) — o'chirilmaydi, faqat reja muharririda va yangi
-- biriktirishlarda ko'rinmay qoladi. Allaqachon shu vazifani topshirgan
-- xodimning tarixida esa (o'z biriktirishi bo'yicha) hamon ko'rinadi.
-- Qarang: apps/backend/src/modules/onboarding/onboarding.service.js#syncSteps

ALTER TABLE onboarding_plan_steps
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE onboarding_step_tasks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_steps_active
  ON onboarding_plan_steps (plan_id) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_step_tasks_active
  ON onboarding_step_tasks (step_id) WHERE archived_at IS NULL;
