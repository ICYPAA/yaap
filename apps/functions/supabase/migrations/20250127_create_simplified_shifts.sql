-- Drop the previous overly complex tables if they exist
DROP TABLE IF EXISTS volunteer_preferences CASCADE;
DROP TABLE IF EXISTS volunteer_availability CASCADE;
DROP TABLE IF EXISTS shift_assignments CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS job_types CASCADE;
DROP VIEW IF EXISTS shift_schedule_view CASCADE;
DROP FUNCTION IF EXISTS check_shift_conflicts CASCADE;
DROP FUNCTION IF EXISTS get_best_fit_volunteers CASCADE;
DROP FUNCTION IF EXISTS check_volunteer_conflicts CASCADE;
DROP FUNCTION IF EXISTS get_volunteer_suggestions CASCADE;

-- Create a simple shifts table to store shift definitions and assignments
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL CHECK (date >= '2025-08-28' AND date <= '2025-08-31'),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    job_type TEXT NOT NULL,
    location TEXT,
    min_volunteers INTEGER DEFAULT 1,
    max_volunteers INTEGER DEFAULT 1,
    assignments JSONB DEFAULT '[]'::JSONB, -- Array of assigned volunteers
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_job_type ON shifts(job_type);

-- RLS policies
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Public can read shifts
CREATE POLICY "Public can read shifts" ON shifts
    FOR SELECT USING (true);

-- Only host, steering, admin, or users with shift:edit permission can manage shifts
CREATE POLICY "Authorized users can manage shifts" ON shifts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM roles r
            WHERE r.user_id = auth.uid()
            AND (
                r.role IN ('host', 'steering', 'admin') OR
                'shift:edit' = ANY(r.permissions)
            )
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();