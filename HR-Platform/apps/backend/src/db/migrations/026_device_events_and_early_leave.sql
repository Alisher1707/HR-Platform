-- =============================================
-- 026: QURILMA HODISALARI JURNALI VA ERTA KETISH BELGISI
-- =============================================

-- Kameradan kelgan HAR BIR so'rovni (heartbeat, mos kelmagan, muvaffaqiyatli)
-- yozib boradi — Monitoring > Terminallar bo'limida qurilmalarning haqiqiy
-- faolligini (oxirgi ko'rilgan vaqtini) ko'rsatish uchun.
CREATE TABLE IF NOT EXISTS device_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token  VARCHAR(100) NOT NULL,
  event_type    VARCHAR(20) NOT NULL DEFAULT 'boshqa'
                  CHECK (event_type IN ('heartbeat', 'access', 'unmatched', 'boshqa')),
  person_id     VARCHAR(50),
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_events_token_time
  ON device_events(device_token, received_at DESC);

COMMENT ON TABLE device_events IS 'Har bir qurilma (kamera) so''rovining yengil jurnali — Terminallar bo''limidagi faollik ko''rsatkichi uchun';

-- "ketdi" yozuvi xodimning jadvalidagi tugash vaqtidan oldin bo'lganini
-- bildiradi (Hisobotlardagi "Erta ketishlar" ustuni uchun).
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_early_leave BOOLEAN;

COMMENT ON COLUMN attendance_records.is_early_leave IS 'Xodim jadvalidagi tugash vaqtidan oldin ketganini bildiradi (faqat "ketdi" yozuvlari uchun hisoblanadi)';
