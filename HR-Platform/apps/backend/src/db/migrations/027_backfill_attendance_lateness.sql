-- =============================================
-- 027: ESKI DAVOMAT YOZUVLARIDA KECHIKISH/ERTA-KETISHNI ORQAGA TO'LDIRISH
-- =============================================
-- Ilgari xodimga "Ish jadvallari"da jadval biriktirilmagan bo'lsa,
-- is_late/is_early_leave NULL bo'lib qolar edi (Analitika/Hisobotlarda
-- shu xodimlar "Kech qolish"/"O'z vaqtida kelish" ro'yxatlarida umuman
-- ko'rinmasdi). computeLateness/computeEarlyLeave endi jadval yo'q bo'lsa
-- standart 09:00-18:00 ga solishtiradi — bu yerda esa allaqachon yozib
-- bo'lingan eski NULL yozuvlarni xuddi shu mantiq bilan orqaga to'ldiramiz.

WITH employee_schedule AS (
  SELECT
    e.id AS employee_id,
    ws.id AS schedule_id,
    ws.is_work_day,
    ws.start_time,
    ws.end_time
  FROM employees e
  LEFT JOIN LATERAL (
    SELECT ws2.id, ws2.is_work_day, ws2.start_time, ws2.end_time
    FROM work_schedule_employees wse
    JOIN work_schedules ws2 ON ws2.id = wse.schedule_id
    WHERE wse.employee_id = e.id
    ORDER BY wse.created_at DESC
    LIMIT 1
  ) ws ON true
)
UPDATE attendance_records ar
SET
  is_late = CASE
    WHEN ar.type <> 'keldi' OR ar.is_late IS NOT NULL THEN ar.is_late
    WHEN es.is_work_day = false THEN NULL
    ELSE (ar.recorded_at::time > COALESCE(es.start_time, '09:00'::time))
  END,
  is_early_leave = CASE
    WHEN ar.type <> 'ketdi' OR ar.is_early_leave IS NOT NULL THEN ar.is_early_leave
    WHEN es.is_work_day = false THEN NULL
    ELSE (ar.recorded_at::time < COALESCE(es.end_time, '18:00'::time))
  END,
  schedule_id = COALESCE(ar.schedule_id, es.schedule_id)
FROM employee_schedule es
WHERE ar.employee_id = es.employee_id
  AND (
    (ar.type = 'keldi' AND ar.is_late IS NULL)
    OR (ar.type = 'ketdi' AND ar.is_early_leave IS NULL)
  );
