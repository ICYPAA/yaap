-- Remove the date check constraint from shifts table
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_date_check;