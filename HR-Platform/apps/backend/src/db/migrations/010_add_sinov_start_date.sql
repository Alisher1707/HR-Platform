-- Migration: Add sinov_muddati_start_date to applications
-- Date: 2026-07-01
-- Description: Track when candidate enters trial period for auto-promotion after 1 hour

-- Add column to track when candidate enters SINOV_MUDDATI
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS sinov_muddati_start_date TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient querying of candidates ready for promotion
CREATE INDEX IF NOT EXISTS idx_applications_sinov_promotion
ON applications (status, sinov_muddati_start_date)
WHERE status = 'SINOV_MUDDATI';

-- Add comment
COMMENT ON COLUMN applications.sinov_muddati_start_date IS 'Timestamp when candidate entered SINOV_MUDDATI status. After 1 hour, automatically promoted to SHARTNOMA and then to employees.';

-- Migration completed
SELECT 'Sinov muddati start date tracking added' AS migration_result;
