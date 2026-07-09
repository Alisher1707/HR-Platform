-- =============================================
-- 013: EJM (EMPLOYEE JOURNEY MAP) JADVALLARI
-- =============================================

-- EJM data table - barcha phases va nodes
CREATE TABLE IF NOT EXISTS ejm_data (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  data_json     JSONB NOT NULL,
  is_template   BOOLEAN DEFAULT false,
  template_name VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- EJM files table - yuklangan fayllar
CREATE TABLE IF NOT EXISTS ejm_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ejm_data_id     UUID REFERENCES ejm_data(id) ON DELETE CASCADE,
  phase_index     INTEGER NOT NULL,
  node_index      INTEGER NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_size       BIGINT NOT NULL,
  file_type       VARCHAR(100),
  file_path       TEXT NOT NULL,
  original_name   VARCHAR(255) NOT NULL,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ejm_data_user ON ejm_data(user_id);
CREATE INDEX idx_ejm_data_template ON ejm_data(is_template) WHERE is_template = true;
CREATE INDEX idx_ejm_files_ejm_data ON ejm_files(ejm_data_id);
CREATE INDEX idx_ejm_files_uploaded_by ON ejm_files(uploaded_by);

-- Comments
COMMENT ON TABLE ejm_data IS 'EJM (Employee Journey Map) ma''lumotlari - 48 bosqich';
COMMENT ON TABLE ejm_files IS 'EJM card''lariga yuklangan fayllar';
COMMENT ON COLUMN ejm_data.data_json IS 'To''liq EJM strukturasi JSON formatda';
COMMENT ON COLUMN ejm_data.is_template IS 'Bu template yoki user-specific EJM';
COMMENT ON COLUMN ejm_files.phase_index IS 'Fayl qaysi phase''ga tegishli (0-based index)';
COMMENT ON COLUMN ejm_files.node_index IS 'Fayl qaysi node''ga tegishli (0-based index)';
COMMENT ON COLUMN ejm_files.file_path IS 'Faylning server''dagi yo''li';
