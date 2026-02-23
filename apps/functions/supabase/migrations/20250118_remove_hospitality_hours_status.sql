-- Remove status field from hospitality_hours table
-- This migration simplifies the hospitality hours tracking to only use confirmed status

-- Drop the CHECK constraint on status field
ALTER TABLE hospitality_hours 
DROP CONSTRAINT IF EXISTS hospitality_hours_status_check;

-- Remove the status column
ALTER TABLE hospitality_hours 
DROP COLUMN IF EXISTS status;

-- Drop the index on status since the column is being removed
DROP INDEX IF EXISTS idx_hospitality_hours_status;

-- Update the comment on the table
COMMENT ON TABLE hospitality_hours IS 'Public tracking of hospitality volunteer hours with group hosting information - simplified to track only confirmed status';