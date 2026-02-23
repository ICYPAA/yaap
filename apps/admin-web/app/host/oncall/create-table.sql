-- Create oncall_schedules table
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_user_id ON oncall_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_start_time ON oncall_schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_oncall_schedules_end_time ON oncall_schedules(end_time);

-- Enable RLS
ALTER TABLE oncall_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view oncall schedules (public read)
CREATE POLICY "Anyone can view oncall schedules" ON oncall_schedules
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert their own schedules
CREATE POLICY "Authenticated users can insert own schedules" ON oncall_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own schedules
CREATE POLICY "Users can update own schedules" ON oncall_schedules
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own schedules
CREATE POLICY "Users can delete own schedules" ON oncall_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- Function to create the table (for use in the app)
CREATE OR REPLACE FUNCTION create_oncall_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS oncall_schedules (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_oncall_schedules_user_id ON oncall_schedules(user_id);
  CREATE INDEX IF NOT EXISTS idx_oncall_schedules_start_time ON oncall_schedules(start_time);
  CREATE INDEX IF NOT EXISTS idx_oncall_schedules_end_time ON oncall_schedules(end_time);
  
  ALTER TABLE oncall_schedules ENABLE ROW LEVEL SECURITY;
  
  -- Create policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oncall_schedules' 
    AND policyname = 'Anyone can view oncall schedules'
  ) THEN
    CREATE POLICY "Anyone can view oncall schedules" ON oncall_schedules
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oncall_schedules' 
    AND policyname = 'Authenticated users can insert own schedules'
  ) THEN
    CREATE POLICY "Authenticated users can insert own schedules" ON oncall_schedules
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oncall_schedules' 
    AND policyname = 'Users can update own schedules'
  ) THEN
    CREATE POLICY "Users can update own schedules" ON oncall_schedules
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oncall_schedules' 
    AND policyname = 'Users can delete own schedules'
  ) THEN
    CREATE POLICY "Users can delete own schedules" ON oncall_schedules
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END;
$$ LANGUAGE plpgsql;