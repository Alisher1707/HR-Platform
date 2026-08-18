-- =============================================
-- 050: ARIZAGA "VAZIFA TOPSHIRISH" MAYDONLARI
-- =============================================
-- "Ishga kelmagan kun" va "Ishdan ertaroq ketish" turidagi arizalarda bot
-- endi yana ikkita savol beradi: vazifalarini kimga topshiradi va ishga
-- aniq qachon qaytadi. Boshqa turlar (Kechikib qolish, Javob so'rash...)
-- uchun bu maydonlar bo'sh qoladi.

ALTER TABLE fine_appeals
  ADD COLUMN IF NOT EXISTS handover_person TEXT,
  ADD COLUMN IF NOT EXISTS return_at TIMESTAMPTZ;

COMMENT ON COLUMN fine_appeals.handover_person IS 'Xodim vazifasini kimga topshirgani (F.I.Sh, botda so''ralgan) — faqat kelmagan_kun/erta_ketish turlarida to''ldiriladi';
COMMENT ON COLUMN fine_appeals.return_at IS 'Xodim ishga aniq qachon qaytishi (botda so''ralgan, Toshkent vaqti UTC ga aylantirilgan) — faqat kelmagan_kun/erta_ketish turlarida to''ldiriladi';
