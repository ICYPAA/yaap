-- Add accessibility fields to events table
-- These fields track whether events have ASL interpretation, language interpretation, or hybrid meeting options

-- Add ASL interpretation field
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS asl BOOLEAN DEFAULT false;

-- Add languages array field for interpretation options
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- Add hybrid meeting field (in-person and online)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS hybrid BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN events.asl IS 'American Sign Language interpretation available';
COMMENT ON COLUMN events.languages IS 'Array of language interpretation options available (e.g., spanish, somali, hmong)';
COMMENT ON COLUMN events.hybrid IS 'Hybrid meeting with both in-person and online attendance options';

-- Create indexes for filtering by accessibility features
CREATE INDEX IF NOT EXISTS idx_events_asl ON events(asl) WHERE asl = true;
CREATE INDEX IF NOT EXISTS idx_events_languages ON events USING GIN(languages);
CREATE INDEX IF NOT EXISTS idx_events_hybrid ON events(hybrid) WHERE hybrid = true;