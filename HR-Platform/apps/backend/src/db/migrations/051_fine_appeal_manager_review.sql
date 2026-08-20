-- =============================================
-- 051: ARIZANI RAHBARGA YUBORISH (BOT ORQALI TASDIQLASH)
-- =============================================
-- HR endi arizani Rahbarning Telegram botiga yuborishi mumkin — Rahbar
-- o'sha yerdan to'g'ridan-to'g'ri Tasdiqlash/Rad etish tugmalarini bosadi.
-- Rahbar HR web-panelga kirmagani uchun (u shunchaki bog'langan xodim)
-- uning ko'rib chiqishi alohida ustunda (reviewed_by_employee_id) —
-- users.id talab qiladigan mavjud reviewed_by'dan farqli — kuzatiladi.

ALTER TABLE fine_appeals
  ADD COLUMN IF NOT EXISTS forwarded_to_manager_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN fine_appeals.forwarded_to_manager_at IS 'HR arizani Rahbar botiga yuborgan vaqt (hali qaror qabul qilinmagan bo''lishi ham mumkin)';
COMMENT ON COLUMN fine_appeals.reviewed_by_employee_id IS 'Agar ariza Rahbar tomonidan bot orqali ko''rib chiqilgan bo''lsa — o''sha xodim; HR web-panel orqali ko''rib chiqsa reviewed_by (users) ishlatiladi, bu ustun bo''sh qoladi';

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_bot_manager BOOLEAN NOT NULL DEFAULT false;

-- Bir vaqtning o'zida faqat bitta xodim "Rahbar" bo'lishi mumkin.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_bot_manager
  ON employees ((is_bot_manager)) WHERE is_bot_manager = true;

COMMENT ON COLUMN employees.is_bot_manager IS 'true bo''lsa — shu xodim arizalarni Telegram bot orqali tasdiqlovchi Rahbar hisoblanadi (faqat bitta xodimda true bo''lishi mumkin)';

UPDATE employees SET is_bot_manager = true
WHERE first_name = 'Abdulla' AND last_name = 'Ergashev';
