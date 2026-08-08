-- =============================================
-- 034: ONBOARDING BOSQICHLARI ICHIDA VAZIFALAR (video/matn)
-- =============================================
-- Har bir "bosqich" (onboarding_plan_steps) endi o'zi bevosita bir nom
-- emas, balki bir nechta "vazifa" (onboarding_step_tasks) uchun konteyner -
-- har bir vazifa turi (video/matn), nomi, YouTube havolasi (video bo'lsa)
-- va ko'rsatmasi bilan alohida. Xodim shu vazifalarni birma-bir belgilab
-- boradi, shuning uchun onboarding_step_completions endi bosqichga emas,
-- to'g'ridan-to'g'ri vazifaga bog'lanadi.

-- Bosqich endi o'zi nom/tavsifga ega emas - shunchaki vazifalar uchun
-- konteyner, shuning uchun eski title ustuni endi majburiy emas.
ALTER TABLE onboarding_plan_steps ALTER COLUMN title DROP NOT NULL;

CREATE TABLE IF NOT EXISTS onboarding_step_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id      UUID NOT NULL REFERENCES onboarding_plan_steps(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'matn')),
  title        VARCHAR(200) NOT NULL,
  video_url    VARCHAR(500),
  description  TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_tasks_step ON onboarding_step_tasks(step_id);

COMMENT ON TABLE onboarding_step_tasks IS 'Bosqich ichidagi har bir vazifa - video yoki matn ko''rinishida, xodim buni belgilab boradi';

-- onboarding_step_completions hech qachon haqiqiy foydalanuvchi ma'lumoti
-- bilan to'lmagan (funksiya endigina ishlab chiqilgan), shuning uchun
-- ustunni to'g'ridan-to'g'ri qayta yaratish xavfsiz.
ALTER TABLE onboarding_step_completions DROP COLUMN IF EXISTS step_id;
ALTER TABLE onboarding_step_completions
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES onboarding_step_tasks(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_step_completions_assignment_task_unique'
  ) THEN
    ALTER TABLE onboarding_step_completions
      ADD CONSTRAINT onboarding_step_completions_assignment_task_unique UNIQUE (assignment_id, task_id);
  END IF;
END $$;
