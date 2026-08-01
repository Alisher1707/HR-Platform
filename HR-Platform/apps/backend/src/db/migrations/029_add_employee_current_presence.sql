-- =============================================
-- 029: XODIMNING HOZIRGI JOYLASHUVI (ICHKARIDA/TASHQARIDA)
-- =============================================
-- Har bir Davomat (keldi/ketdi) yozuvi qo'shilganda yoki o'chirilganda
-- avtomatik qayta hisoblanadi (eng oxirgi yozuv vaqtiga qarab — qo'lda
-- orqaga sanaga kiritilgan yozuv xato ravishda "hozirgi holat"ni
-- o'zgartirib yubormasligi uchun).

ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_presence VARCHAR(10)
  CHECK (current_presence IN ('ichkarida', 'tashqarida'));

COMMENT ON COLUMN employees.current_presence IS 'Xodimning hozirgi joylashuvi — eng oxirgi Davomat yozuvi turiga qarab avtomatik yangilanadi, qo''lda tahrirlanmaydi';

-- Mavjud xodimlar uchun dastlabki qiymatni eng oxirgi Davomat yozuvidan hisoblash
UPDATE employees e
SET current_presence = CASE latest.type WHEN 'keldi' THEN 'ichkarida' WHEN 'ketdi' THEN 'tashqarida' END
FROM (
  SELECT DISTINCT ON (employee_id) employee_id, type
  FROM attendance_records
  ORDER BY employee_id, recorded_at DESC
) latest
WHERE latest.employee_id = e.id;
