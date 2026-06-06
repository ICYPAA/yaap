CREATE TABLE IF NOT EXISTS public.conference_state (
  id boolean PRIMARY KEY DEFAULT true,
  current_program_id integer REFERENCES public.programs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'none',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT conference_state_singleton CHECK (id),
  CONSTRAINT conference_state_status_check CHECK (status IN ('none', 'planning', 'active')),
  CONSTRAINT conference_state_program_status_check CHECK (
    (status = 'none' AND current_program_id IS NULL)
    OR (status IN ('planning', 'active') AND current_program_id IS NOT NULL)
  )
);

INSERT INTO public.conference_state (id, current_program_id, status)
VALUES (true, NULL, 'none')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.conference_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conference_state_select" ON public.conference_state;
CREATE POLICY "conference_state_select"
ON public.conference_state
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "conference_state_update" ON public.conference_state;
CREATE POLICY "conference_state_update"
ON public.conference_state
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.roles
    WHERE roles.user_id = auth.uid()
      AND (
        roles.role IN ('admin', 'steering')
        OR roles.permissions @> ARRAY['program:edit']::text[]
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.roles
    WHERE roles.user_id = auth.uid()
      AND (
        roles.role IN ('admin', 'steering')
        OR roles.permissions @> ARRAY['program:edit']::text[]
      )
  )
);

GRANT SELECT ON public.conference_state TO anon;
GRANT SELECT, UPDATE ON public.conference_state TO authenticated;
GRANT ALL ON public.conference_state TO service_role;

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS program_id integer REFERENCES public.programs(id) ON DELETE CASCADE;

UPDATE public.shifts
SET program_id = COALESCE(
  (SELECT current_program_id FROM public.conference_state WHERE id = true),
  (
    SELECT id
    FROM public.programs
    ORDER BY start_date DESC, id DESC
    LIMIT 1
  )
)
WHERE program_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_program_id ON public.shifts(program_id);
CREATE INDEX IF NOT EXISTS idx_shifts_program_date_time ON public.shifts(program_id, date, start_time);

CREATE OR REPLACE FUNCTION public.create_hospitality_hours_from_interest()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_name text;
  v_program_id integer;
  v_program_start date;
  v_program_end date;
  v_year integer;
  v_day_text text;
  v_time_text text;
  v_start_time_text text;
  v_slot_date date;
  v_candidate_date date;
  v_date_time timestamp with time zone;
BEGIN
  IF NEW.type <> 'hospitality' THEN
    RETURN NEW;
  END IF;

  v_group_name := COALESCE(NEW.data->>'group_name', NEW.name || ' ' || NEW.last_initial || '.');
  v_program_id := NEW.program_id;

  IF v_program_id IS NULL THEN
    SELECT current_program_id
    INTO v_program_id
    FROM public.conference_state
    WHERE id = true;
  END IF;

  IF v_program_id IS NULL THEN
    SELECT id
    INTO v_program_id
    FROM public.programs
    ORDER BY start_date DESC, id DESC
    LIMIT 1;
  END IF;

  SELECT start_date::date, end_date::date, EXTRACT(YEAR FROM start_date)::integer
  INTO v_program_start, v_program_end, v_year
  FROM public.programs
  WHERE id = v_program_id;

  IF v_program_id IS NULL OR v_program_start IS NULL THEN
    RETURN NEW;
  END IF;

  v_day_text := NULLIF(trim(NEW.data->>'day'), '');
  v_time_text := NULLIF(trim(NEW.data->>'time_slot'), '');
  v_start_time_text := substring(v_time_text from '([0-9]{1,2}(?::[0-9]{2})?\s*[APap][Mm])');

  IF v_day_text IS NULL OR v_start_time_text IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF v_day_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_slot_date := v_day_text::date;
    ELSE
      v_slot_date := to_date(v_day_text || ' ' || v_year::text, 'Mon DD YYYY');
    END IF;
  EXCEPTION WHEN others THEN
    v_slot_date := NULL;
  END;

  IF v_slot_date IS NULL OR v_slot_date < v_program_start OR v_slot_date > v_program_end THEN
    FOR v_candidate_date IN
      SELECT generate_series(v_program_start, v_program_end, interval '1 day')::date
    LOOP
      IF lower(v_day_text) IN (
        lower(to_char(v_candidate_date, 'FMDay')),
        lower(to_char(v_candidate_date, 'Dy')),
        lower(to_char(v_candidate_date, 'FMMonth DD')),
        lower(to_char(v_candidate_date, 'Mon DD'))
      ) THEN
        v_slot_date := v_candidate_date;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_slot_date IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_date_time := to_timestamp(
      v_slot_date::text || ' ' || v_start_time_text,
      'YYYY-MM-DD HH12:MI AM'
    );
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  INSERT INTO public.hospitality_hours (
    date_time,
    group_hosting,
    group_contact,
    group_email,
    group_phone,
    volunteering_interest_id,
    group_confirmed,
    scheduled_hours,
    program_id
  ) VALUES (
    v_date_time,
    v_group_name,
    NEW.name,
    NEW.email,
    NEW.phone,
    NEW.id,
    true,
    2.0,
    v_program_id
  )
  ON CONFLICT (date_time, group_hosting) DO NOTHING;

  RETURN NEW;
END;
$$;
