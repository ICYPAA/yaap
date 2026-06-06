-- Create table for security time slot assignments
CREATE TABLE IF NOT EXISTS security_time_slot_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  volunteer_id UUID NOT NULL REFERENCES volunteering_interest(id) ON DELETE CASCADE,
  volunteer_name TEXT NOT NULL,
  day TEXT NOT NULL,
  block TEXT NOT NULL,
  slot TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique assignment per volunteer per slot
  UNIQUE(volunteer_id, day, block, slot)
);

-- Add RLS policies
ALTER TABLE security_time_slot_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and steering committee can view all assignments
CREATE POLICY "Admins and steering can view security assignments" ON security_time_slot_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND (roles.role = 'admin' OR roles.role = 'steering')
    )
  );

-- Policy: Users with volunteering:sensitive permission can view assignments
CREATE POLICY "Users with volunteering:sensitive can view security assignments" ON security_time_slot_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND 'volunteering:sensitive' = ANY(roles.permissions)
    )
  );

-- Policy: Admins and steering committee can insert assignments
CREATE POLICY "Admins and steering can insert security assignments" ON security_time_slot_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND (roles.role = 'admin' OR roles.role = 'steering')
    )
  );

-- Policy: Users with volunteering:sensitive permission can insert assignments
CREATE POLICY "Users with volunteering:sensitive can insert security assignments" ON security_time_slot_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND 'volunteering:sensitive' = ANY(roles.permissions)
    )
  );

-- Policy: Admins and steering committee can update assignments
CREATE POLICY "Admins and steering can update security assignments" ON security_time_slot_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND (roles.role = 'admin' OR roles.role = 'steering')
    )
  );

-- Policy: Users with volunteering:sensitive permission can update assignments
CREATE POLICY "Users with volunteering:sensitive can update security assignments" ON security_time_slot_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND 'volunteering:sensitive' = ANY(roles.permissions)
    )
  );

-- Policy: Admins and steering committee can delete assignments
CREATE POLICY "Admins and steering can delete security assignments" ON security_time_slot_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND (roles.role = 'admin' OR roles.role = 'steering')
    )
  );

-- Policy: Users with volunteering:sensitive permission can delete assignments
CREATE POLICY "Users with volunteering:sensitive can delete security assignments" ON security_time_slot_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND 'volunteering:sensitive' = ANY(roles.permissions)
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_security_assignments_volunteer ON security_time_slot_assignments(volunteer_id);
CREATE INDEX idx_security_assignments_day_block ON security_time_slot_assignments(day, block, slot);