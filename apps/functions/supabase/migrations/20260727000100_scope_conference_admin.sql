-- Keep the admin board focused on conference data and enforce the same
-- conference-editor permission at the database boundary.

CREATE OR REPLACE FUNCTION public.can_manage_conference()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE roles.user_id = auth.uid()
      AND (
        roles.role IN ('admin', 'steering')
        OR roles.permissions @> ARRAY['program:edit']::text[]
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_conference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO service_role;

DROP POLICY IF EXISTS "Authenticated Users" ON public.programs;
DROP POLICY IF EXISTS "Authenticated Users" ON public.events;
DROP POLICY IF EXISTS "Authenticated Users" ON public.event_categories;

DROP POLICY IF EXISTS "Delete" ON public.activities;
DROP POLICY IF EXISTS "Insert" ON public.activities;
DROP POLICY IF EXISTS "Update" ON public.activities;

DROP POLICY IF EXISTS "Delete" ON public.food;
DROP POLICY IF EXISTS "Insert" ON public.food;
DROP POLICY IF EXISTS "Update" ON public.food;

DROP POLICY IF EXISTS "Delete" ON public.venues;
DROP POLICY IF EXISTS "Insert" ON public.venues;
DROP POLICY IF EXISTS "Update" ON public.venues;

CREATE POLICY "conference_admin_manage_programs"
ON public.programs
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

CREATE POLICY "conference_admin_manage_events"
ON public.events
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

CREATE POLICY "conference_admin_manage_event_categories"
ON public.event_categories
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

CREATE POLICY "conference_admin_manage_activities"
ON public.activities
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

CREATE POLICY "conference_admin_manage_food"
ON public.food
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

CREATE POLICY "conference_admin_manage_venues"
ON public.venues
FOR ALL
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());

-- A user has one managed role. The previous RPC targeted a non-existent
-- (user_id, role) unique constraint and could fail when changing roles.
CREATE OR REPLACE FUNCTION public.insert_user_role(
  target_user_id uuid,
  user_role text,
  user_permissions text[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.check_role_management_permission() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only admin and steering users can manage roles.'
    );
  END IF;

  IF user_role NOT IN ('steering', 'host', 'volunteer') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid managed role. Must be one of: steering, host, volunteer'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.roles
    WHERE user_id = target_user_id
      AND role = 'admin'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be modified through role management.'
    );
  END IF;

  INSERT INTO public.roles (user_id, role, permissions)
  VALUES (target_user_id, user_role, user_permissions)
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'message', 'Role assigned successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_role(
  target_user_id uuid,
  user_role text,
  user_permissions text[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.insert_user_role(
    target_user_id,
    user_role,
    user_permissions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_user_role(uuid, text, text[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text, text[])
  TO authenticated;

-- Access Control needs a limited account directory, not unrestricted access to
-- the Auth admin API or a service-role key in the web application.
CREATE OR REPLACE FUNCTION public.get_conference_admin_users()
RETURNS TABLE (
  id uuid,
  email text,
  profile_name text,
  role text,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.check_role_management_permission() THEN
    RAISE EXCEPTION 'Insufficient permissions'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    auth_user.id,
    auth_user.email::text,
    COALESCE(
      profile.profile_name,
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name'
    )::text,
    access_role.role::text,
    COALESCE(access_role.permissions, '{}'::text[])
  FROM auth.users AS auth_user
  LEFT JOIN public."profile-names" AS profile
    ON profile.user_id = auth_user.id
  LEFT JOIN public.roles AS access_role
    ON access_role.user_id = auth_user.id
  ORDER BY
    CASE access_role.role
      WHEN 'admin' THEN 0
      WHEN 'steering' THEN 1
      WHEN 'host' THEN 2
      WHEN 'volunteer' THEN 3
      ELSE 4
    END,
    COALESCE(
      profile.profile_name,
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name',
      auth_user.email
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_conference_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conference_admin_users()
  TO authenticated;
