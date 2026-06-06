-- Convert location column from TEXT to JSONB to support multiple rooms
ALTER TABLE shifts 
ALTER COLUMN location TYPE JSONB 
USING CASE 
  WHEN location IS NULL OR location = '' THEN '[]'::jsonb
  ELSE json_build_array(location)::jsonb
END;

-- Add comment for clarity
COMMENT ON COLUMN shifts.location IS 'Array of venue room names';