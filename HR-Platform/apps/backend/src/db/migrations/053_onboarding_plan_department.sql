-- =============================================
-- 053: ONBOARDING REJALARINI BO'LIM BO'YICHA AJRATISH
-- =============================================
-- Har bir bo'lim (masalan "oquv", "sotuv") o'zining alohida onboarding
-- rejasiga ega bo'lishi mumkin. NULL = "Umumiy" (barcha bo'limlar uchun
-- baravar tegishli) reja — masalan hammaga tegishli "Ish qoidalari".

ALTER TABLE onboarding_plans
  ADD COLUMN IF NOT EXISTS department VARCHAR(100);

COMMENT ON COLUMN onboarding_plans.department IS 'NULL = barcha bolimlar uchun umumiy reja; aks holda employees.department bilan mos qiymat';
