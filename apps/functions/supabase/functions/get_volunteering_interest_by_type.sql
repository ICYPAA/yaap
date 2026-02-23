-- This function retrieves only the data column from volunteer interest records by type
-- It can be called publicly and only returns the minimum required information
CREATE OR REPLACE FUNCTION get_volunteering_interest_by_type(interest_type TEXT)
RETURNS TABLE(data jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT data
  FROM volunteering_interest
  WHERE type = interest_type;
$$;