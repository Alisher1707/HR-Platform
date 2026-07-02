-- Migration: Fix timer to track SHARTNOMA instead of SINOV_MUDDATI
-- Date: 2026-07-01
-- Description: Rename field and update logic - candidates wait 1 hour in SHARTNOMA before becoming employees

-- Rename column for clarity
ALTER TABLE applications
RENAME COLUMN sinov_muddati_start_date TO shartnoma_start_date;

-- Drop old index
DROP INDEX IF EXISTS idx_applications_sinov_promotion;

-- Create new index for SHARTNOMA status
CREATE INDEX IF NOT EXISTS idx_applications_shartnoma_promotion
ON applications (status, shartnoma_start_date)
WHERE status = 'SHARTNOMA';

-- Update comment
COMMENT ON COLUMN applications.shartnoma_start_date IS 'Timestamp when candidate entered SHARTNOMA status. After 1 hour, automatically converted to employee and removed from kanban.';

-- Migration completed
SELECT 'Timer moved to SHARTNOMA status' AS migration_result;
