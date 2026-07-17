-- =============================================
-- 017: Backfill candidate status
-- Havola orqali ariza topshirgan, lekin hali SHARTNOMA bosqichiga
-- o'tmagan nomzodlarga 'Nomzod' statusi beriladi —
-- ular Xodimlar bo'limida ko'rinmasligi kerak.
-- Invite orqali kelganlar application_history dagi
-- "Nomzod taklifnoma orqali ariza topshirdi" izohi bilan aniqlanadi.
-- =============================================

UPDATE employees
SET status = 'Nomzod',
    updated_at = NOW()
WHERE id IN (
  SELECT a.employee_id
  FROM applications a
  INNER JOIN application_history ah ON ah.application_id = a.id
  WHERE a.status <> 'SHARTNOMA'
    AND ah.comment LIKE 'Nomzod taklifnoma orqali ariza topshirdi%'
);
