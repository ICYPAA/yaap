-- Update the reports table to add completed_work field and make agenda_doc_id optional
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS completed_work TEXT;

-- Update existing reports with default value
UPDATE reports
SET completed_work = 'No completed work reported'
WHERE completed_work IS NULL;

-- Make completed_work field required for new records
ALTER TABLE reports
ALTER COLUMN completed_work SET NOT NULL;

-- Make agenda_doc_id optional since it seems to be no longer needed
ALTER TABLE reports
ALTER COLUMN agenda_doc_id DROP NOT NULL;

-- Add is_nothing_to_report column if it doesn't exist
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS is_nothing_to_report BOOLEAN DEFAULT false;

-- Update existing reports with default value
UPDATE reports
SET is_nothing_to_report = false
WHERE is_nothing_to_report IS NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN reports.completed_work IS 'Work completed since the last meeting';
COMMENT ON COLUMN reports.is_nothing_to_report IS 'Flag indicating if this is a nothing to report submission';

-- Drop existing policies for reports table if they exist
DROP POLICY IF EXISTS "Authenticated users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Team members can view their team reports" ON reports;
DROP POLICY IF EXISTS "Host committee chairs can view all reports" ON reports;

-- Policy to allow authenticated users to create reports
CREATE POLICY "Authenticated users can create reports" ON reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow users to view their own reports
CREATE POLICY "Users can view their own reports" ON reports
    FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to view all reports from their team
CREATE POLICY "Team members can view their team reports" ON reports
    FOR SELECT USING (
        auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM reports user_reports
            WHERE user_reports.user_id = auth.uid()
            AND user_reports.team = reports.team
        )
    );

-- Policy to allow host committee chairs to view all reports
CREATE POLICY "Host committee chairs can view all reports" ON reports
    FOR SELECT USING (
        auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email LIKE '%@icyhost.org'
        )
    );