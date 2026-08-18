-- =============================================
-- 048: BOT O'ZI BERADIGAN BOG'LASH KODI
-- =============================================
-- Avvalgi oqim (HR oldindan kod yaratib, xodimga tashqarida yuborishi)
-- ishonchsiz edi. Endi teskarisi: xodim botga /start bosganda BOT o'zi
-- unikal kod beradi (chat_id'ga bog'langan holda, hali hech qanday
-- xodimga tegishli emas) — xodim shu kodni HR'ga aytadi, HR esa
-- Xodim formasida shu kodni kiritib tasdiqlaydi (employees.telegram_link_code
-- endi ishlatilmaydi, lekin xavfsizlik uchun ustun bazada qoldiriladi).

ALTER TABLE telegram_bot_sessions
  ADD COLUMN IF NOT EXISTS pending_code VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_telegram_bot_sessions_pending_code
  ON telegram_bot_sessions(pending_code) WHERE pending_code IS NOT NULL;

COMMENT ON COLUMN telegram_bot_sessions.pending_code IS 'Bot tomonidan shu chatga berilgan, hali HR tomonidan tasdiqlanmagan bog''lash kodi';
