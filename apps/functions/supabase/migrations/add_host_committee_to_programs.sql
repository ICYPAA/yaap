-- Add host_committee column to programs table
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS host_committee JSONB;