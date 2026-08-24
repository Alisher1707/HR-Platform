-- =============================================
-- 057: ONBOARDING OMMAVIY HAVOLASIGA AMAL QILISH MUDDATI
-- =============================================
-- Muammo: onboarding_assignments.public_token hech qachon eskirmasdi va
-- uni HR qo'lda bekor qilishning ham imkoni yo'q edi — xodim ishdan
-- ketgandan keyin ham havola abadiy ishlayverardi.
--
-- Yechim: har bir biriktirishga yaratilgan kundan 90 kun keyin tugaydigan
-- expires_at qo'yiladi (odatiy onboarding davridan ancha keng muhlat —
-- mavjud faol havolalarni sindirmaslik uchun ham shu qiymat bilan
-- backfill qilinadi). Tekshiruv getAssignmentByToken/submitTask ichida.
-- Havolani muddatidan oldin butunlay to'xtatish kerak bo'lsa, mavjud
-- "Biriktirishni o'chirish" (deleteAssignment) buning uchun yetarli.
-- Qarang: apps/backend/src/modules/onboarding/onboarding.service.js

ALTER TABLE onboarding_assignments
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE onboarding_assignments
SET expires_at = created_at + INTERVAL '90 days'
WHERE expires_at IS NULL;

ALTER TABLE onboarding_assignments
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '90 days');
