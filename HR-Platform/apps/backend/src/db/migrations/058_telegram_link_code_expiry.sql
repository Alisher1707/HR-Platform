-- =============================================
-- 058: TELEGRAM BOG'LASH KODIGA MUDDAT QO'SHISH
-- =============================================
-- XAVFSIZLIK-AUDIT.md K-4: bot chatni xodimga bog'lashda ilgari faqat
-- ketma-ket person_id'ni ("1000", "1001", ...) qabul qilardi — bu shaxsni
-- isbotlash emas, oddiy sanab chiqish edi. Endi bog'lash faqat HR
-- yaratgan, muddati cheklangan, bir martalik kod orqali amalga oshadi
-- (employees.telegram_link_code — ustun 047-migratsiyada qo'shilgan,
-- lekin kod darajasida hech qachon ishlatilmagan edi). Bu migratsiya shu
-- kodga muddat qo'shadi.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS telegram_link_code_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN employees.telegram_link_code_expires_at IS 'telegram_link_code shu vaqtdan keyin haqiqiy emas — HR "Telegram kodi yaratish" bosganda hozirgi vaqt+10 daqiqaga o''rnatiladi';
