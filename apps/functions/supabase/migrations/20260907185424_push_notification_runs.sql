CREATE TABLE public.push_notification_runs (
  id uuid PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  program_id integer REFERENCES public.programs(id),
  audience text NOT NULL CHECK (audience IN ('test', 'subscribers')),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  recipient_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  tickets jsonb NOT NULL DEFAULT '[]',
  receipts jsonb NOT NULL DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_notification_runs_created_by_date ON public.push_notification_runs(created_by, created_at DESC);
ALTER TABLE public.push_notification_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_notification_runs FROM anon, authenticated;
GRANT SELECT ON public.push_notification_runs TO authenticated;
GRANT ALL ON public.push_notification_runs TO service_role;
CREATE POLICY push_notification_runs_read ON public.push_notification_runs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.roles r WHERE r.user_id = (SELECT auth.uid())
  AND (r.role = 'admin' OR (push_notification_runs.created_by = (SELECT auth.uid()) AND r.permissions @> ARRAY['notifications:send']::text[]))
));
