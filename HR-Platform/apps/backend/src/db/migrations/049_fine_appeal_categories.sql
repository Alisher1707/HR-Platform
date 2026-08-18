-- =============================================
-- 049: ARIZA TURLARI + PROAKTIV ARIZALAR + ID BILAN BOG'LANISH
-- =============================================
-- Endi xodim botga /start bosganda o'ziga tizimda berilgan ID raqamini
-- (employees.person_id — Xodimlar ro'yxatida "ID: 1038" tarzida ko'rinadi)
-- yuboradi va DARHOL o'z-o'zidan bog'lanadi — HR tomonidan alohida kod
-- yaratish/tasdiqlash shart emas. Shu sabab bot-generatsiya qiluvchi
-- pending_code mexanizmi (048-migratsiya) endi keraksiz.
ALTER TABLE telegram_bot_sessions DROP COLUMN IF EXISTS pending_code;

-- Ariza endi har doim mavjud jarimaga bog'lanishi shart emas — xodim hali
-- jarima yozilmagan bo'lsa ham (masalan bugungi kech qolishini oldindan
-- tushuntirish uchun) ariza yubora oladi. Bunday holda employee_fine_id
-- bo'sh (NULL) qoladi — HR ko'rib chiqadi, lekin avtomatik bekor
-- qilinadigan aniq jarima bo'lmaydi.
ALTER TABLE fine_appeals
  ALTER COLUMN employee_fine_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'umumiy'
    CHECK (category IN ('kech_kelish', 'erta_ketish', 'chiqish_yoq', 'kelmagan_kun', 'umumiy')),
  ADD COLUMN IF NOT EXISTS incident_date DATE;

COMMENT ON COLUMN fine_appeals.category IS 'Ariza turi — mavjud jarima siyosati turlariga mos (kech_kelish/erta_ketish/chiqish_yoq/kelmagan_kun) yoki umumiy (Javob so''rash)';
COMMENT ON COLUMN fine_appeals.incident_date IS 'Xodim tushuntirayotgan voqea sanasi (bot orqali kiritiladi) — mos jarimani avtomatik topish uchun ishlatiladi';

-- Mavjud jarimaga bog'liq bo'lmagan (proaktiv) arizalar uchun ham
-- takrorlanishning oldini olish — bir xodim bir xil tur+sana uchun bir
-- vaqtning o'zida faqat bitta kutilayotgan ariza yubora oladi.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fine_appeals_pending_proactive
  ON fine_appeals(employee_id, category, incident_date)
  WHERE status = 'kutilmoqda' AND employee_fine_id IS NULL;
