-- Add notification status tracking columns to panel_notifications table

-- Add send_status column to track if notification was successfully sent
ALTER TABLE panel_notifications 
ADD COLUMN send_status TEXT CHECK (send_status IN ('success', 'failed', 'pending'));

-- Add send_error column to store error message if send failed
ALTER TABLE panel_notifications 
ADD COLUMN send_error TEXT;

-- Add first reminder columns
ALTER TABLE panel_notifications 
ADD COLUMN reminder_followup_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE panel_notifications 
ADD COLUMN reminder_send_status TEXT CHECK (reminder_send_status IN ('success', 'failed', 'pending'));

ALTER TABLE panel_notifications 
ADD COLUMN reminder_send_error TEXT;

-- Add second reminder columns
ALTER TABLE panel_notifications 
ADD COLUMN reminder2_followup_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE panel_notifications 
ADD COLUMN reminder2_send_status TEXT CHECK (reminder2_send_status IN ('success', 'failed', 'pending'));

ALTER TABLE panel_notifications 
ADD COLUMN reminder2_send_error TEXT;

-- Create indexes for the new columns for better query performance
CREATE INDEX idx_panel_notifications_send_status ON panel_notifications(send_status);
CREATE INDEX idx_panel_notifications_reminder_followup_sent_at ON panel_notifications(reminder_followup_sent_at);
CREATE INDEX idx_panel_notifications_reminder_send_status ON panel_notifications(reminder_send_status);
CREATE INDEX idx_panel_notifications_reminder2_followup_sent_at ON panel_notifications(reminder2_followup_sent_at);
CREATE INDEX idx_panel_notifications_reminder2_send_status ON panel_notifications(reminder2_send_status);

-- Add comments for the new columns
COMMENT ON COLUMN panel_notifications.send_status IS 'Status of the initial notification send attempt (success, failed, pending)';
COMMENT ON COLUMN panel_notifications.send_error IS 'Error message if the initial notification send failed';
COMMENT ON COLUMN panel_notifications.reminder_followup_sent_at IS 'Timestamp when first reminder follow-up was sent';
COMMENT ON COLUMN panel_notifications.reminder_send_status IS 'Status of the first reminder send attempt (success, failed, pending)';
COMMENT ON COLUMN panel_notifications.reminder_send_error IS 'Error message if the first reminder send failed';
COMMENT ON COLUMN panel_notifications.reminder2_followup_sent_at IS 'Timestamp when second reminder follow-up was sent';
COMMENT ON COLUMN panel_notifications.reminder2_send_status IS 'Status of the second reminder send attempt (success, failed, pending)';
COMMENT ON COLUMN panel_notifications.reminder2_send_error IS 'Error message if the second reminder send failed';