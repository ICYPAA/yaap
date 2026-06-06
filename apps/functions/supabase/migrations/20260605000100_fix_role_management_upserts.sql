-- Fix role-management RPCs so changing a user's role actually changes the
-- existing row instead of looking for a row that already has the new role.
-- The UI treats roles as a single assignment per user, so these functions now
-- upsert the requested managed role and remove any prior non-admin role.

CREATE OR REPLACE FUNCTION public.insert_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[] DEFAULT '{}'
)
RETURNS JSON
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

  DELETE FROM public.roles
  WHERE user_id = target_user_id
  AND role <> user_role
  AND role <> 'admin';

  INSERT INTO public.roles (user_id, role, permissions)
  VALUES (target_user_id, user_role, user_permissions)
  ON CONFLICT (user_id, role)
  DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[] DEFAULT '{}'
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.insert_user_role(target_user_id, user_role, user_permissions);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_user_role(
  target_user_id UUID,
  user_role TEXT
)
RETURNS JSON
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

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role not found for this user'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Role removed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.insert_user_role(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_role(UUID, TEXT) TO authenticated;
