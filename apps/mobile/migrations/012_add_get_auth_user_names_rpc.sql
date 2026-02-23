-- Create RPC function to get user names from public.users and auth.users
-- This is needed for the on-call management feature to display actual user names

CREATE OR REPLACE FUNCTION public.get_auth_user_names(user_ids UUID[])
RETURNS TABLE(
  id UUID,
  email VARCHAR(255),
  full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(pu.user_id, au.id) as id,
    au.email,
    COALESCE(
      CASE 
        WHEN pu.first_name IS NOT NULL AND pu.last_initial IS NOT NULL 
        THEN pu.first_name || ' ' || pu.last_initial || '.'
        ELSE NULL
      END,
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      au.email::TEXT
    )::TEXT as full_name
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.user_id = au.id
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_auth_user_names(UUID[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_auth_user_names(UUID[]) IS 'Get user names from auth.users table for given user IDs';