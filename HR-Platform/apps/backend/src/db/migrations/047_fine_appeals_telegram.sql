-- =============================================
-- 047: JARIMAGA TUSHUNTIRISH XATI (APELLATSIYA) + TELEGRAM BOT ULANISHI
-- =============================================
-- Xodim endi Telegram bot orqali jarimaga sababini (kerak bo'lsa hujjat
-- bilan) yozib yuborishi, HR esa buni veb-panelda tasdiqlab (jarima bekor
-- bo'ladi) yoki rad etib javob berishi mumkin. Botning xodimga xabar
-- yuborishi uchun chat_id kerak (telegram_username buning uchun yetarli
-- emas — Bot API arbitrar @username'ga xabar yuborishga ruxsat bermaydi,
-- faqat botga /start bosgan foydalanuvchining chat_id'siga).

ALTER TABLE employee_fines
  ADD COLUMN IF NOT EXISTS status VARCHAR(15) NOT NULL DEFAULT 'faol'
    CHECK (status IN ('faol', 'bekor_qilindi'));

COMMENT ON COLUMN employee_fines.status IS 'faol — amalda, bekor_qilindi — apellatsiya tasdiqlanib jarima bekor qilingan';

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_link_code VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_telegram_chat_id
  ON employees(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_telegram_link_code
  ON employees(telegram_link_code) WHERE telegram_link_code IS NOT NULL;

COMMENT ON COLUMN employees.telegram_chat_id IS 'Xodim botga ulangach saqlanadigan Telegram chat_id — botdan unga xabar yuborish uchun shart';
COMMENT ON COLUMN employees.telegram_link_code IS 'HR yaratgan bir martalik bog''lash kodi — bot orqali yuborilgach chat_id''ga almashtiriladi va tozalanadi';

CREATE TABLE IF NOT EXISTS fine_appeals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_fine_id  UUID NOT NULL REFERENCES employee_fines(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,
  file_url          TEXT,
  file_name         TEXT,
  status            VARCHAR(12) NOT NULL DEFAULT 'kutilmoqda'
                      CHECK (status IN ('kutilmoqda', 'tasdiqlandi', 'rad_etildi')),
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fine_appeals_employee ON fine_appeals(employee_id);
CREATE INDEX IF NOT EXISTS idx_fine_appeals_status ON fine_appeals(status);

-- Bir jarimaga bir vaqtning o'zida faqat bitta "kutilmoqda" ariza bo'lishi mumkin
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fine_appeals_pending_per_fine
  ON fine_appeals(employee_fine_id) WHERE status = 'kutilmoqda';

COMMENT ON TABLE fine_appeals IS 'Xodim Telegram bot orqali yuborgan jarima tushuntirish xati (apellatsiya) — HR tasdiqlasa employee_fines.status bekor_qilindi bo''ladi';

-- Botning ko'p bosqichli suhbat holatini saqlaydi (xotirada emas — backend
-- tez-tez qayta ishga tushadigan loyiha, suhbat davomida yo'qolib qolmasin).
CREATE TABLE IF NOT EXISTS telegram_bot_sessions (
  chat_id     BIGINT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  state       VARCHAR(30),
  draft       JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE telegram_bot_sessions IS 'Har bir Telegram chat uchun joriy suhbat bosqichi va vaqtinchalik qoralama (masalan tanlangan jarima id, yozilgan sabab)';
