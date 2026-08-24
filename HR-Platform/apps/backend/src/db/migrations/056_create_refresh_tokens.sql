-- =============================================
-- 056: REFRESH TOKENLARNI BAZADA KUZATISH
-- =============================================
-- Muammo: refresh token faqat JWT sifatida imzolanardi va hech qayerda
-- saqlanmasdi. "Chiqish" tugmasi faqat cookie'ni o'chirar edi — token
-- qiymatining o'zi hali 7 kun amal qilardi. Agar token o'g'irlansa yoki
-- xodim ishdan bo'shatilsa, uni bekor qilishning yagona yo'li
-- JWT_REFRESH_SECRET'ni almashtirish edi, bu esa BARCHA foydalanuvchini
-- bir vaqtda tizimdan chiqarib yuborardi.
--
-- Yechim: har bir refresh token endi o'zining tasodifiy jti (JWT ID)
-- qiymatini oladi va shu jadvalda qatorga ega bo'ladi. Yangilash (refresh)
-- har safar eskisini bekor qiladi va yangisini yozadi ("rotatsiya") — allaqachon
-- bekor qilingan tokenning qayta ishlatilishga urinishi endi aniqlanadi va
-- rad etiladi. "Chiqish" endi haqiqatan ham shu aniq tokenni bekor qiladi.
-- Qarang: apps/backend/src/modules/auth/auth.service.js

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY,                 -- JWT'ning jti da'vosi bilan bir xil
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Eskirgan (va allaqachon bekor qilingan) qatorlarni tez topish uchun —
-- vaqti-vaqti bilan tozalash (cleanup) shu indeksdan foydalanadi.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
