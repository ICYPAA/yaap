-- Create on-call assignments table
CREATE TABLE IF NOT EXISTS oncall_assignments (
    id SERIAL PRIMARY KEY,
    program_id INT4 NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL, -- 'accessibility', 'volunteers', 'hospitality', 'support'
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_oncall_assignments_program_service ON oncall_assignments(program_id, service_type, is_active);
CREATE INDEX idx_oncall_assignments_user ON oncall_assignments(user_id, is_active);

-- Enable RLS
ALTER TABLE oncall_assignments ENABLE ROW LEVEL SECURITY;

-- Policy for reading on-call assignments (authenticated users can read)
CREATE POLICY oncall_assignments_select ON oncall_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for inserting on-call assignments (only admin/steering)
CREATE POLICY oncall_assignments_insert ON oncall_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND roles.role IN ('admin', 'steering')
    )
  );

-- Policy for updating on-call assignments (only admin/steering)
CREATE POLICY oncall_assignments_update ON oncall_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND roles.role IN ('admin', 'steering')
    )
  );

-- Policy for deleting on-call assignments (only admin/steering)
CREATE POLICY oncall_assignments_delete ON oncall_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.user_id = auth.uid()
      AND roles.role IN ('admin', 'steering')
    )
  );