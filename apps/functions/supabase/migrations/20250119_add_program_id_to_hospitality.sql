-- Add program_id to hospitality_hours table
ALTER TABLE hospitality_hours 
ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hospitality_hours_program_id ON hospitality_hours(program_id);

-- Update existing records to use the first program if it exists
DO $$
DECLARE
  first_program_id BIGINT;
BEGIN
  SELECT id INTO first_program_id FROM programs ORDER BY id ASC LIMIT 1;
  
  IF first_program_id IS NOT NULL THEN
    UPDATE hospitality_hours 
    SET program_id = first_program_id 
    WHERE program_id IS NULL;
  END IF;
END $$;

-- Update the RPC function to filter by program_id
CREATE OR REPLACE FUNCTION get_hospitality_slots(p_program_id INTEGER DEFAULT NULL)
RETURNS TABLE(
  id INTEGER,
  program_id INTEGER,
  date DATE,
  start_time TIME,
  end_time TIME,
  group_name TEXT,
  group_city TEXT,
  group_state TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id::INTEGER,
    h.program_id::INTEGER,
    h.date_time::DATE as date,
    h.date_time::TIME as start_time,
    (h.date_time + interval '2 hours')::TIME as end_time,
    h.group_hosting as group_name,
    '' as group_city,  -- These fields don't exist in current schema
    '' as group_state
  FROM hospitality_hours h
  WHERE (p_program_id IS NULL OR h.program_id = p_program_id)
  ORDER BY h.date_time ASC;
END;
$$;

-- Grant execute permission on the function to anon and authenticated
GRANT EXECUTE ON FUNCTION get_hospitality_slots(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_hospitality_slots(INTEGER) TO authenticated;