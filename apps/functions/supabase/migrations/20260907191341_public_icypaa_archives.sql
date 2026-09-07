-- Past ICYPAA programs are now an explicit attendee-facing archive. Other
-- ended programs (including HACYPAA) retain their existing visibility rules.
CREATE POLICY programs_select_icypaa_archive
ON public.programs FOR SELECT TO anon, authenticated
USING (
  title ~* '\mICYPAA\M'
  AND end_date < (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
);
