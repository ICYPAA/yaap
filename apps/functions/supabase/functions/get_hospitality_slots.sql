-- Drop old function versions to avoid overloading conflicts
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS get_hospitality_slots(BIGINT) CASCADE;

-- RPC function to get hospitality slots without sensitive data
CREATE OR REPLACE FUNCTION get_hospitality_slots(p_program_id BIGINT)
RETURNS TABLE(
  id BIGINT,
  program_id BIGINT,
  date_time TIMESTAMP WITH TIME ZONE,
  group_hosting TEXT,
  planning_to_bring TEXT,
  room TEXT,
  scheduled_hours NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.program_id,
    h.date_time,
    h.group_hosting,
    h.planning_to_bring,
    h.room,
    h.scheduled_hours
  FROM hospitality_hours h
  WHERE h.program_id = p_program_id
    AND h.group_confirmed = true  -- Only show confirmed slots
  ORDER BY h.date_time ASC;
END;
$$;

-- Update RLS policy for hospitality_hours table
-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read hospitality_hours" ON hospitality_hours;
DROP POLICY IF EXISTS "Allow authenticated read hospitality_hours" ON hospitality_hours;

-- Create new policy for authenticated users only
CREATE POLICY "Allow authenticated read hospitality_hours" ON hospitality_hours
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant execute permission on the function to anon and authenticated
GRANT EXECUTE ON FUNCTION get_hospitality_slots(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_hospitality_slots(INTEGER) TO authenticated;