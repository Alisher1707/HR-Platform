-- =============================================
-- 054: BO'LIMLAR (DEPARTMENTS) JADVALI
-- =============================================
-- Hozirgacha "bo'lim" faqat employees.department (erkin matn) orqali
-- mavjud edi — hech qanday xodimsiz yangi bo'lim yaratib bo'lmasdi
-- (masalan Onboarding rejasini oldindan tayyorlab qo'yish uchun).
-- Bu jadval bo'lim nomlarini alohida, xodimlardan mustaqil saqlaydi.
-- employees.department hamon erkin matn bo'lib qoladi (FK yo'q) — shu
-- jadval faqat "qaysi nomlar mavjud" ro'yxatini kengaytiradi.

CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mavjud xodimlarda allaqachon ishlatilayotgan bo'lim nomlarini
-- backfill qilish — ro'yxat bir xil manbadan (shu jadvaldan) kelsin.
INSERT INTO departments (name)
SELECT DISTINCT department FROM employees
WHERE department IS NOT NULL AND department <> ''
ON CONFLICT (name) DO NOTHING;
