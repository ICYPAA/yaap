-- Anonymous attendees may submit accessibility requests, but they cannot read
-- the sensitive request table. Return the new identifier through a narrowly
-- scoped function instead of requiring an INSERT ... RETURNING table select.
CREATE OR REPLACE FUNCTION public.submit_accessibility_request(
  p_program_id integer,
  p_name text,
  p_phone text,
  p_email text,
  p_need_type text,
  p_details text,
  p_arrival_date text,
  p_duration text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id integer;
BEGIN
  IF p_program_id IS NULL
    OR NULLIF(btrim(p_name), '') IS NULL
    OR NULLIF(btrim(p_phone), '') IS NULL
    OR NULLIF(btrim(p_email), '') IS NULL
    OR NULLIF(btrim(p_need_type), '') IS NULL
    OR NULLIF(btrim(p_arrival_date), '') IS NULL
    OR NULLIF(btrim(p_duration), '') IS NULL
  THEN
    RAISE EXCEPTION 'Required accessibility request fields cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.accessibility_forms (
    program_id,
    name,
    phone,
    email,
    need_type,
    details,
    arrival_date,
    duration,
    user_id,
    owner_id
  )
  VALUES (
    p_program_id,
    btrim(p_name),
    btrim(p_phone),
    btrim(p_email),
    btrim(p_need_type),
    NULLIF(btrim(p_details), ''),
    btrim(p_arrival_date),
    btrim(p_duration),
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_accessibility_request(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_accessibility_request(
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) TO anon, authenticated;
