ALTER TABLE public.volunteering_interest
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_volunteering_interest_owner
ON public.volunteering_interest(owner_id);
