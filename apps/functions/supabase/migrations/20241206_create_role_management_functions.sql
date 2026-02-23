-- Create RPC functions for role management that bypass RLS policies
-- These functions check permissions internally and use SECURITY DEFINER

-- Function to check if current user has admin or steering role
CREATE OR REPLACE FUNCTION check_role_management_permission()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user has admin or steering role
  RETURN EXISTS (
    SELECT 1 FROM roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'steering')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to insert a new role
CREATE OR REPLACE FUNCTION insert_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[] DEFAULT '{}'
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if current user has permission
  IF NOT check_role_management_permission() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only admin and steering users can manage roles.'
    );
  END IF;

  -- Validate role
  IF user_role NOT IN ('admin', 'steering', 'host', 'volunteer') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid role. Must be one of: admin, steering, host, volunteer'
    );
  END IF;

  -- Insert the role
  INSERT INTO roles (user_id, role, permissions)
  VALUES (target_user_id, user_role, user_permissions)
  ON CONFLICT (user_id, role)
  DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

  -- Return success
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

-- Function to update an existing role
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[] DEFAULT '{}'
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if current user has permission
  IF NOT check_role_management_permission() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only admin and steering users can manage roles.'
    );
  END IF;

  -- Validate role
  IF user_role NOT IN ('admin', 'steering', 'host', 'volunteer') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid role. Must be one of: admin, steering, host, volunteer'
    );
  END IF;

  -- Update the role
  UPDATE roles
  SET
    permissions = user_permissions,
    updated_at = NOW()
  WHERE user_id = target_user_id AND role = user_role;

  -- Check if role was found and updated
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role not found for this user'
    );
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Role updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Function to delete a role
CREATE OR REPLACE FUNCTION delete_user_role(
  target_user_id UUID,
  user_role TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user has permission
  IF NOT check_role_management_permission() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only admin and steering users can manage roles.'
    );
  END IF;

  -- Delete the role
  DELETE FROM roles
  WHERE user_id = target_user_id AND role = user_role;

  -- Check if role was found and deleted
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role not found for this user'
    );
  END IF;

  -- Return success
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

-- Function to get all roles (for admin/steering users)
CREATE OR REPLACE FUNCTION get_all_user_roles()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role TEXT,
  permissions TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user has permission
  IF NOT check_role_management_permission() THEN
    RAISE EXCEPTION 'Insufficient permissions. Only admin and steering users can view all roles.';
  END IF;

  -- Return all roles
  RETURN QUERY
  SELECT r.id, r.user_id, r.role, r.permissions, r.created_at, r.updated_at
  FROM roles r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_role_management_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user_role(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_user_roles() TO authenticated;