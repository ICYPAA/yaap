-- Add the current-conference singleton used by the admin and mobile apps,
-- and keep ended conference programs visible only to site-wide admins.

DO $install$
BEGIN
  IF to_regprocedure('public.can_manage_conference()') IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION public.can_manage_conference()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.roles
          WHERE roles.user_id = auth.uid()
            AND (
              roles.role IN ('admin', 'steering')
              OR roles.permissions @> ARRAY['program:edit']::text[]
            )
        );
      $body$
    $definition$;
  END IF;
END
$install$;
REVOKE ALL ON FUNCTION public.can_manage_conference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO service_role;
CREATE OR REPLACE FUNCTION public.is_site_admin()
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
      AND roles.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_site_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO service_role;
CREATE TABLE IF NOT EXISTS public.conference_state (
  id boolean PRIMARY KEY DEFAULT true,
  current_program_id integer REFERENCES public.programs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'none',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT conference_state_singleton CHECK (id),
  CONSTRAINT conference_state_status_check
    CHECK (status IN ('none', 'planning', 'active')),
  CONSTRAINT conference_state_program_status_check CHECK (
    (status = 'none' AND current_program_id IS NULL)
    OR (status IN ('planning', 'active') AND current_program_id IS NOT NULL)
  )
);
INSERT INTO public.conference_state (id, current_program_id, status)
VALUES (true, NULL, 'none')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.conference_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conference_state_select" ON public.conference_state;
CREATE POLICY "conference_state_select"
ON public.conference_state
FOR SELECT
USING (true);
DROP POLICY IF EXISTS "conference_state_update" ON public.conference_state;
CREATE POLICY "conference_state_update"
ON public.conference_state
FOR UPDATE
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());
GRANT SELECT ON public.conference_state TO anon;
GRANT SELECT, UPDATE ON public.conference_state TO authenticated;
GRANT ALL ON public.conference_state TO service_role;
DROP POLICY IF EXISTS "Authenticated Users" ON public.programs;
DROP POLICY IF EXISTS "programs_select" ON public.programs;
DROP POLICY IF EXISTS "conference_admin_manage_programs" ON public.programs;
DROP POLICY IF EXISTS "programs_select_visible" ON public.programs;
DROP POLICY IF EXISTS "conference_manager_insert_programs" ON public.programs;
DROP POLICY IF EXISTS "conference_manager_update_programs" ON public.programs;
DROP POLICY IF EXISTS "conference_manager_delete_programs" ON public.programs;
CREATE POLICY "programs_select_visible"
ON public.programs
FOR SELECT
TO anon, authenticated
USING (
  end_date >= now()
  OR id = (
    SELECT current_program_id
    FROM public.conference_state
    WHERE conference_state.id = true
  )
  OR public.is_site_admin()
);
CREATE POLICY "conference_manager_insert_programs"
ON public.programs
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_conference());
CREATE POLICY "conference_manager_update_programs"
ON public.programs
FOR UPDATE
TO authenticated
USING (public.can_manage_conference())
WITH CHECK (public.can_manage_conference());
CREATE POLICY "conference_manager_delete_programs"
ON public.programs
FOR DELETE
TO authenticated
USING (public.can_manage_conference());
-- Keep the access-control page usable for site administrators without exposing
-- the Auth admin API or a service-role key to the web application.
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
CREATE OR REPLACE FUNCTION public.delete_user_role(
  target_user_id uuid,
  user_role text
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

  IF user_role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be modified through role management.'
    );
  END IF;

  DELETE FROM public.roles
  WHERE user_id = target_user_id
    AND role = user_role;

  RETURN json_build_object(
    'success', true,
    'message', 'Role removed successfully'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_user_role(uuid, text, text[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text, text[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_role(uuid, text)
  TO authenticated;
