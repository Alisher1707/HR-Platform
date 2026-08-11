-- =============================================
-- 025: ISH JADVALLARI (WORK SCHEDULES) VA XODIMGA BIRIKTIRISH
-- =============================================

CREATE TABLE IF NOT EXISTS work_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(150) NOT NULL,
  type              VARCHAR(20) NOT NULL DEFAULT 'moslashuvchan'
                      CHECK (type IN ('moslashuvchan', 'gibrid', 'erkin')),
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  cycle_days        INTEGER NOT NULL DEFAULT 7,
  count_overtime    BOOLEAN NOT NULL DEFAULT false,
  deduct_break      BOOLEAN NOT NULL DEFAULT false,
  extended_hours    INTEGER NOT NULL DEFAULT 0,
  limit_type        VARCHAR(20),
  limit_hours       INTEGER,
  shift_limit_hours INTEGER,
  is_work_day       BOOLEAN NOT NULL DEFAULT true,
  start_time        TIME,
  end_time          TIME,
  break_start       TIME,
  break_end         TIME,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE work_schedules IS 'Ish jadvali shablonlari (Ish jadvallari bo''limida yaratiladi)';

-- Bir jadval bir nechta xodimga, xodim esa bir nechta jadvalga biriktirilishi mumkin.
CREATE TABLE IF NOT EXISTS work_schedule_employees (
  schedule_id  UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (schedule_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_work_schedule_employees_employee
  ON work_schedule_employees(employee_id);

-- Davomat yozuvi qaysi jadvalga nisbatan baholanganini va kechikkan-kechikmaganini bilish uchun.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_late BOOLEAN;
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN attendance_records.is_late IS 'Xodimning biriktirilgan jadvali boshlanish vaqtidan kech kelgani (faqat "keldi" yozuvlari uchun hisoblanadi)';
COMMENT ON COLUMN attendance_records.schedule_id IS 'Yozuv yaratilgan paytda xodimga biriktirilgan bo''lgan jadval';
