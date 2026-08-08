-- =============================================
-- 035: VAZIFA TURLARINI KENGAYTIRISH (video/hujjat/harakat)
-- =============================================
-- "Matn" o'rniga ikkita aniqroq tur: "Hujjat" (masalan PDF/qoidalar bilan
-- tanishish) va "Harakat" (oddiy bajariladigan ish, tashqi havolasiz).

ALTER TABLE onboarding_step_tasks DROP CONSTRAINT IF EXISTS onboarding_step_tasks_type_check;
ALTER TABLE onboarding_step_tasks
  ADD CONSTRAINT onboarding_step_tasks_type_check CHECK (type IN ('video', 'hujjat', 'harakat'));

UPDATE onboarding_step_tasks SET type = 'harakat' WHERE type = 'matn';
