-- Add reports_due column to reminders table
ALTER TABLE reminders
ADD COLUMN IF NOT EXISTS reports_due TEXT;

-- Update existing reminders with default value
UPDATE reminders
SET reports_due = 'not_required'
WHERE reports_due IS NULL;

-- Comment explaining the change
COMMENT ON COLUMN reminders.reports_due IS 'Indicates when reports are due (day of week) or not_required if no reports are due';