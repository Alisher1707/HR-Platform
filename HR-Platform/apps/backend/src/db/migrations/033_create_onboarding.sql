-- =============================================
-- 033: ONBOARDING TIZIMI
-- =============================================
-- Yangi xodimlar uchun moslashuv rejalari. Har bir "reja" (onboarding_plans)
-- tartiblangan bosqichlar (onboarding_plan_steps) ro'yxatidan iborat. Reja
-- xodimga biriktirilganda (onboarding_assignments) shu xodim uchun maxsus,
-- login talab qilmaydigan ommaviy havola (public_token) yaratiladi — xodim
-- shu havola orqali o'z bosqichlarini (onboarding_step_completions) birma-bir
-- belgilab boradi.

CREATE TABLE IF NOT EXISTS onboarding_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onboarding_plans IS 'Onboarding rejasi nomi va tavsifi - bosqichlari onboarding_plan_steps jadvalida';

CREATE TABLE IF NOT EXISTS onboarding_plan_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_steps_plan ON onboarding_plan_steps(plan_id);

CREATE TABLE IF NOT EXISTS onboarding_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  public_token  VARCHAR(64) NOT NULL UNIQUE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

COMMENT ON TABLE onboarding_assignments IS 'Xodimga biriktirilgan reja - public_token orqali login talab qilinmaydigan shaxsiy havola beriladi';

CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_plan ON onboarding_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_employee ON onboarding_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_token ON onboarding_assignments(public_token);

CREATE TABLE IF NOT EXISTS onboarding_step_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID NOT NULL REFERENCES onboarding_assignments(id) ON DELETE CASCADE,
  step_id        UUID NOT NULL REFERENCES onboarding_plan_steps(id) ON DELETE CASCADE,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assignment_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_completions_assignment ON onboarding_step_completions(assignment_id);
