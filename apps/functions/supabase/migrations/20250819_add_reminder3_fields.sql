-- Add reminder3 fields for 1-hour before panel reminders
ALTER TABLE panel_notifications
ADD COLUMN IF NOT EXISTS reminder3_followup_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder3_send_status text CHECK (reminder3_send_status IN ('success', 'failed', 'pending')),
ADD COLUMN IF NOT EXISTS reminder3_send_error text,
ADD COLUMN IF NOT EXISTS twilio_reminder3_sid text;