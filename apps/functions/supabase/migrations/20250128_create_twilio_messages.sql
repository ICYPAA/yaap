-- Create table for storing Twilio message history
CREATE TABLE IF NOT EXISTS public.twilio_messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  -- Message details
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  
  -- Twilio tracking
  message_sid TEXT UNIQUE,
  status TEXT,
  error_code TEXT,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Indexes for common queries
  CONSTRAINT twilio_messages_message_sid_key UNIQUE (message_sid)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_twilio_messages_to_number ON public.twilio_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_twilio_messages_sent_at ON public.twilio_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_twilio_messages_status ON public.twilio_messages(status);
CREATE INDEX IF NOT EXISTS idx_twilio_messages_metadata ON public.twilio_messages USING GIN(metadata);

-- Enable Row Level Security
ALTER TABLE public.twilio_messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow host committee members to view message history
CREATE POLICY "Host committee members can view message history" ON public.twilio_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roles
      WHERE roles.user_id = auth.uid()
      AND roles.role IN ('admin', 'steering', 'chair', 'committee')
    )
  );

-- Create policy to allow admins and steering to insert/update messages
CREATE POLICY "Admins and steering can manage messages" ON public.twilio_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles
      WHERE roles.user_id = auth.uid()
      AND roles.role IN ('admin', 'steering')
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_twilio_messages_updated_at
  BEFORE UPDATE ON public.twilio_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.twilio_messages IS 'Stores history of all Twilio SMS messages sent from the application';