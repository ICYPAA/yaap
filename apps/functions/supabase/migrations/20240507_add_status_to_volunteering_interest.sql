-- Add status column to volunteering_interest table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'volunteering_interest'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE volunteering_interest ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;
