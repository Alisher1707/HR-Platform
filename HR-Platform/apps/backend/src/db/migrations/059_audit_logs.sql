-- =============================================
-- 059: IMTIYOZLI AMALLAR AUDIT JURNALI
-- =============================================
-- XAVFSIZLIK-AUDIT.md O-12 va P-8: (a) authorize() SUPER_ADMIN uchun
-- rol tekshiruvini so'zsiz aylanib o'tadi va (b) xodimning PNFL/maoshi
-- kabi nozik ma'lumotini kim qachon ko'rgani hech qayerda qayd
-- etilmasdi. Bu ikkalasi ham xavfsizlik teshigi emas edi (huquqlar
-- to'g'ri edi) — kuzatuv (observability) yo'q edi. Bu jadval o'sha
-- kuzatuvni beradi: har bir voqea kim (actor), qanday rol bilan, qaysi
-- amalni, qaysi resursda, qaysi IP'dan bajarganini saqlaydi.
--
-- Yozish har doim "best-effort, fire-and-forget" — auditLog.service.js
-- xato bo'lsa ham asosiy so'rovni hech qachon to'xtatmaydi (log
-- infratuzilmasi o'zi bitta yangi nosozlik nuqtasiga aylanmasligi
-- uchun).

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  ip_address VARCHAR(64),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eng ko'p ishlatiladigan so'rovlar: "shu foydalanuvchi nima qildi"
-- va "shu amal turi bo'yicha oxirgi voqealar" — vaqt bo'yicha kamayish
-- tartibida.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Imtiyozli amallar (SUPER_ADMIN bypass, nozik ma''lumot o''qishlari) uchun best-effort audit jurnali. Yozish muvaffaqiyatsiz bo''lsa ham asosiy so''rov davom etadi.';
COMMENT ON COLUMN audit_logs.action IS 'Masalan: auth.super_admin_bypass, employee.sensitive_read, payroll.sensitive_read';
