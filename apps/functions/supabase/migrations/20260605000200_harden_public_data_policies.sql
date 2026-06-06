-- Harden RLS boundaries that previously relied on row policies to hide columns.
-- Row-level policies cannot prevent selected sensitive columns from being returned.

-- Users: remove the table-wide public select policy and expose public profile
-- fields only through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS users_select_public_info ON public.users;
DROP FUNCTION IF EXISTS public.get_public_user_info(int4);
DROP FUNCTION IF EXISTS public.get_public_users_info(int4[]);

CREATE OR REPLACE FUNCTION public.get_public_user_info(user_id int4)
RETURNS TABLE (
  id int4,
  first_name text,
  last_initial text,
  profile_image text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_initial, u.profile_image
  FROM public.users u
  WHERE u.id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_users_info(user_ids int4[])
RETURNS TABLE (
  id int4,
  first_name text,
  last_initial text,
  profile_image text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_initial, u.profile_image
  FROM public.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_user_info(int4) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_users_info(int4[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_info(int4) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_users_info(int4[]) TO anon, authenticated;

-- Volunteering interest: remove broad select policies and require direct table
-- readers to have volunteer privileges. Non-sensitive list access should use
-- public.get_volunteering_interest_safe().
DROP POLICY IF EXISTS "Anyone can read volunteering interest" ON public.volunteering_interest;
DROP POLICY IF EXISTS "Authenticated users can read non-sensitive volunteering interest data" ON public.volunteering_interest;
DROP POLICY IF EXISTS "Only authorized users can access sensitive volunteer data" ON public.volunteering_interest;
DROP POLICY IF EXISTS "Authorized users can read volunteering interest" ON public.volunteering_interest;

CREATE POLICY "Authorized users can read volunteering interest"
  ON public.volunteering_interest
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles
      WHERE roles.user_id = auth.uid()
      AND (
        roles.role IN ('admin', 'steering')
        OR roles.permissions::text[] @> ARRAY['volunteering:read']
        OR roles.permissions::text[] @> ARRAY['volunteering:sensitive']
      )
    )
  );

REVOKE ALL ON FUNCTION public.get_volunteering_interest_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_volunteering_interest_safe() TO authenticated;

-- Committee mappings: remove temporary anonymous write policies.
DROP POLICY IF EXISTS "Anonymous users can insert committee mappings (DEV)"
  ON public.committee_mappings;
DROP POLICY IF EXISTS "Anonymous users can update committee mappings (DEV)"
  ON public.committee_mappings;
DROP POLICY IF EXISTS "Anonymous users can delete committee mappings (DEV)"
  ON public.committee_mappings;
