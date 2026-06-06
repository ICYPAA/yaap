-- Add denied_at column to panel_notifications table for withdrawal tracking
ALTER TABLE panel_notifications ADD COLUMN denied_at TIMESTAMP WITH TIME ZONE;

-- Add index for better performance on denied_at column
CREATE INDEX idx_panel_notifications_denied_at ON panel_notifications(denied_at);

-- Add comment for the new column
COMMENT ON COLUMN panel_notifications.denied_at IS 'Timestamp when panelist withdrew/denied participation (null means not denied)';

-- Add chairpeople column to events table similar to speakers
ALTER TABLE events ADD COLUMN chairpeople TEXT[] DEFAULT '{}';

-- Add index for better performance on chairpeople column
CREATE INDEX idx_events_chairpeople ON events USING GIN(chairpeople);

-- Add comment for the new column
COMMENT ON COLUMN events.chairpeople IS 'Array of chairpeople names for the event';