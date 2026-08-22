-- =============================================
-- 052: KUN ICHIDAGI "CHEGARA" SKANINI ANIQLASH
-- =============================================
-- Hozirgача har bir keldi/ketdi skani mustaqil baholanardi — shu sabab
-- tushlik uchun chiqib qaytgan xodim kuni davomida bir necha marta
-- "Kech keldi"/"Erta ketdi" deb belgilanib qolardi. Endi faqat kunning
-- HAQIQIY chegara skanlari (birinchi keldi, va kun tugagach tasdiqlangan
-- oxirgi ketdi) shu tarzda baholanadi; oraliq skanlar "Ichkarida"/
-- "Tashqarida" sifatida ko'rsatiladi.
--
--   'boundary' — kech qolish/erta ketish baholanadigan haqiqiy chegara
--                skani (birinchi keldi, yoki tasdiqlangan oxirgi ketdi)
--   'mid_day'  — kun davomidagi oraliq skan (tushlik va h.k.)
--   'pending'  — ketdi hali "oxirgimi yoki oraliqmi" deb hal qilinmagan,
--                jadval tugash vaqti kelguncha kutmoqda
--   NULL       — moslashuvchan bo'lmagan jadval (bu tushuncha tegishli
--                emas, eski xulq-atvor o'zgarishsiz qoladi)

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS day_boundary VARCHAR(10)
    CHECK (day_boundary IN ('boundary', 'mid_day', 'pending'));

COMMENT ON COLUMN attendance_records.day_boundary IS 'Ushbu skan kunning haqiqiy chegarasimi (boundary), oraliq (mid_day), yoki hali hal qilinmagan (pending) — faqat moslashuvchan jadval uchun ishlatiladi, aks holda NULL';
