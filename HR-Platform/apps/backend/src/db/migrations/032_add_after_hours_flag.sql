-- =============================================
-- 032: ISH VAQTI TUGAGANDAN KEYIN KELISHNI ALOHIDA BELGILASH
-- =============================================
-- Ilgari "keldi" yozuvi jadvalning boshlanish vaqtidan keyin bo'lsa,
-- necha soat kech qolganidan qat'i nazar har doim "Kech keldi" deb
-- ko'rsatilardi — hatto ish kuni allaqachon TUGAGANDAN keyin (masalan
-- 18:00 da tugaydigan ish kuniga 19:10 da kelsa) ham xuddi shu "Kech
-- keldi" belgisi chiqardi. Bu ikkisi bir xil emas: biri chindan ham
-- kech qolish, ikkinchisi esa ish kuni allaqachon tugab bo'lgandan
-- keyin kelish. is_late hisobot/statistika uchun o'zgarishsiz qoladi —
-- is_after_hours esa faqat Davomat jadvalida "Kech keldi" o'rniga
-- oddiy "Keldi" ko'rsatish uchun qo'shimcha belgi.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_after_hours BOOLEAN;

COMMENT ON COLUMN attendance_records.is_after_hours IS
  'true bo''lsa, "keldi" yozuvi shu kunning ish tugash vaqtidan KEYIN qilingan — Davomat jadvalida "Kech keldi" o''rniga oddiy "Keldi" ko''rsatiladi';
