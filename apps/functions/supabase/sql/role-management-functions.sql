-- Function to check if current user can access role management
CREATE OR REPLACE FUNCTION check_role_management_permission()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user has admin or steering role
  RETURN EXISTS (
    SELECT 1 
    FROM roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'steering')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all user roles (only accessible by admin/steering)
CREATE OR REPLACE FUNCTION get_all_user_roles()
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  permissions TEXT[]
) AS $$
BEGIN
  -- First check if the current user has permission
  IF NOT check_role_management_permission() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Return all roles
  RETURN QUERY
  SELECT 
    r.user_id,
    r.role,
    r.permissions
  FROM roles r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user role (accessible by admin and steering members)
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[]
)
RETURNS JSON AS $$
DECLARE
  current_user_role TEXT;
  target_current_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM roles
  WHERE user_id = auth.uid();
  
  -- Admin and steering members can update roles
  IF current_user_role NOT IN ('admin', 'steering') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admin and steering committee members can modify roles'
    );
  END IF;
  
  -- Get target user's current role
  SELECT role INTO target_current_role
  FROM roles
  WHERE user_id = target_user_id;
  
  -- Prevent modification of admin roles
  IF target_current_role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be modified'
    );
  END IF;
  
  -- Update the role
  UPDATE roles
  SET 
    role = user_role,
    permissions = user_permissions,
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Role updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert user role (for users without existing roles)
CREATE OR REPLACE FUNCTION insert_user_role(
  target_user_id UUID,
  user_role TEXT,
  user_permissions TEXT[]
)
RETURNS JSON AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM roles
  WHERE user_id = auth.uid();
  
  -- Admin and steering members can insert roles
  IF current_user_role NOT IN ('admin', 'steering') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admin and steering committee members can assign roles'
    );
  END IF;
  
  -- Prevent creation of admin roles through this function
  IF user_role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be created through the UI'
    );
  END IF;
  
  -- Insert the new role
  INSERT INTO roles (user_id, role, permissions, created_at, updated_at)
  VALUES (target_user_id, user_role, user_permissions, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Role assigned successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on these functions to authenticated users
GRANT EXECUTE ON FUNCTION check_role_management_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_user_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user_role(UUID, TEXT, TEXT[]) TO authenticated;