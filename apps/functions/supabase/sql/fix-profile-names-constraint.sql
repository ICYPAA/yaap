-- Fix profile-names table unique constraint
-- The upsert is failing because there's no unique constraint on user_id

-- First, check if the constraint already exists and drop it if needed
ALTER TABLE "profile-names" DROP CONSTRAINT IF EXISTS profile_names_user_id_key;

-- Add a unique constraint on user_id
ALTER TABLE "profile-names" ADD CONSTRAINT profile_names_user_id_key UNIQUE (user_id);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_profile_names_user_id ON "profile-names"(user_id);

-- Also ensure the table has the right structure
ALTER TABLE "profile-names" 
  ADD COLUMN IF NOT EXISTS discord_roles TEXT[] DEFAULT '{}';

-- Enable RLS if not already enabled
ALTER TABLE "profile-names" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view all profile names" ON "profile-names";
DROP POLICY IF EXISTS "Users can insert own profile" ON "profile-names";
DROP POLICY IF EXISTS "Users can update own profile" ON "profile-names";

-- Allow users to view all profile names
CREATE POLICY "Users can view all profile names"
  ON "profile-names"
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON "profile-names"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON "profile-names"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON "profile-names" TO authenticated;
GRANT ALL ON "profile-names" TO service_role;