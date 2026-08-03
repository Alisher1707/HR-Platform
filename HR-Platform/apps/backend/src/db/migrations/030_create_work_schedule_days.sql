-- =============================================
-- 030: JADVALDA KO'P KUNLIK (KUN 1, KUN 2, ...) SOZLASH
-- =============================================
-- Ilgari har bir jadvalda faqat BITTA kun namunasi bor edi (ish_boshlanish/
-- tugash/tanaffus vaqtlari butun sikl davomida bir xil qo'llanilardi).
-- Endi har bir jadval sikl uzunligi (cycle_days) bo'yicha alohida-alohida
-- kunlar (Kun 1, Kun 2, ...) bilan sozlanadi — masalan smena grafigi
-- "2 kun ishlaydi, 2 kun dam oladi" kabi holatlar uchun.

CREATE TABLE IF NOT EXISTS work_schedule_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL CHECK (day_number >= 1),
  is_work_day   BOOLEAN NOT NULL DEFAULT true,
  start_time    TIME,
  end_time      TIME,
  break_start   TIME,
  break_end     TIME,
  UNIQUE (schedule_id, day_number)
);

COMMENT ON TABLE work_schedule_days IS 'Har bir jadvalning sikl ichidagi har bir kuni (Kun 1, Kun 2, ...) uchun ish vaqti sozlamalari';

-- Mavjud jadvallarni "Kun 1" sifatida ko'chirish (avvalgi yagona kun sozlamasi).
-- Faqat work_schedules.is_work_day hali mavjud bo'lsa kerak (ya'ni bu blok
-- birinchi marta ishga tushganda) — migratsiya runner har chaqirilganda
-- BARCHA faylni qayta bajaradi, keyingi qayta ishga tushirishlarda esa
-- pastdagi DROP COLUMN allaqachon bu ustunlarni olib tashlagan bo'ladi.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_schedules' AND column_name = 'is_work_day'
  ) THEN
    INSERT INTO work_schedule_days (schedule_id, day_number, is_work_day, start_time, end_time, break_start, break_end)
    SELECT id, 1, is_work_day, start_time, end_time, break_start, break_end
    FROM work_schedules
    ON CONFLICT (schedule_id, day_number) DO NOTHING;
  END IF;
END $$;

ALTER TABLE work_schedules
  DROP COLUMN IF EXISTS is_work_day,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS break_start,
  DROP COLUMN IF EXISTS break_end;
