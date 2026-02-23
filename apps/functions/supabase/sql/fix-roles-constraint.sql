-- Fix roles table unique constraint
-- The upsert is failing because there's no unique constraint on user_id

-- First, ensure the roles table exists with proper structure
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'steering', 'host', 'volunteer')),
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing constraint if it exists
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_user_id_key;

-- Add a unique constraint on user_id
ALTER TABLE roles ADD CONSTRAINT roles_user_id_key UNIQUE (user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_role ON roles(role);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage all roles" ON roles;
DROP POLICY IF EXISTS "Users can view roles" ON roles;

-- Allow authenticated users to view roles
CREATE POLICY "Users can view roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage all roles"
  ON roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON roles TO authenticated;
GRANT ALL ON roles TO service_role;