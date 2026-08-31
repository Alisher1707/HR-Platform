-- =============================================
-- 060: XODIMNI ARXIVLASH (SOFT DELETE)
-- =============================================
-- XAVFSIZLIK-AUDIT.md (2-pass, data integrity #4).
--
-- `DELETE FROM employees` bitta qatorda ishlaydi, va employees'ga
-- bog'langan deyarli barcha jadval ON DELETE CASCADE bilan ulangan
-- (salary_payments, employee_fines, attendance_records, applications,
-- fine_appeals, onboarding_assignments, work_schedule_employees...).
-- Ya'ni bitta tasodifiy bosish xodimning BUTUN moliyaviy va yuridik
-- tarixini — to'langan maoshlar, yozilgan jarimalar, davomat yozuvlari —
-- qaytarib bo'lmaydigan tarzda yo'q qilardi. 2-pass'da bu amal audit
-- jurnaliga ulandi (nima yo'qolgani endi qayd etiladi), lekin
-- YO'QOLISHNING O'ZI to'xtatilmagan edi. Bu migratsiya shuni yopadi.
--
-- Model — "arxivlash", butunlay o'chirish emas:
--   * tarixi BOR xodim (jarima/to'lov/davomat/ariza) hech qachon
--     jismonan o'chirilmaydi — `deleted_at` belgilanadi, qator
--     bazada qoladi, hisobotlar va moliyaviy tarix buzilmaydi;
--   * tarixi UMUMAN yo'q qator (masalan xato kiritilgan nomzod) —
--     haqiqiy DELETE bilan tozalanadi, chunki uni saqlashning ma'nosi
--     yo'q va u shunchaki ro'yxatni ifloslantiradi.
-- Qaysi yo'l tanlangani employees.service.js#deleteEmployee'da hal
-- qilinadi va audit_logs'ga yoziladi.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Faol xodimlar ro'yxati (eng ko'p ishlatiladigan so'rov) endi har doim
-- `deleted_at IS NULL` bilan filtrlanadi — qisman indeks aynan shu
-- so'rov uchun.
CREATE INDEX IF NOT EXISTS idx_employees_active
  ON employees (created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN employees.deleted_at IS 'NULL bo''lmasa — xodim arxivlangan: faol ro''yxatlarda va yangi amallarda (davomat, jarima, to''lov, bot) ko''rinmaydi, lekin mavjud tarixiy yozuvlari saqlanib qoladi.';
