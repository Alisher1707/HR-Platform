-- =============================================
-- 043: AVTOMATIK JARIMA YOZISH
-- =============================================
-- Xodim jarima siyosatiga biriktirilgan bo'lsa (masalan "Kech kelish"),
-- tizim endi davomat qoidabuzarligini o'zi aniqlab, avtomatik jarima
-- yozadi — qo'lda "+" bosish shart emas. `source`/`policy_template_id`/
-- `violation_date` qaysi qoida asosida va qaysi kun uchun yozilganini
-- kuzatadi; qisman noyob indeks bir xil xodim/qoida/kun uchun ikki marta
-- jarima yozilishining oldini oladi (kron qayta ishga tushsa ham,
-- webhook takror kelsa ham xavfsiz).

ALTER TABLE employee_fines
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  ADD COLUMN IF NOT EXISTS policy_template_id UUID REFERENCES fine_policy_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS violation_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_fines_auto_dedup
  ON employee_fines (employee_id, policy_template_id, violation_date)
  WHERE source = 'auto';

COMMENT ON COLUMN employee_fines.source IS '"manual" — HR qo''lda qo''shgan, "auto" — tizim davomat asosida o''zi yozgan';
COMMENT ON COLUMN employee_fines.policy_template_id IS 'Avtomatik jarima qaysi jarima siyosati shabloni asosida yozilgani (faqat source=auto uchun)';
COMMENT ON COLUMN employee_fines.violation_date IS 'Qoidabuzarlik sodir bo''lgan biznes kuni (Toshkent vaqti) — avtomatik jarimalar uchun takrorlanishni oldini olish uchun';
