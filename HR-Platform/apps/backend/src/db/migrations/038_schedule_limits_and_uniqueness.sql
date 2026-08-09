-- =============================================
-- 038: JADVAL TAKRORLANMASLIGI VA GIBRID/ERKIN SMENA LIMITI
-- =============================================
-- (1) Bitta xodim faqat bitta jadvalga tegishli bo'lishi kerak - ilgari
-- work_schedule_employees'da hech qanday cheklov yo'q edi, shuning uchun
-- xodim ehtiyotsizlik bilan 2+ jadvalga qo'shilib qolishi va qaysi
-- jadval "amal qilishi" tasodifiy (eng oxirgi tahrirlanган jadval)
-- bo'lib qolishi mumkin edi. employee_id ustida UNIQUE - buni bazada
-- kafolatlaydi; ilova qatlami esa endi "qo'shish" o'rniga "ko'chirish"
-- semantikasi bilan ishlaydi (schedules.service.js#assignEmployees).
-- Constraint qo'shishdan oldin mavjud takrorlarni tozalash (bo'lsa) - eng
-- so'nggi biriktirilgani qoladi, xuddi ilgarigi "eng oxirgisi g'olib"
-- tie-break'i kabi (schedules.service.js#getActiveScheduleForEmployee).
DELETE FROM work_schedule_employees wse
WHERE EXISTS (
  SELECT 1 FROM work_schedule_employees newer
  WHERE newer.employee_id = wse.employee_id
    AND (newer.created_at, newer.schedule_id) > (wse.created_at, wse.schedule_id)
);

ALTER TABLE work_schedule_employees DROP CONSTRAINT IF EXISTS work_schedule_employees_employee_id_key;
ALTER TABLE work_schedule_employees ADD CONSTRAINT work_schedule_employees_employee_id_key UNIQUE (employee_id);

-- (2) "Gibrid"/"Erkin" jadvallarda qat'iy boshlanish/tugash vaqti yo'q -
-- ular "Smena limit soatlari" asosida ishlaydi (bitta smena necha soatdan
-- oshmasligi kerak). Bu bayroq "ketdi" hodisasida hisoblanadi.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_over_shift_limit BOOLEAN;

-- Ilgari "Gibrid"/"Erkin" jadvallar ham (frontend formasi standart 7 kunlik
-- 09:00-18:00 qiymatini jo'natgani uchun) work_schedule_days'da mazmunsiz
-- qatorlarga ega bo'lgan - endi bu turlar uchun kunlar umuman saqlanmaydi
-- (IshJadvallariPage.jsx#scheduleToPayload), shuning uchun eskilarini ham
-- tozalaymiz.
DELETE FROM work_schedule_days
WHERE schedule_id IN (SELECT id FROM work_schedules WHERE type IN ('gibrid', 'erkin'));
