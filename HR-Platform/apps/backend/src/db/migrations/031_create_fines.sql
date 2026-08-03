-- =============================================
-- 031: JARIMA SIYOSATLARI VA JAZO TURLARI
-- =============================================
-- Ilgari "Jarima yaratish" va "Jazo yaratish" faqat brauzer xotirasida
-- (React state) ishlar edi — sahifa yangilansa yo'qolib ketardi, hech
-- qanday bazaga saqlanmasdi. Endi ikkalasi ham haqiqiy jadvallarga
-- yoziladi.

-- "Jazo turi" — jarima siyosati shabloniga biriktiriladigan chora
-- (masalan "Ogohlantirish"). "Jazo yaratish" tugmasi shu yerga qo'shadi.
CREATE TABLE IF NOT EXISTS fine_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL UNIQUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fine_types IS 'Jazo turlari katalogi (masalan "Ogohlantirish") — "Jazo yaratish" tugmasi orqali to''ldiriladi';

-- "Jarima" — nomlangan siyosat (masalan "Sotuvchilar, ofitsiantlar"),
-- bir nechta shablonni o'z ichiga oladi.
CREATE TABLE IF NOT EXISTS fine_policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fine_policies IS '"Jarima yaratish" orqali sozlangan jarima siyosati (nomi + shablonlar to''plami)';

-- Har bir siyosat ichidagi "sabab -> chora" shabloni (masalan:
-- Kech kelish, 00:15 dan keyin, 50000 so'm, Ogohlantirish).
CREATE TABLE IF NOT EXISTS fine_policy_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES fine_policies(id) ON DELETE CASCADE,
  violation_type  VARCHAR(30) NOT NULL
                    CHECK (violation_type IN ('kech_kelish', 'erta_ketish', 'chiqish_yoq', 'kelmagan_kun')),
  time_limit      VARCHAR(5),
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  fine_type_id    UUID REFERENCES fine_types(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fine_policy_templates_policy ON fine_policy_templates(policy_id);

COMMENT ON TABLE fine_policy_templates IS 'Jarima siyosati ichidagi har bir sabab->chora shabloni (Turi, Vaqt chegarasi, Miqdor, Jazo turi)';
