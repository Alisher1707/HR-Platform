-- =============================================
-- 028: RO'YXATDAN O'TGAN QURILMALAR (TERMINALLAR)
-- =============================================
-- Ilgari Terminallar ro'yxati faqat kameradan kelgan xom hodisalardan
-- (device_events) chiqarilar edi — hech qanday qurilmani "yaratib",
-- token generatsiya qilib bo'lmasdi. Bu jadval endi qurilmani rasmiy
-- ro'yxatdan o'tkazish (nomi + avtomatik generatsiya qilingan token) uchun.

CREATE TABLE IF NOT EXISTS devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  token       VARCHAR(64) NOT NULL UNIQUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE devices IS 'Ro''yxatdan o''tkazilgan kamera/terminal qurilmalari — Monitoring > Terminallar bo''limida "Qurilma yaratish" orqali qo''shiladi, tokeni avtomatik generatsiya qilinadi';
COMMENT ON COLUMN devices.token IS 'Kamera /api/v1/devices/:token/events ga so''rov yuborishda ishlatadigan noyob token';
