

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_share_request"("requester_id" integer, "acceptor_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  request_exists boolean;
  acceptor_schedule jsonb;
  requester_schedule jsonb;
  new_requested_share jsonb;
  new_shared_with jsonb;
  new_pending_share jsonb;
  new_shared_by jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(requester_id);
  PERFORM initialize_user_schedule(acceptor_id);

  -- Get current schedules
  SELECT schedule INTO acceptor_schedule FROM users WHERE users.id = acceptor_id;
  SELECT schedule INTO requester_schedule FROM users WHERE users.id = requester_id;

  -- Check if request exists in acceptor's requested_share
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(acceptor_schedule->'requested_share') AS element
    WHERE
      (element::text = requester_id::text) OR
      (element::text = concat('"', requester_id, '"')) OR
      (element::jsonb = to_jsonb(requester_id))
  ) INTO request_exists;

  IF NOT request_exists THEN
    RETURN false; -- Request doesn't exist
  END IF;

  -- Process acceptor's schedule first
  -- 1. Remove requester from requested_share array
  SELECT jsonb_agg(element)
  INTO new_requested_share
  FROM jsonb_array_elements(acceptor_schedule->'requested_share') AS arr(element)
  WHERE
    (element::text != requester_id::text) AND
    (element::text != concat('"', requester_id, '"')) AND
    (element::jsonb != to_jsonb(requester_id));

  new_requested_share := COALESCE(new_requested_share, '[]'::jsonb);

  -- 2. Add requester to shared_with array (as integer, not string)
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN
        to_jsonb(element::text::integer) -- Convert string to int
      ELSE
        element -- Keep as is
    END
  )
  INTO new_shared_with
  FROM (
    -- Get existing elements except the one we're adding
    SELECT element
    FROM jsonb_array_elements(acceptor_schedule->'shared_with') AS arr(element)

    UNION ALL

    -- Add the new requester_id as a number
    SELECT to_jsonb(requester_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(acceptor_schedule->'shared_with') AS e
      WHERE
        (e::text = requester_id::text) OR
        (e::text = concat('"', requester_id, '"')) OR
        (e::jsonb = to_jsonb(requester_id))
    )
  ) AS elements;

  new_shared_with := COALESCE(new_shared_with, '[]'::jsonb);

  -- Now process requester's schedule
  -- 1. Remove acceptor from pending_share array
  SELECT jsonb_agg(element)
  INTO new_pending_share
  FROM jsonb_array_elements(requester_schedule->'pending_share') AS arr(element)
  WHERE
    (element::text != acceptor_id::text) AND
    (element::text != concat('"', acceptor_id, '"')) AND
    (element::jsonb != to_jsonb(acceptor_id));

  new_pending_share := COALESCE(new_pending_share, '[]'::jsonb);

  -- 2. Add acceptor to shared_by array (as integer, not string)
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN
        to_jsonb(element::text::integer) -- Convert string to int
      ELSE
        element -- Keep as is
    END
  )
  INTO new_shared_by
  FROM (
    -- Get existing elements except the one we're adding
    SELECT element
    FROM jsonb_array_elements(requester_schedule->'shared_by') AS arr(element)

    UNION ALL

    -- Add the new acceptor_id as a number
    SELECT to_jsonb(acceptor_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(requester_schedule->'shared_by') AS e
      WHERE
        (e::text = acceptor_id::text) OR
        (e::text = concat('"', acceptor_id, '"')) OR
        (e::jsonb = to_jsonb(acceptor_id))
    )
  ) AS elements;

  new_shared_by := COALESCE(new_shared_by, '[]'::jsonb);

  -- Update acceptor's schedule with precision - only changing the arrays we need to
  UPDATE users
  SET schedule = jsonb_set(
    jsonb_set(schedule, '{requested_share}', new_requested_share),
    '{shared_with}', new_shared_with
  )
  WHERE users.id = acceptor_id;

  -- Update requester's schedule with precision - only changing the arrays we need to
  UPDATE users
  SET schedule = jsonb_set(
    jsonb_set(schedule, '{pending_share}', new_pending_share),
    '{shared_by}', new_shared_by
  )
  WHERE users.id = requester_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."accept_share_request"("requester_id" integer, "acceptor_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_chairperson_to_panel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Try to find a matching panel
    IF NEW.panel_id IS NULL THEN
        SELECT id INTO NEW.panel_id
        FROM panel_notifications
        WHERE LOWER(title) = LOWER(NEW.panel_name)
        AND LOWER(time_day) LIKE LOWER('%' || NEW.day_time || '%')
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_link_chairperson_to_panel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ban_user"("current_user_id" integer, "target_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_banned boolean;
  current_user_schedule jsonb;
  target_user_schedule jsonb;
  new_banned jsonb;
  new_shared_with jsonb;
  new_shared_by jsonb;
  new_requested_share jsonb;
  new_pending_share jsonb;
  new_target_shared_with jsonb;
  new_target_shared_by jsonb;
  new_target_requested_share jsonb;
  new_target_pending_share jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(current_user_id);
  PERFORM initialize_user_schedule(target_user_id);

  -- Get current schedules
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;
  SELECT schedule INTO target_user_schedule FROM users WHERE users.id = target_user_id;

  -- Check if target is already banned
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'banned') AS element
    WHERE
      (element::text = target_user_id::text) OR
      (element::text = concat('"', target_user_id, '"')) OR
      (element::jsonb = to_jsonb(target_user_id))
  ) INTO is_banned;

  IF is_banned THEN
    RETURN false; -- Already banned
  END IF;

  -- Add target to banned list with consistent integer representation
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN
        to_jsonb(element::text::integer)
      ELSE
        element
    END
  )
  INTO new_banned
  FROM (
    SELECT element
    FROM jsonb_array_elements(current_user_schedule->'banned') AS arr(element)

    UNION ALL

    SELECT to_jsonb(target_user_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(current_user_schedule->'banned') AS e
      WHERE
        (e::text = target_user_id::text) OR
        (e::text = concat('"', target_user_id, '"')) OR
        (e::jsonb = to_jsonb(target_user_id))
    )
  ) AS elements;

  new_banned := COALESCE(new_banned, '[]'::jsonb);

  -- Remove target from shared_with if present
  SELECT jsonb_agg(element)
  INTO new_shared_with
  FROM jsonb_array_elements(current_user_schedule->'shared_with') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_shared_with := COALESCE(new_shared_with, '[]'::jsonb);

  -- Remove target from shared_by if present
  SELECT jsonb_agg(element)
  INTO new_shared_by
  FROM jsonb_array_elements(current_user_schedule->'shared_by') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_shared_by := COALESCE(new_shared_by, '[]'::jsonb);

  -- Remove target from requested_share if present
  SELECT jsonb_agg(element)
  INTO new_requested_share
  FROM jsonb_array_elements(current_user_schedule->'requested_share') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_requested_share := COALESCE(new_requested_share, '[]'::jsonb);

  -- Remove target from pending_share if present
  SELECT jsonb_agg(element)
  INTO new_pending_share
  FROM jsonb_array_elements(current_user_schedule->'pending_share') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_pending_share := COALESCE(new_pending_share, '[]'::jsonb);

  -- Remove the current user from target user's lists
  -- From target's shared_with (if present)
  SELECT jsonb_agg(element)
  INTO new_target_shared_with
  FROM jsonb_array_elements(target_user_schedule->'shared_with') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_target_shared_with := COALESCE(new_target_shared_with, '[]'::jsonb);

  -- From target's shared_by (if present)
  SELECT jsonb_agg(element)
  INTO new_target_shared_by
  FROM jsonb_array_elements(target_user_schedule->'shared_by') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_target_shared_by := COALESCE(new_target_shared_by, '[]'::jsonb);

  -- From target's requested_share (if present)
  SELECT jsonb_agg(element)
  INTO new_target_requested_share
  FROM jsonb_array_elements(target_user_schedule->'requested_share') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_target_requested_share := COALESCE(new_target_requested_share, '[]'::jsonb);

  -- From target's pending_share (if present)
  SELECT jsonb_agg(element)
  INTO new_target_pending_share
  FROM jsonb_array_elements(target_user_schedule->'pending_share') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_target_pending_share := COALESCE(new_target_pending_share, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            schedule,
            '{banned}',
            new_banned
          ),
          '{shared_with}',
          new_shared_with
        ),
        '{shared_by}',
        new_shared_by
      ),
      '{requested_share}',
      new_requested_share
    ),
    '{pending_share}',
    new_pending_share
  )
  WHERE users.id = current_user_id;

  -- Update target user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          schedule,
          '{shared_with}',
          new_target_shared_with
        ),
        '{shared_by}',
        new_target_shared_by
      ),
      '{requested_share}',
      new_target_requested_share
    ),
    '{pending_share}',
    new_target_pending_share
  )
  WHERE users.id = target_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."ban_user"("current_user_id" integer, "target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_share_request"("current_user_id" integer, "target_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_pending boolean;
  current_user_schedule jsonb;
  target_user_schedule jsonb;
  new_pending_share jsonb;
  new_requested_share jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(current_user_id);
  PERFORM initialize_user_schedule(target_user_id);

  -- Get current schedules
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;
  SELECT schedule INTO target_user_schedule FROM users WHERE users.id = target_user_id;

  -- Check if request is pending
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'pending_share') AS element
    WHERE
      (element::text = target_user_id::text) OR
      (element::text = concat('"', target_user_id, '"')) OR
      (element::jsonb = to_jsonb(target_user_id))
  ) INTO is_pending;

  IF NOT is_pending THEN
    RETURN false; -- Not pending
  END IF;

  -- Remove target from current user's pending_share array
  SELECT jsonb_agg(element)
  INTO new_pending_share
  FROM jsonb_array_elements(current_user_schedule->'pending_share') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_pending_share := COALESCE(new_pending_share, '[]'::jsonb);

  -- Remove current user from target's requested_share array
  SELECT jsonb_agg(element)
  INTO new_requested_share
  FROM jsonb_array_elements(target_user_schedule->'requested_share') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_requested_share := COALESCE(new_requested_share, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{pending_share}',
    new_pending_share
  )
  WHERE users.id = current_user_id;

  -- Update target's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{requested_share}',
    new_requested_share
  )
  WHERE users.id = target_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."cancel_share_request"("current_user_id" integer, "target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_role_management_permission"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the current user has admin or steering role
  RETURN EXISTS (
    SELECT 1 
    FROM roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'steering')
  );
END;
$$;


ALTER FUNCTION "public"."check_role_management_permission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_hospitality_hours_from_interest"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_group_name TEXT;
    v_date_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only process hospitality type entries
    IF NEW.type = 'hospitality' THEN
        -- Get the group name if available
        v_group_name := COALESCE(NEW.data->>'group_name', NEW.name || ' ' || NEW.last_initial || '.');
        
        -- Parse date and time (you may need to adjust this based on your actual data format)
        -- For now, we'll create a timestamp from day and time_slot
        v_date_time := to_timestamp(
            (NEW.data->>'day')::TEXT || ' ' || (NEW.data->>'time_slot')::TEXT || ' 2025',
            'Mon DD HH12:MI AM YYYY'
        );

        -- Insert the hospitality hours record
        INSERT INTO hospitality_hours (
            date_time,
            group_hosting,
            group_contact,
            group_email,
            group_phone,
            volunteering_interest_id,
            status,
            scheduled_hours
        ) VALUES (
            v_date_time,
            v_group_name,
            NEW.name,
            NEW.email,
            NEW.phone,
            NEW.id,
            'scheduled',
            2.0
        )
        ON CONFLICT (date_time, group_hosting) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_hospitality_hours_from_interest"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_role"("target_user_id" "uuid", "user_role" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if current user has permission
  IF NOT check_role_management_permission() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only admin and steering users can manage roles.'
    );
  END IF;

  -- Delete the role
  DELETE FROM roles
  WHERE user_id = target_user_id AND role = user_role;

  -- Check if role was found and deleted
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role not found for this user'
    );
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Role removed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."delete_user_role"("target_user_id" "uuid", "user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deny_share_request"("requester_id" integer, "current_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  request_exists boolean;
  current_user_schedule jsonb;
  requester_schedule jsonb;
  new_requested_share jsonb;
  new_pending_share jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(requester_id);
  PERFORM initialize_user_schedule(current_user_id);

  -- Get current schedules
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;
  SELECT schedule INTO requester_schedule FROM users WHERE users.id = requester_id;

  -- Check if request exists
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'requested_share') AS element
    WHERE
      (element::text = requester_id::text) OR
      (element::text = concat('"', requester_id, '"')) OR
      (element::jsonb = to_jsonb(requester_id))
  ) INTO request_exists;

  IF NOT request_exists THEN
    RETURN false; -- Request doesn't exist
  END IF;

  -- Remove requester from current user's requested_share array
  SELECT jsonb_agg(element)
  INTO new_requested_share
  FROM jsonb_array_elements(current_user_schedule->'requested_share') AS arr(element)
  WHERE
    (element::text != requester_id::text) AND
    (element::text != concat('"', requester_id, '"')) AND
    (element::jsonb != to_jsonb(requester_id));

  new_requested_share := COALESCE(new_requested_share, '[]'::jsonb);

  -- Remove current_user from requester's pending_share array
  SELECT jsonb_agg(element)
  INTO new_pending_share
  FROM jsonb_array_elements(requester_schedule->'pending_share') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_pending_share := COALESCE(new_pending_share, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{requested_share}',
    new_requested_share
  )
  WHERE users.id = current_user_id;

  -- Update requester's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{pending_share}',
    new_pending_share
  )
  WHERE users.id = requester_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."deny_share_request"("requester_id" integer, "current_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_user_roles"() RETURNS TABLE("user_id" "uuid", "role" "text", "permissions" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- First check if the current user has permission
  IF NOT check_role_management_permission() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Return all roles
  RETURN QUERY
  SELECT 
    r.user_id,
    r.role,
    r.permissions
  FROM roles r;
END;
$$;


ALTER FUNCTION "public"."get_all_user_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "email" character varying, "full_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(pu.user_id, au.id) as id,
    au.email,
    COALESCE(
      CASE 
        WHEN pu.first_name IS NOT NULL AND pu.last_initial IS NOT NULL 
        THEN pu.first_name || ' ' || pu.last_initial || '.'
        ELSE NULL
      END,
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      au.email::TEXT
    )::TEXT as full_name
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.user_id = au.id
  WHERE au.id = ANY(user_ids);
END;
$$;


ALTER FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) IS 'Get user names from auth.users table for given user IDs';



CREATE OR REPLACE FUNCTION "public"."get_hospitality_display_name"("vi_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_record RECORD;
    v_display_name TEXT;
BEGIN
    -- Get the volunteering_interest record
    SELECT name, last_initial, data->>'group_name' as group_name
    INTO v_record
    FROM volunteering_interest
    WHERE id = vi_id;

    -- Use group name if available, otherwise use First L. format
    IF v_record.group_name IS NOT NULL AND v_record.group_name != '' THEN
        v_display_name := v_record.group_name;
    ELSE
        -- Extract first name and combine with last initial
        v_display_name := split_part(v_record.name, ' ', 1) || ' ' || v_record.last_initial || '.';
    END IF;

    RETURN v_display_name;
END;
$$;


ALTER FUNCTION "public"."get_hospitality_display_name"("vi_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hospitality_slots"("p_program_id" bigint) RETURNS TABLE("id" bigint, "program_id" bigint, "date_time" timestamp with time zone, "group_hosting" "text", "planning_to_bring" "text", "room" "text", "scheduled_hours" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.program_id,
    h.date_time,
    h.group_hosting,
    h.planning_to_bring,
    h.room,
    h.scheduled_hours
  FROM hospitality_hours h
  WHERE h.program_id = p_program_id
    AND h.group_confirmed = true  -- Only show confirmed slots
  ORDER BY h.date_time ASC;
END;
$$;


ALTER FUNCTION "public"."get_hospitality_slots"("p_program_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_registration_data"() RETURNS TABLE("country" "text", "committee" "text", "city_state" "text", "order_date" "text", "report_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  select
    (d->>'Country')::text as country,
    (d->>'Committee')::text as committee,
    (d->>'City, State')::text as city_state,
    (d->>'Order date')::text as order_date,
    r.created_at as report_created_at
  from
    registrations r,
    jsonb_array_elements(r.data) as d
  where
    r.id = (select id from registrations order by created_at desc limit 1);
end;
$$;


ALTER FUNCTION "public"."get_public_registration_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_user_info"("user_id" integer) RETURNS TABLE("id" integer, "first_name" "text", "last_initial" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_initial
  FROM users u
  WHERE u.id = user_id;
END;
$$;


ALTER FUNCTION "public"."get_public_user_info"("user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_users_info"("user_ids" integer[]) RETURNS TABLE("id" integer, "first_name" "text", "last_initial" "text", "profile_image" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.first_name,
    u.last_initial,
    u.profile_image
  FROM users u
  WHERE u.id = ANY(user_ids);
END;
$$;


ALTER FUNCTION "public"."get_public_users_info"("user_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_saved_events"("p_device_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id int4;
  current_user_schedule jsonb;
  shared_by_users int[];
  shared_user_id int4;
  shared_user_schedule jsonb;
  shared_user_info record;
  result jsonb := '{}'::jsonb;
BEGIN
  -- Get the user ID from the device ID
  SELECT id INTO current_user_id
  FROM users
  WHERE device_id = p_device_id;

  -- Return empty object if user not found
  IF current_user_id IS NULL THEN
    RETURN result;
  END IF;

  -- Initialize user's schedule if needed
  PERFORM initialize_user_schedule(current_user_id);

  -- Get the user's schedule
  SELECT schedule INTO current_user_schedule FROM users WHERE id = current_user_id;

  -- Extract the shared_by array into a PostgreSQL array for easier iteration
  SELECT array_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN element::text::integer
      WHEN jsonb_typeof(element) = 'number' THEN element::text::integer
      ELSE NULL
    END
  )
  INTO shared_by_users
  FROM jsonb_array_elements(current_user_schedule->'shared_by') AS arr(element)
  WHERE element IS NOT NULL;

  -- Return empty object if no users are sharing their schedule
  IF shared_by_users IS NULL OR array_length(shared_by_users, 1) = 0 THEN
    RETURN result;
  END IF;

  -- For each user in shared_by, get their info and saved_events
  FOR i IN 1..array_length(shared_by_users, 1) LOOP
    shared_user_id := shared_by_users[i];

    -- Skip if user ID is null
    IF shared_user_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Initialize this user's schedule if needed
    PERFORM initialize_user_schedule(shared_user_id);

    -- Get user info and their schedule
    -- Use COALESCE directly in the SELECT statement to handle NULLs
    SELECT
      COALESCE(u.first_name, '') as first_name,
      COALESCE(u.last_initial, '') as last_initial,
      COALESCE(u.profile_image, '') as profile_image,
      u.schedule
    INTO shared_user_info
    FROM users u
    WHERE u.id = shared_user_id;

    -- Add their info and saved_events to the result
    IF shared_user_info IS NOT NULL AND
       shared_user_info.schedule IS NOT NULL AND
       shared_user_info.schedule->'saved_events' IS NOT NULL THEN

      -- Add this user's info to the result object using user_id as key
      result := result || jsonb_build_object(
        shared_user_id::text, jsonb_build_object(
          'first_name', shared_user_info.first_name,
          'last_initial', shared_user_info.last_initial,
          'profile_image', shared_user_info.profile_image,
          'saved_events', shared_user_info.schedule->'saved_events'
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_shared_saved_events"("p_device_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_volunteering_interest_by_type"("interest_type" "text") RETURNS TABLE("data" "jsonb")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT data
  FROM volunteering_interest
  WHERE type = interest_type;
$$;


ALTER FUNCTION "public"."get_volunteering_interest_by_type"("interest_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_volunteering_interest_safe"() RETURNS TABLE("id" integer, "name" "text", "last_initial" "text", "email" "text", "phone" "text", "type" "text", "data" "jsonb", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT
        v.id,
        v.name,
        v.last_initial,
        -- Return email based on permissions
        CASE WHEN EXISTS (
            SELECT 1 FROM roles
            WHERE roles.user_id = auth.uid()
            AND (
                roles.role IN ('admin', 'steering') OR
                roles.permissions::text[] @> ARRAY['volunteering:sensitive']
            )
        ) THEN v.email ELSE NULL END as email,
        -- Return phone based on permissions
        CASE WHEN EXISTS (
            SELECT 1 FROM roles
            WHERE roles.user_id = auth.uid()
            AND (
                roles.role IN ('admin', 'steering') OR
                roles.permissions::text[] @> ARRAY['volunteering:sensitive']
            )
        ) THEN v.phone ELSE NULL END as phone,
        v.type,
        v.data,
        v.status,
        v.created_at
    FROM volunteering_interest v;
$$;


ALTER FUNCTION "public"."get_volunteering_interest_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_user_schedule"("target_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  temp_schedule jsonb;
BEGIN
  -- Initialize schedule if it doesn't exist or has null arrays
  UPDATE users
  SET schedule = COALESCE(
    schedule,
    jsonb_build_object(
      'saved_events', jsonb_build_array(),
      'requested_share', jsonb_build_array(),
      'shared_with', jsonb_build_array(),
      'pending_share', jsonb_build_array(),
      'shared_by', jsonb_build_array(),
      'banned', jsonb_build_array()
    )
  )
  WHERE users.id = target_id
  AND (
    schedule IS NULL
    OR NOT (schedule ? 'saved_events')
    OR NOT (schedule ? 'requested_share')
    OR NOT (schedule ? 'shared_with')
    OR NOT (schedule ? 'pending_share')
    OR NOT (schedule ? 'shared_by')
    OR NOT (schedule ? 'banned')
  );

  -- First get the current schedule
  SELECT schedule INTO temp_schedule FROM users WHERE users.id = target_id;

  -- Only perform update if needed
  IF temp_schedule IS NOT NULL THEN
    -- Apply all jsonb_set operations in sequence to build the final value
    temp_schedule := jsonb_set(temp_schedule, '{saved_events}', COALESCE(temp_schedule->'saved_events', '[]'::jsonb));
    temp_schedule := jsonb_set(temp_schedule, '{requested_share}', COALESCE(temp_schedule->'requested_share', '[]'::jsonb));
    temp_schedule := jsonb_set(temp_schedule, '{shared_with}', COALESCE(temp_schedule->'shared_with', '[]'::jsonb));
    temp_schedule := jsonb_set(temp_schedule, '{pending_share}', COALESCE(temp_schedule->'pending_share', '[]'::jsonb));
    temp_schedule := jsonb_set(temp_schedule, '{shared_by}', COALESCE(temp_schedule->'shared_by', '[]'::jsonb));
    temp_schedule := jsonb_set(temp_schedule, '{banned}', COALESCE(temp_schedule->'banned', '[]'::jsonb));

    -- Update with the final computed value
    UPDATE users SET schedule = temp_schedule WHERE users.id = target_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."initialize_user_schedule"("target_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_user_schedule"("device_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_id int4;
BEGIN
  -- Get the user ID associated with this device
  SELECT id INTO user_id FROM users WHERE users.device_id = initialize_user_schedule.device_id;

  IF user_id IS NULL THEN
    RETURN; -- User not found
  END IF;

  -- Initialize schedule if it doesn't exist or has null arrays
  UPDATE users
  SET schedule = COALESCE(
    schedule,
    jsonb_build_object(
      'saved_events', jsonb_build_array(),
      'requested_share', jsonb_build_array(),
      'shared_with', jsonb_build_array(),
      'pending_share', jsonb_build_array(),
      'shared_by', jsonb_build_array(),
      'banned', jsonb_build_array()
    )
  )
  WHERE users.id = user_id
  AND (
    schedule IS NULL
    OR NOT (schedule ? 'saved_events')
    OR NOT (schedule ? 'requested_share')
    OR NOT (schedule ? 'shared_with')
    OR NOT (schedule ? 'pending_share')
    OR NOT (schedule ? 'shared_by')
    OR NOT (schedule ? 'banned')
  );

  -- Ensure all arrays exist (even if schedule itself exists)
  UPDATE users
  SET
    schedule = jsonb_set(schedule, '{saved_events}', COALESCE(schedule->'saved_events', '[]'::jsonb)),
    schedule = jsonb_set(schedule, '{requested_share}', COALESCE(schedule->'requested_share', '[]'::jsonb)),
    schedule = jsonb_set(schedule, '{shared_with}', COALESCE(schedule->'shared_with', '[]'::jsonb)),
    schedule = jsonb_set(schedule, '{pending_share}', COALESCE(schedule->'pending_share', '[]'::jsonb)),
    schedule = jsonb_set(schedule, '{shared_by}', COALESCE(schedule->'shared_by', '[]'::jsonb)),
    schedule = jsonb_set(schedule, '{banned}', COALESCE(schedule->'banned', '[]'::jsonb))
  WHERE users.id = user_id;
END;
$$;


ALTER FUNCTION "public"."initialize_user_schedule"("device_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM roles
  WHERE user_id = auth.uid();
  
  -- Admin and steering members can insert roles
  IF current_user_role NOT IN ('admin', 'steering') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admin and steering committee members can assign roles'
    );
  END IF;
  
  -- Prevent creation of admin roles through this function
  IF user_role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be created through the UI'
    );
  END IF;
  
  -- Insert the new role
  INSERT INTO roles (user_id, role, permissions, created_at, updated_at)
  VALUES (target_user_id, user_role, user_permissions, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Role assigned successfully'
  );
END;
$$;


ALTER FUNCTION "public"."insert_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_sharing"("current_user_id" integer, "target_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_sharing boolean;
  current_user_schedule jsonb;
  target_user_schedule jsonb;
  new_shared_with jsonb;
  new_shared_by jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(current_user_id);
  PERFORM initialize_user_schedule(target_user_id);

  -- Get current schedules
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;
  SELECT schedule INTO target_user_schedule FROM users WHERE users.id = target_user_id;

  -- Check if current user is sharing with target
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'shared_with') AS element
    WHERE
      (element::text = target_user_id::text) OR
      (element::text = concat('"', target_user_id, '"')) OR
      (element::jsonb = to_jsonb(target_user_id))
  ) INTO is_sharing;

  IF NOT is_sharing THEN
    RETURN false; -- Not sharing with target
  END IF;

  -- Remove target from current user's shared_with array
  SELECT jsonb_agg(element)
  INTO new_shared_with
  FROM jsonb_array_elements(current_user_schedule->'shared_with') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_shared_with := COALESCE(new_shared_with, '[]'::jsonb);

  -- Remove current user from target's shared_by array
  SELECT jsonb_agg(element)
  INTO new_shared_by
  FROM jsonb_array_elements(target_user_schedule->'shared_by') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_shared_by := COALESCE(new_shared_by, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{shared_with}',
    new_shared_with
  )
  WHERE users.id = current_user_id;

  -- Update target's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{shared_by}',
    new_shared_by
  )
  WHERE users.id = target_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_sharing"("current_user_id" integer, "target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_schedule_share"("requester_id" integer, "target_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_banned boolean;
  already_requested boolean;
  already_sharing boolean;
  target_schedule jsonb;
  requester_schedule jsonb;
  new_requested_share jsonb;
  new_pending_share jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(requester_id);
  PERFORM initialize_user_schedule(target_id);

  -- Get current schedules
  SELECT schedule INTO target_schedule FROM users WHERE users.id = target_id;
  SELECT schedule INTO requester_schedule FROM users WHERE users.id = requester_id;

  -- Check if requester is banned by target
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(target_schedule->'banned') AS element
    WHERE
      (element::text = requester_id::text) OR
      (element::text = concat('"', requester_id, '"')) OR
      (element::jsonb = to_jsonb(requester_id))
  ) INTO is_banned;

  IF is_banned THEN
    RETURN false; -- Can't request if banned
  END IF;

  -- Check if already requested
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(target_schedule->'requested_share') AS element
    WHERE
      (element::text = requester_id::text) OR
      (element::text = concat('"', requester_id, '"')) OR
      (element::jsonb = to_jsonb(requester_id))
  ) INTO already_requested;

  -- Check if already sharing
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(target_schedule->'shared_with') AS element
    WHERE
      (element::text = requester_id::text) OR
      (element::text = concat('"', requester_id, '"')) OR
      (element::jsonb = to_jsonb(requester_id))
  ) INTO already_sharing;

  IF already_requested OR already_sharing THEN
    RETURN false; -- Already requested or sharing
  END IF;

  -- Add requester to target's requested_share array
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN
        to_jsonb(element::text::integer)
      ELSE
        element
    END
  )
  INTO new_requested_share
  FROM (
    SELECT element
    FROM jsonb_array_elements(target_schedule->'requested_share') AS arr(element)

    UNION ALL

    SELECT to_jsonb(requester_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(target_schedule->'requested_share') AS e
      WHERE
        (e::text = requester_id::text) OR
        (e::text = concat('"', requester_id, '"')) OR
        (e::jsonb = to_jsonb(requester_id))
    )
  ) AS elements;

  new_requested_share := COALESCE(new_requested_share, '[]'::jsonb);

  -- Add target to requester's pending_share array
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(element) = 'string' THEN
        to_jsonb(element::text::integer)
      ELSE
        element
    END
  )
  INTO new_pending_share
  FROM (
    SELECT element
    FROM jsonb_array_elements(requester_schedule->'pending_share') AS arr(element)

    UNION ALL

    SELECT to_jsonb(target_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(requester_schedule->'pending_share') AS e
      WHERE
        (e::text = target_id::text) OR
        (e::text = concat('"', target_id, '"')) OR
        (e::jsonb = to_jsonb(target_id))
    )
  ) AS elements;

  new_pending_share := COALESCE(new_pending_share, '[]'::jsonb);

  -- Update target's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{requested_share}',
    new_requested_share
  )
  WHERE users.id = target_id;

  -- Update requester's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{pending_share}',
    new_pending_share
  )
  WHERE users.id = requester_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."request_schedule_share"("requester_id" integer, "target_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stop_viewing_schedule"("current_user_id" integer, "target_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_viewing boolean;
  current_user_schedule jsonb;
  target_user_schedule jsonb;
  new_shared_by jsonb;
  new_shared_with jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(current_user_id);
  PERFORM initialize_user_schedule(target_user_id);

  -- Get current schedules
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;
  SELECT schedule INTO target_user_schedule FROM users WHERE users.id = target_user_id;

  -- Check if current user is viewing target's schedule
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'shared_by') AS element
    WHERE
      (element::text = target_user_id::text) OR
      (element::text = concat('"', target_user_id, '"')) OR
      (element::jsonb = to_jsonb(target_user_id))
  ) INTO is_viewing;

  IF NOT is_viewing THEN
    RETURN false; -- Not viewing
  END IF;

  -- Remove target from current user's shared_by array
  SELECT jsonb_agg(element)
  INTO new_shared_by
  FROM jsonb_array_elements(current_user_schedule->'shared_by') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_shared_by := COALESCE(new_shared_by, '[]'::jsonb);

  -- Remove current user from target's shared_with array
  SELECT jsonb_agg(element)
  INTO new_shared_with
  FROM jsonb_array_elements(target_user_schedule->'shared_with') AS arr(element)
  WHERE
    (element::text != current_user_id::text) AND
    (element::text != concat('"', current_user_id, '"')) AND
    (element::jsonb != to_jsonb(current_user_id));

  new_shared_with := COALESCE(new_shared_with, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{shared_by}',
    new_shared_by
  )
  WHERE users.id = current_user_id;

  -- Update target's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{shared_with}',
    new_shared_with
  )
  WHERE users.id = target_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."stop_viewing_schedule"("current_user_id" integer, "target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unban_user"("current_user_id" integer, "target_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_banned boolean;
  current_user_schedule jsonb;
  new_banned jsonb;
BEGIN
  -- Initialize schedules for both users
  PERFORM initialize_user_schedule(current_user_id);
  PERFORM initialize_user_schedule(target_user_id);

  -- Get current schedule
  SELECT schedule INTO current_user_schedule FROM users WHERE users.id = current_user_id;

  -- Check if target is banned
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(current_user_schedule->'banned') AS element
    WHERE
      (element::text = target_user_id::text) OR
      (element::text = concat('"', target_user_id, '"')) OR
      (element::jsonb = to_jsonb(target_user_id))
  ) INTO is_banned;

  IF NOT is_banned THEN
    RETURN false; -- Not banned
  END IF;

  -- Remove target from banned array
  SELECT jsonb_agg(element)
  INTO new_banned
  FROM jsonb_array_elements(current_user_schedule->'banned') AS arr(element)
  WHERE
    (element::text != target_user_id::text) AND
    (element::text != concat('"', target_user_id, '"')) AND
    (element::jsonb != to_jsonb(target_user_id));

  new_banned := COALESCE(new_banned, '[]'::jsonb);

  -- Update current user's schedule
  UPDATE users
  SET schedule = jsonb_set(
    schedule,
    '{banned}',
    new_banned
  )
  WHERE users.id = current_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."unban_user"("current_user_id" integer, "target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_role TEXT;
  target_current_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM roles
  WHERE user_id = auth.uid();
  
  -- Admin and steering members can update roles
  IF current_user_role NOT IN ('admin', 'steering') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admin and steering committee members can modify roles'
    );
  END IF;
  
  -- Get target user's current role
  SELECT role INTO target_current_role
  FROM roles
  WHERE user_id = target_user_id;
  
  -- Prevent modification of admin roles
  IF target_current_role = 'admin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin roles cannot be modified'
    );
  END IF;
  
  -- Update the role
  UPDATE roles
  SET 
    role = user_role,
    permissions = user_permissions,
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Role updated successfully'
  );
END;
$$;


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accessibility_forms" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "need_type" "text" NOT NULL,
    "details" "text",
    "arrival_date" "text" NOT NULL,
    "duration" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "program_id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "owner_id" "uuid"
);


ALTER TABLE "public"."accessibility_forms" OWNER TO "postgres";


ALTER TABLE "public"."accessibility_forms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."accessibility_forms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image" "text",
    "location" "text" NOT NULL,
    "distance" numeric
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


ALTER TABLE "public"."activities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."activities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" bigint NOT NULL,
    "user" "uuid" DEFAULT "auth"."uid"(),
    "action" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity" IS 'User Activity';



ALTER TABLE "public"."activity" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."activity_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."committee_mappings" (
    "id" integer NOT NULL,
    "input_name" "text" NOT NULL,
    "mapped_to" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."committee_mappings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."committee_mappings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."committee_mappings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."committee_mappings_id_seq" OWNED BY "public"."committee_mappings"."id";



CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "title" "text" NOT NULL,
    "color" "text" NOT NULL
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


ALTER TABLE "public"."event_categories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."event_categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image" "text",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "location" "text" NOT NULL,
    "event_category_id" integer NOT NULL,
    "can_save" boolean NOT NULL,
    "speakers" "text"[],
    "chairpeople" "text"[] DEFAULT '{}'::"text"[],
    "cta_link" "text",
    "asl" boolean DEFAULT false,
    "es_som_hmn" boolean DEFAULT false,
    "hybrid" boolean DEFAULT false,
    "languages" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."chairpeople" IS 'Array of chairpeople names for the event';



COMMENT ON COLUMN "public"."events"."asl" IS 'American Sign Language interpretation available';



COMMENT ON COLUMN "public"."events"."es_som_hmn" IS 'Spanish/Somali/Hmong language interpretation available';



COMMENT ON COLUMN "public"."events"."hybrid" IS 'Hybrid meeting with both in-person and online attendance options';



COMMENT ON COLUMN "public"."events"."languages" IS 'Array of language interpretation options available (e.g., spanish, somali, hmong)';



CREATE TABLE IF NOT EXISTS "public"."pre-conf-events" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "date" "text" NOT NULL,
    "time" "text" NOT NULL,
    "location" "text" NOT NULL,
    "image_url" "text",
    "is_icypaa_event" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "creator" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."pre-conf-events" OWNER TO "postgres";


ALTER TABLE "public"."pre-conf-events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image" "text",
    "location" "text" NOT NULL,
    "distance" numeric,
    "menu" "text"
);


ALTER TABLE "public"."food" OWNER TO "postgres";


COMMENT ON COLUMN "public"."food"."menu" IS 'URL to a menu for this food location';



ALTER TABLE "public"."food" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."food_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."hospitality_forms" (
    "id" integer NOT NULL,
    "group_name" "text" NOT NULL,
    "item_description" "text" NOT NULL,
    "allergies" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "program_id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "owner_id" "uuid"
);


ALTER TABLE "public"."hospitality_forms" OWNER TO "postgres";


ALTER TABLE "public"."hospitality_forms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."hospitality_forms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."hospitality_hours" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date_time" timestamp with time zone NOT NULL,
    "group_hosting" "text",
    "group_contact" "text",
    "group_confirmed" boolean DEFAULT false,
    "group_phone" "text",
    "group_email" "text",
    "planning_to_bring" "text",
    "room" "text",
    "scheduled_hours" numeric(4,2) DEFAULT 2.0,
    "volunteering_interest_id" bigint,
    "program_id" bigint
);


ALTER TABLE "public"."hospitality_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."hospitality_hours" IS 'Public tracking of hospitality volunteer hours with group hosting information - simplified to track only confirmed status';



COMMENT ON COLUMN "public"."hospitality_hours"."date_time" IS 'Date and time of the hospitality slot';



COMMENT ON COLUMN "public"."hospitality_hours"."group_hosting" IS 'Name of the group hosting this time slot';



COMMENT ON COLUMN "public"."hospitality_hours"."group_contact" IS 'Primary contact person for the group';



COMMENT ON COLUMN "public"."hospitality_hours"."group_confirmed" IS 'Whether the group has confirmed their slot';



COMMENT ON COLUMN "public"."hospitality_hours"."group_phone" IS 'Contact phone number (internal use)';



COMMENT ON COLUMN "public"."hospitality_hours"."group_email" IS 'Contact email address (internal use)';



COMMENT ON COLUMN "public"."hospitality_hours"."planning_to_bring" IS 'What the group plans to bring for hospitality';



COMMENT ON COLUMN "public"."hospitality_hours"."scheduled_hours" IS 'Scheduled hours for the shift (default 2 hours)';



COMMENT ON COLUMN "public"."hospitality_hours"."volunteering_interest_id" IS 'Internal link to volunteering_interest record';



ALTER TABLE "public"."hospitality_hours" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."hospitality_hours_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" integer NOT NULL,
    "program_id" integer,
    "user_id" "uuid",
    "notification_type" "text",
    "service_type" "text",
    "request_id" "text",
    "status" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."notification_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_logs_id_seq" OWNED BY "public"."notification_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."oncall_assignments" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "service_type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."oncall_assignments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."oncall_assignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."oncall_assignments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."oncall_assignments_id_seq" OWNED BY "public"."oncall_assignments"."id";



CREATE TABLE IF NOT EXISTS "public"."outreach_reminders" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "details" "text",
    "frequency" "text",
    "reminder_buffer" "text",
    "people" "jsonb"[]
);


ALTER TABLE "public"."outreach_reminders" OWNER TO "postgres";


ALTER TABLE "public"."outreach_reminders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."outreach_reminders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."panel_chairpeople" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "phone" "text",
    "day_time" "text" NOT NULL,
    "panel_name" "text" NOT NULL,
    "panel_id" bigint,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."panel_chairpeople" OWNER TO "postgres";


COMMENT ON TABLE "public"."panel_chairpeople" IS 'Storage for panel chairpeople imported from Excel';



COMMENT ON COLUMN "public"."panel_chairpeople"."name" IS 'Chairperson name';



COMMENT ON COLUMN "public"."panel_chairpeople"."phone" IS 'Chairperson phone number';



COMMENT ON COLUMN "public"."panel_chairpeople"."day_time" IS 'Day and time from the Excel file';



COMMENT ON COLUMN "public"."panel_chairpeople"."panel_name" IS 'Panel name from the Excel file';



COMMENT ON COLUMN "public"."panel_chairpeople"."panel_id" IS 'Foreign key to panel_notifications if matched';



COMMENT ON COLUMN "public"."panel_chairpeople"."raw_data" IS 'Original row data from Excel import';



ALTER TABLE "public"."panel_chairpeople" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."panel_chairpeople_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."panel_notifications" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "time_day" "text" NOT NULL,
    "room" "text" NOT NULL,
    "title" "text" NOT NULL,
    "topic" "text",
    "description" "text",
    "literature_reference" "text",
    "panelist_name" "text" NOT NULL,
    "panelist_contact" "text" NOT NULL,
    "contact_type" "text" NOT NULL,
    "notification_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "confirmation_token" "uuid" DEFAULT "extensions"."uuid_generate_v4"(),
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "denied_at" timestamp with time zone,
    "send_status" "text",
    "send_error" "text",
    "reminder_followup_sent_at" timestamp with time zone,
    "reminder_send_status" "text",
    "reminder_send_error" "text",
    "reminder2_followup_sent_at" timestamp with time zone,
    "reminder2_send_status" "text",
    "reminder2_send_error" "text",
    "twilio_message_sid" "text",
    "twilio_reminder_sid" "text",
    "twilio_reminder2_sid" "text",
    "reminder3_followup_sent_at" timestamp with time zone,
    "reminder3_send_status" "text",
    "reminder3_send_error" "text",
    "twilio_reminder3_sid" "text",
    CONSTRAINT "panel_notifications_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['email'::"text", 'phone'::"text"]))),
    CONSTRAINT "panel_notifications_reminder2_send_status_check" CHECK (("reminder2_send_status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text"]))),
    CONSTRAINT "panel_notifications_reminder3_send_status_check" CHECK (("reminder3_send_status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text"]))),
    CONSTRAINT "panel_notifications_reminder_send_status_check" CHECK (("reminder_send_status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text"]))),
    CONSTRAINT "panel_notifications_send_status_check" CHECK (("send_status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."panel_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."panel_notifications" IS 'Panel information and panelist notification tracking combined';



COMMENT ON COLUMN "public"."panel_notifications"."time_day" IS 'Day and time of the panel';



COMMENT ON COLUMN "public"."panel_notifications"."contact_type" IS 'Type of contact method used (email or phone)';



COMMENT ON COLUMN "public"."panel_notifications"."notification_sent_at" IS 'Timestamp when notification was sent (null means not sent)';



COMMENT ON COLUMN "public"."panel_notifications"."confirmed_at" IS 'Timestamp when panelist confirmed (null means not confirmed)';



COMMENT ON COLUMN "public"."panel_notifications"."confirmation_token" IS 'Unique token for panelist confirmation';



COMMENT ON COLUMN "public"."panel_notifications"."denied_at" IS 'Timestamp when panelist withdrew/denied participation (null means not denied)';



COMMENT ON COLUMN "public"."panel_notifications"."send_status" IS 'Status of the initial notification send attempt (success, failed, pending)';



COMMENT ON COLUMN "public"."panel_notifications"."send_error" IS 'Error message if the initial notification send failed';



COMMENT ON COLUMN "public"."panel_notifications"."reminder_followup_sent_at" IS 'Timestamp when reminder follow-up was sent';



COMMENT ON COLUMN "public"."panel_notifications"."reminder_send_status" IS 'Status of the reminder send attempt (success, failed, pending)';



COMMENT ON COLUMN "public"."panel_notifications"."reminder_send_error" IS 'Error message if the reminder send failed';



COMMENT ON COLUMN "public"."panel_notifications"."reminder2_followup_sent_at" IS 'Timestamp when second reminder follow-up was sent';



COMMENT ON COLUMN "public"."panel_notifications"."reminder2_send_status" IS 'Status of the second reminder send attempt (success, failed, pending)';



COMMENT ON COLUMN "public"."panel_notifications"."reminder2_send_error" IS 'Error message if the second reminder send failed';



COMMENT ON COLUMN "public"."panel_notifications"."twilio_message_sid" IS 'Twilio message SID for initial notification SMS';



COMMENT ON COLUMN "public"."panel_notifications"."twilio_reminder_sid" IS 'Twilio message SID for first reminder SMS';



COMMENT ON COLUMN "public"."panel_notifications"."twilio_reminder2_sid" IS 'Twilio message SID for second reminder SMS';



ALTER TABLE "public"."panel_notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."panel_notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile-names" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "profile_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp without time zone DEFAULT "now"(),
    "discord_roles" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."profile-names" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profile-names"."discord_roles" IS 'Array of Discord role IDs for the user in the ICYPAA server';



ALTER TABLE "public"."profile-names" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profile-names_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "logo" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "location" "jsonb" NOT NULL,
    "venue_rooms" "text"[],
    "hospitality" "jsonb" NOT NULL,
    "theme" "text" NOT NULL,
    "big_book_passage" "text" NOT NULL,
    "design" "jsonb",
    "promote" numeric[],
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "supported_languages" "jsonb" DEFAULT '["en"]'::"jsonb",
    "childcare_hours" "jsonb",
    "features" "jsonb" DEFAULT '{"child_care_enabled": true, "hospitality_enabled": true, "bid_schedule_enabled": true, "support_chat_enabled": true, "volunteering_enabled": true, "accessibility_enabled": true, "schedule_sharing_enabled": true, "push_notifications_enabled": true}'::"jsonb",
    "host_committee" "jsonb",
    "ndah_content" "jsonb"
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


ALTER TABLE "public"."programs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."programs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."registrations" (
    "id" bigint NOT NULL,
    "registrations" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp without time zone DEFAULT "now"(),
    "countries" smallint,
    "us_states" smallint,
    "data" "jsonb",
    "scholarships" "jsonb"
);


ALTER TABLE "public"."registrations" OWNER TO "postgres";


ALTER TABLE "public"."registrations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."registrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "type" "text" NOT NULL,
    "time" "text" NOT NULL,
    "place" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "modified_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "reports_due" "text"
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reminders"."reports_due" IS 'Indicates when reports are due (day of week) or not_required if no reports are due';



CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team" "text" NOT NULL,
    "chair_position" "text" NOT NULL,
    "current_work" "text" NOT NULL,
    "needs_help" "text" NOT NULL,
    "team_meeting_items" "text" NOT NULL,
    "agenda_doc_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_work" "text" NOT NULL,
    "is_nothing_to_report" boolean DEFAULT false,
    "share_in_meeting" "text",
    CONSTRAINT "reports_team_check" CHECK (("team" = ANY (ARRAY['MAIN_MEETING'::"text", 'HOST_TEAM_1'::"text", 'HOST_TEAM_2'::"text", 'HOST_TEAM_3'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reports"."completed_work" IS 'Work completed since the last meeting';



COMMENT ON COLUMN "public"."reports"."is_nothing_to_report" IS 'Flag indicating if this is a nothing to report submission';



CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


ALTER TABLE "public"."resources" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."resources_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ride_forms" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "location" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "datetime" timestamp with time zone NOT NULL,
    "passengers" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "program_id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "owner_id" "uuid"
);


ALTER TABLE "public"."ride_forms" OWNER TO "postgres";


ALTER TABLE "public"."ride_forms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ride_forms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'host'::"text" NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."security_time_slot_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "volunteer_id" bigint NOT NULL,
    "volunteer_name" "text" NOT NULL,
    "day" "text" NOT NULL,
    "block" "text" NOT NULL,
    "slot" "text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);


ALTER TABLE "public"."security_time_slot_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "job_type" "text" NOT NULL,
    "location" "jsonb",
    "min_volunteers" integer DEFAULT 1,
    "max_volunteers" integer DEFAULT 1,
    "assignments" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shifts"."location" IS 'Array of venue room names';



CREATE TABLE IF NOT EXISTS "public"."sms_agreements" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "device_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "permission" boolean DEFAULT true NOT NULL,
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."sms_agreements" OWNER TO "postgres";


ALTER TABLE "public"."sms_agreements" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sms_agreements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sms_delivery_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notification_id" bigint,
    "message_sid" "text" NOT NULL,
    "message_status" "text" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "to_number" "text",
    "from_number" "text",
    "reminder_type" "text",
    "webhook_data" "jsonb"
);


ALTER TABLE "public"."sms_delivery_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."sms_delivery_logs" IS 'Logs all Twilio webhook events for SMS delivery tracking and debugging';



ALTER TABLE "public"."sms_delivery_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sms_delivery_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."support_chats" (
    "id" integer NOT NULL,
    "chat_title" "text" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "device_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "owner_id" "uuid",
    "program_id" integer NOT NULL
);


ALTER TABLE "public"."support_chats" OWNER TO "postgres";


ALTER TABLE "public"."support_chats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."support_chats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."transportation" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "maps" "jsonb",
    "travel_details" "jsonb"
);


ALTER TABLE "public"."transportation" OWNER TO "postgres";


ALTER TABLE "public"."transportation" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."transportation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."twilio_messages" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "to_number" "text" NOT NULL,
    "from_number" "text" NOT NULL,
    "message_body" "text" NOT NULL,
    "message_sid" "text",
    "status" "text",
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."twilio_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."twilio_messages" IS 'Stores history of all Twilio SMS messages sent from the application';



CREATE SEQUENCE IF NOT EXISTS "public"."twilio_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."twilio_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."twilio_messages_id_seq" OWNED BY "public"."twilio_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "device_id" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_initial" "text" NOT NULL,
    "profile_image" "text",
    "schedule" "jsonb",
    "settings" "jsonb",
    "user_id" "uuid",
    "expo_push_token" "text",
    "show_bid_schedule" boolean DEFAULT false
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."expo_push_token" IS 'Expo push notification token for sending notifications to this user';



ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" integer NOT NULL,
    "program_id" integer NOT NULL,
    "floors" "jsonb",
    "amenities" "jsonb"
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE "public"."venues" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."venues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."volunteering" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "event_id" bigint,
    "jobs" "json"
);


ALTER TABLE "public"."volunteering" OWNER TO "postgres";


ALTER TABLE "public"."volunteering" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."volunteering_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."volunteering_interest" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "last_initial" "text",
    "phone" "text",
    "email" "text",
    "type" "text",
    "data" "jsonb",
    "program_id" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL
);


ALTER TABLE "public"."volunteering_interest" OWNER TO "postgres";


ALTER TABLE "public"."volunteering_interest" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."volunteering_interest_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."committee_mappings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."committee_mappings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."oncall_assignments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."oncall_assignments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."twilio_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."twilio_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accessibility_forms"
    ADD CONSTRAINT "accessibility_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_mappings"
    ADD CONSTRAINT "committee_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pre-conf-events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food"
    ADD CONSTRAINT "food_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hospitality_forms"
    ADD CONSTRAINT "hospitality_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hospitality_hours"
    ADD CONSTRAINT "hospitality_hours_date_time_group_hosting_key" UNIQUE ("date_time", "group_hosting");



ALTER TABLE ONLY "public"."hospitality_hours"
    ADD CONSTRAINT "hospitality_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oncall_assignments"
    ADD CONSTRAINT "oncall_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outreach_reminders"
    ADD CONSTRAINT "outreach_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panel_chairpeople"
    ADD CONSTRAINT "panel_chairpeople_name_panel_name_day_time_key" UNIQUE ("name", "panel_name", "day_time");



ALTER TABLE ONLY "public"."panel_chairpeople"
    ADD CONSTRAINT "panel_chairpeople_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panel_notifications"
    ADD CONSTRAINT "panel_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panel_notifications"
    ADD CONSTRAINT "panel_notifications_title_time_day_room_panelist_contact_key" UNIQUE ("title", "time_day", "room", "panelist_contact");



ALTER TABLE ONLY "public"."profile-names"
    ADD CONSTRAINT "profile-names_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile-names"
    ADD CONSTRAINT "profile_names_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_type_key" UNIQUE ("type");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_forms"
    ADD CONSTRAINT "ride_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."security_time_slot_assignments"
    ADD CONSTRAINT "security_time_slot_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_time_slot_assignments"
    ADD CONSTRAINT "security_time_slot_assignments_volunteer_id_day_block_slot_key" UNIQUE ("volunteer_id", "day", "block", "slot");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_agreements"
    ADD CONSTRAINT "sms_agreements_device_id_key" UNIQUE ("device_id");



ALTER TABLE ONLY "public"."sms_agreements"
    ADD CONSTRAINT "sms_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_delivery_logs"
    ADD CONSTRAINT "sms_delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_chats"
    ADD CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transportation"
    ADD CONSTRAINT "transportation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."twilio_messages"
    ADD CONSTRAINT "twilio_messages_message_sid_key" UNIQUE ("message_sid");



ALTER TABLE ONLY "public"."twilio_messages"
    ADD CONSTRAINT "twilio_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_mappings"
    ADD CONSTRAINT "unique_input_name" UNIQUE ("input_name");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_device_id_key" UNIQUE ("device_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_program_id_unique" UNIQUE ("program_id");



ALTER TABLE ONLY "public"."volunteering_interest"
    ADD CONSTRAINT "volunteering_interest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteering"
    ADD CONSTRAINT "volunteering_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accessibility_forms_owner" ON "public"."accessibility_forms" USING "btree" ("owner_id");



CREATE INDEX "idx_accessibility_forms_status" ON "public"."accessibility_forms" USING "btree" ("status");



CREATE INDEX "idx_accessibility_forms_user_id" ON "public"."accessibility_forms" USING "btree" ("user_id");



CREATE INDEX "idx_activities_program_id" ON "public"."activities" USING "btree" ("program_id");



CREATE INDEX "idx_event_categories_program_id" ON "public"."event_categories" USING "btree" ("program_id");



CREATE INDEX "idx_events_asl" ON "public"."events" USING "btree" ("asl") WHERE ("asl" = true);



CREATE INDEX "idx_events_chairpeople" ON "public"."events" USING "gin" ("chairpeople");



CREATE INDEX "idx_events_es_som_hmn" ON "public"."events" USING "btree" ("es_som_hmn") WHERE ("es_som_hmn" = true);



CREATE INDEX "idx_events_event_category_id" ON "public"."events" USING "btree" ("event_category_id");



CREATE INDEX "idx_events_hybrid" ON "public"."events" USING "btree" ("hybrid") WHERE ("hybrid" = true);



CREATE INDEX "idx_events_languages" ON "public"."events" USING "gin" ("languages");



CREATE INDEX "idx_events_program_id" ON "public"."events" USING "btree" ("program_id");



CREATE INDEX "idx_food_program_id" ON "public"."food" USING "btree" ("program_id");



CREATE INDEX "idx_hospitality_forms_owner" ON "public"."hospitality_forms" USING "btree" ("owner_id");



CREATE INDEX "idx_hospitality_forms_status" ON "public"."hospitality_forms" USING "btree" ("status");



CREATE INDEX "idx_hospitality_forms_user_id" ON "public"."hospitality_forms" USING "btree" ("user_id");



CREATE INDEX "idx_hospitality_hours_date_time" ON "public"."hospitality_hours" USING "btree" ("date_time");



CREATE INDEX "idx_hospitality_hours_group_confirmed" ON "public"."hospitality_hours" USING "btree" ("group_confirmed");



CREATE INDEX "idx_hospitality_hours_group_hosting" ON "public"."hospitality_hours" USING "btree" ("group_hosting");



CREATE INDEX "idx_hospitality_hours_program_id" ON "public"."hospitality_hours" USING "btree" ("program_id");



CREATE INDEX "idx_hospitality_hours_volunteering_interest_id" ON "public"."hospitality_hours" USING "btree" ("volunteering_interest_id");



CREATE INDEX "idx_notification_logs_program" ON "public"."notification_logs" USING "btree" ("program_id", "created_at" DESC);



CREATE INDEX "idx_notification_logs_user" ON "public"."notification_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_oncall_assignments_program_service" ON "public"."oncall_assignments" USING "btree" ("program_id", "service_type", "is_active");



CREATE INDEX "idx_oncall_assignments_user" ON "public"."oncall_assignments" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_panel_chairpeople_day_time" ON "public"."panel_chairpeople" USING "btree" ("day_time");



CREATE INDEX "idx_panel_chairpeople_name" ON "public"."panel_chairpeople" USING "btree" ("name");



CREATE INDEX "idx_panel_chairpeople_panel_id" ON "public"."panel_chairpeople" USING "btree" ("panel_id");



CREATE INDEX "idx_panel_chairpeople_panel_name" ON "public"."panel_chairpeople" USING "btree" ("panel_name");



CREATE INDEX "idx_panel_chairpeople_phone" ON "public"."panel_chairpeople" USING "btree" ("phone");



CREATE INDEX "idx_panel_notifications_confirmed_at" ON "public"."panel_notifications" USING "btree" ("confirmed_at");



CREATE INDEX "idx_panel_notifications_contact" ON "public"."panel_notifications" USING "btree" ("panelist_contact");



CREATE INDEX "idx_panel_notifications_denied_at" ON "public"."panel_notifications" USING "btree" ("denied_at");



CREATE INDEX "idx_panel_notifications_reminder2_followup_sent_at" ON "public"."panel_notifications" USING "btree" ("reminder2_followup_sent_at");



CREATE INDEX "idx_panel_notifications_reminder2_send_status" ON "public"."panel_notifications" USING "btree" ("reminder2_send_status");



CREATE INDEX "idx_panel_notifications_reminder_followup_sent_at" ON "public"."panel_notifications" USING "btree" ("reminder_followup_sent_at");



CREATE INDEX "idx_panel_notifications_reminder_send_status" ON "public"."panel_notifications" USING "btree" ("reminder_send_status");



CREATE INDEX "idx_panel_notifications_room" ON "public"."panel_notifications" USING "btree" ("room");



CREATE INDEX "idx_panel_notifications_send_status" ON "public"."panel_notifications" USING "btree" ("send_status");



CREATE INDEX "idx_panel_notifications_sent_at" ON "public"."panel_notifications" USING "btree" ("notification_sent_at");



CREATE INDEX "idx_panel_notifications_time_day" ON "public"."panel_notifications" USING "btree" ("time_day");



CREATE INDEX "idx_panel_notifications_title" ON "public"."panel_notifications" USING "btree" ("title");



CREATE INDEX "idx_panel_notifications_token" ON "public"."panel_notifications" USING "btree" ("confirmation_token");



CREATE INDEX "idx_panel_notifications_twilio_message_sid" ON "public"."panel_notifications" USING "btree" ("twilio_message_sid") WHERE ("twilio_message_sid" IS NOT NULL);



CREATE INDEX "idx_panel_notifications_twilio_reminder2_sid" ON "public"."panel_notifications" USING "btree" ("twilio_reminder2_sid") WHERE ("twilio_reminder2_sid" IS NOT NULL);



CREATE INDEX "idx_panel_notifications_twilio_reminder_sid" ON "public"."panel_notifications" USING "btree" ("twilio_reminder_sid") WHERE ("twilio_reminder_sid" IS NOT NULL);



CREATE INDEX "idx_profile_names_user_id" ON "public"."profile-names" USING "btree" ("user_id");



CREATE INDEX "idx_ride_forms_owner" ON "public"."ride_forms" USING "btree" ("owner_id");



CREATE INDEX "idx_ride_forms_status" ON "public"."ride_forms" USING "btree" ("status");



CREATE INDEX "idx_ride_forms_user_id" ON "public"."ride_forms" USING "btree" ("user_id");



CREATE INDEX "idx_roles_role" ON "public"."roles" USING "btree" ("role");



CREATE INDEX "idx_roles_user_id" ON "public"."roles" USING "btree" ("user_id");



CREATE INDEX "idx_security_assignments_day_block" ON "public"."security_time_slot_assignments" USING "btree" ("day", "block", "slot");



CREATE INDEX "idx_security_assignments_volunteer" ON "public"."security_time_slot_assignments" USING "btree" ("volunteer_id");



CREATE INDEX "idx_shifts_assignments" ON "public"."shifts" USING "gin" ("assignments");



CREATE INDEX "idx_shifts_date" ON "public"."shifts" USING "btree" ("date");



CREATE INDEX "idx_shifts_job_type" ON "public"."shifts" USING "btree" ("job_type");



CREATE INDEX "idx_sms_delivery_logs_created_at" ON "public"."sms_delivery_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_delivery_logs_message_sid" ON "public"."sms_delivery_logs" USING "btree" ("message_sid");



CREATE INDEX "idx_sms_delivery_logs_notification_id" ON "public"."sms_delivery_logs" USING "btree" ("notification_id");



CREATE INDEX "idx_support_chats_device_id" ON "public"."support_chats" USING "btree" ("device_id");



CREATE INDEX "idx_support_chats_owner" ON "public"."support_chats" USING "btree" ("owner_id");



CREATE INDEX "idx_support_chats_program_id" ON "public"."support_chats" USING "btree" ("program_id");



CREATE INDEX "idx_support_chats_status" ON "public"."support_chats" USING "btree" ("status");



CREATE INDEX "idx_transportation_program_id" ON "public"."transportation" USING "btree" ("program_id");



CREATE INDEX "idx_twilio_messages_metadata" ON "public"."twilio_messages" USING "gin" ("metadata");



CREATE INDEX "idx_twilio_messages_sent_at" ON "public"."twilio_messages" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_twilio_messages_status" ON "public"."twilio_messages" USING "btree" ("status");



CREATE INDEX "idx_twilio_messages_to_number" ON "public"."twilio_messages" USING "btree" ("to_number");



CREATE INDEX "idx_venues_program_id" ON "public"."venues" USING "btree" ("program_id");



CREATE OR REPLACE TRIGGER "auto_link_chairperson_trigger" BEFORE INSERT OR UPDATE ON "public"."panel_chairpeople" FOR EACH ROW EXECUTE FUNCTION "public"."auto_link_chairperson_to_panel"();



CREATE OR REPLACE TRIGGER "create_hospitality_hours_trigger" AFTER INSERT ON "public"."volunteering_interest" FOR EACH ROW EXECUTE FUNCTION "public"."create_hospitality_hours_from_interest"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."committee_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_shifts_updated_at" BEFORE UPDATE ON "public"."shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_twilio_messages_updated_at" BEFORE UPDATE ON "public"."twilio_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."accessibility_forms"
    ADD CONSTRAINT "accessibility_forms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accessibility_forms"
    ADD CONSTRAINT "accessibility_forms_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accessibility_forms"
    ADD CONSTRAINT "accessibility_forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_user_fkey" FOREIGN KEY ("user") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."committee_mappings"
    ADD CONSTRAINT "committee_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pre-conf-events"
    ADD CONSTRAINT "events_creator_fkey" FOREIGN KEY ("creator") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "public"."event_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food"
    ADD CONSTRAINT "food_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hospitality_forms"
    ADD CONSTRAINT "hospitality_forms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hospitality_forms"
    ADD CONSTRAINT "hospitality_forms_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hospitality_forms"
    ADD CONSTRAINT "hospitality_forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hospitality_hours"
    ADD CONSTRAINT "hospitality_hours_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hospitality_hours"
    ADD CONSTRAINT "hospitality_hours_volunteering_interest_id_fkey" FOREIGN KEY ("volunteering_interest_id") REFERENCES "public"."volunteering_interest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oncall_assignments"
    ADD CONSTRAINT "oncall_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."oncall_assignments"
    ADD CONSTRAINT "oncall_assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oncall_assignments"
    ADD CONSTRAINT "oncall_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."panel_chairpeople"
    ADD CONSTRAINT "panel_chairpeople_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_notifications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ride_forms"
    ADD CONSTRAINT "ride_forms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ride_forms"
    ADD CONSTRAINT "ride_forms_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_forms"
    ADD CONSTRAINT "ride_forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_time_slot_assignments"
    ADD CONSTRAINT "security_time_slot_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."security_time_slot_assignments"
    ADD CONSTRAINT "security_time_slot_assignments_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteering_interest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sms_delivery_logs"
    ADD CONSTRAINT "sms_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."panel_notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_chats"
    ADD CONSTRAINT "support_chats_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_chats"
    ADD CONSTRAINT "support_chats_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transportation"
    ADD CONSTRAINT "transportation_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteering"
    ADD CONSTRAINT "volunteering_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."pre-conf-events"("id");



ALTER TABLE ONLY "public"."volunteering_interest"
    ADD CONSTRAINT "volunteering_interest_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id");



CREATE POLICY "Admin and steering can manage panel chairpeople" ON "public"."panel_chairpeople" USING ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])))))));



CREATE POLICY "Admin and steering can manage panel notifications" ON "public"."panel_notifications" USING ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])))))));



CREATE POLICY "Admins and steering can delete security assignments" ON "public"."security_time_slot_assignments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = 'admin'::"text") OR ("roles"."role" = 'steering'::"text"))))));



CREATE POLICY "Admins and steering can insert security assignments" ON "public"."security_time_slot_assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = 'admin'::"text") OR ("roles"."role" = 'steering'::"text"))))));



CREATE POLICY "Admins and steering can manage messages" ON "public"."twilio_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))));



CREATE POLICY "Admins and steering can update security assignments" ON "public"."security_time_slot_assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = 'admin'::"text") OR ("roles"."role" = 'steering'::"text"))))));



CREATE POLICY "Admins and steering can view security assignments" ON "public"."security_time_slot_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = 'admin'::"text") OR ("roles"."role" = 'steering'::"text"))))));



CREATE POLICY "Allow all Inserts" ON "public"."volunteering" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow authenticated read hospitality_hours" ON "public"."hospitality_hours" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anonymous users can confirm attendance" ON "public"."panel_notifications" FOR UPDATE USING (("confirmation_token" IS NOT NULL)) WITH CHECK (("confirmation_token" IS NOT NULL));



CREATE POLICY "Anonymous users can delete committee mappings (DEV)" ON "public"."committee_mappings" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Anonymous users can insert committee mappings (DEV)" ON "public"."committee_mappings" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Anonymous users can update committee mappings (DEV)" ON "public"."committee_mappings" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Anonymous users can view confirmations" ON "public"."panel_notifications" FOR SELECT USING (("confirmation_token" IS NOT NULL));



CREATE POLICY "Anyone can submit volunteering interest" ON "public"."volunteering_interest" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view committee mappings" ON "public"."committee_mappings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated All" ON "public"."activity" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated All" ON "public"."profile-names" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated All" ON "public"."registrations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated Delete" ON "public"."pre-conf-events" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated Insert" ON "public"."pre-conf-events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated Update" ON "public"."pre-conf-events" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated Users" ON "public"."event_categories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated Users" ON "public"."events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated Users" ON "public"."programs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can create reports" ON "public"."reports" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete committee mappings" ON "public"."committee_mappings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can get user's role" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert committee mappings" ON "public"."committee_mappings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update committee mappings" ON "public"."committee_mappings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view SMS logs" ON "public"."sms_delivery_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view panel chairpeople" ON "public"."panel_chairpeople" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view panel notifications" ON "public"."panel_notifications" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authorized users can manage outreach reminders" ON "public"."outreach_reminders" USING ((("auth"."role"() = 'authenticated'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."permissions" @> ARRAY['reminders:edit'::"text"])))))));



CREATE POLICY "Authorized users can manage shifts" ON "public"."shifts" USING ((EXISTS ( SELECT 1
   FROM "public"."roles" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND (("r"."role" = ANY (ARRAY['host'::"text", 'steering'::"text", 'admin'::"text"])) OR ('shift:edit'::"text" = ANY ("r"."permissions")))))));



CREATE POLICY "Authorized users can view outreach reminders" ON "public"."outreach_reminders" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."permissions" @> ARRAY['reminders:edit'::"text"])))))));



CREATE POLICY "Delete" ON "public"."activities" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Delete" ON "public"."food" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Delete" ON "public"."venues" FOR DELETE USING (true);



CREATE POLICY "Enable all for authenticated users only" ON "public"."reminders" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."resources" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."reminders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."resources" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."resources" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Host committee members can view message history" ON "public"."twilio_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text", 'chair'::"text", 'committee'::"text"]))))));



CREATE POLICY "Insert" ON "public"."activities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Insert" ON "public"."food" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Insert" ON "public"."venues" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only admins, steering committee or members with volunteering:ed" ON "public"."volunteering_interest" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."permissions" @> ARRAY['volunteering:edit'::"text"])))))));



CREATE POLICY "Only authorized users can access sensitive volunteer data" ON "public"."volunteering_interest" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."permissions" @> ARRAY['volunteering:sensitive'::"text"])))))));



CREATE POLICY "Public Get" ON "public"."pre-conf-events" FOR SELECT USING (true);



CREATE POLICY "Public can read shifts" ON "public"."shifts" FOR SELECT USING (true);



CREATE POLICY "System can insert SMS logs" ON "public"."sms_delivery_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Update" ON "public"."activities" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Update" ON "public"."food" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Update" ON "public"."venues" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Update all" ON "public"."volunteering" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can view their own reports" ON "public"."reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users with volunteering:edit can delete hospitality hours" ON "public"."hospitality_hours" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])) OR ("roles"."permissions" @> ARRAY['volunteering:edit'::"text"])))))));



CREATE POLICY "Users with volunteering:edit can manage hospitality hours" ON "public"."hospitality_hours" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])) OR ("roles"."permissions" @> ARRAY['volunteering:edit'::"text"])))))));



CREATE POLICY "Users with volunteering:edit can update hospitality hours" ON "public"."hospitality_hours" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND (("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])) OR ("roles"."permissions" @> ARRAY['volunteering:edit'::"text"])))))));



CREATE POLICY "Users with volunteering:sensitive can delete security assignmen" ON "public"."security_time_slot_assignments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ('volunteering:sensitive'::"text" = ANY ("roles"."permissions"))))));



CREATE POLICY "Users with volunteering:sensitive can insert security assignmen" ON "public"."security_time_slot_assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ('volunteering:sensitive'::"text" = ANY ("roles"."permissions"))))));



CREATE POLICY "Users with volunteering:sensitive can update security assignmen" ON "public"."security_time_slot_assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ('volunteering:sensitive'::"text" = ANY ("roles"."permissions"))))));



CREATE POLICY "Users with volunteering:sensitive can view security assignments" ON "public"."security_time_slot_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ('volunteering:sensitive'::"text" = ANY ("roles"."permissions"))))));



ALTER TABLE "public"."accessibility_forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accessibility_forms_insert" ON "public"."accessibility_forms" FOR INSERT WITH CHECK (true);



CREATE POLICY "accessibility_forms_select" ON "public"."accessibility_forms" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "accessibility_forms_update" ON "public"."accessibility_forms" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activities_select" ON "public"."activities" FOR SELECT USING (true);



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_categories_select" ON "public"."event_categories" FOR SELECT USING (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_select" ON "public"."events" FOR SELECT USING (true);



ALTER TABLE "public"."food" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_select" ON "public"."food" FOR SELECT USING (true);



ALTER TABLE "public"."hospitality_forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hospitality_forms_insert" ON "public"."hospitality_forms" FOR INSERT WITH CHECK (true);



CREATE POLICY "hospitality_forms_select" ON "public"."hospitality_forms" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "hospitality_forms_update" ON "public"."hospitality_forms" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."hospitality_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_logs_select" ON "public"."notification_logs" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"])))))));



ALTER TABLE "public"."oncall_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "oncall_assignments_delete" ON "public"."oncall_assignments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))));



CREATE POLICY "oncall_assignments_insert" ON "public"."oncall_assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))));



CREATE POLICY "oncall_assignments_select" ON "public"."oncall_assignments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "oncall_assignments_update" ON "public"."oncall_assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."roles"
  WHERE (("roles"."user_id" = "auth"."uid"()) AND ("roles"."role" = ANY (ARRAY['admin'::"text", 'steering'::"text"]))))));



ALTER TABLE "public"."outreach_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."panel_chairpeople" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."panel_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pre-conf-events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile-names" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programs_select" ON "public"."programs" FOR SELECT USING (true);



ALTER TABLE "public"."registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ride_forms_insert" ON "public"."ride_forms" FOR INSERT WITH CHECK (true);



CREATE POLICY "ride_forms_select" ON "public"."ride_forms" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "ride_forms_update" ON "public"."ride_forms" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_time_slot_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_delivery_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_chats_insert" ON "public"."support_chats" FOR INSERT WITH CHECK (true);



CREATE POLICY "support_chats_select_user" ON "public"."support_chats" FOR SELECT USING ((("device_id" = (("current_setting"('request.headers'::"text"))::"json" ->> 'x-device-id'::"text")) OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "support_chats_update_user" ON "public"."support_chats" FOR UPDATE USING ((("device_id" = (("current_setting"('request.headers'::"text"))::"json" ->> 'x-device-id'::"text")) OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "temp" ON "public"."volunteering" FOR SELECT USING (true);



ALTER TABLE "public"."transportation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transportation_select" ON "public"."transportation" FOR SELECT USING (true);



ALTER TABLE "public"."twilio_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete" ON "public"."users" FOR DELETE USING (("device_id" = (("current_setting"('request.headers'::"text"))::"json" ->> 'x-device-id'::"text")));



CREATE POLICY "users_insert" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "users_select" ON "public"."users" FOR SELECT USING (("device_id" = (("current_setting"('request.headers'::"text"))::"json" ->> 'x-device-id'::"text")));



CREATE POLICY "users_select_public_info" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE USING (("device_id" = (("current_setting"('request.headers'::"text"))::"json" ->> 'x-device-id'::"text")));



ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venues_select" ON "public"."venues" FOR SELECT USING (true);



ALTER TABLE "public"."volunteering" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."volunteering_interest" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_share_request"("requester_id" integer, "acceptor_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_share_request"("requester_id" integer, "acceptor_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_share_request"("requester_id" integer, "acceptor_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_chairperson_to_panel"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_chairperson_to_panel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_chairperson_to_panel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ban_user"("current_user_id" integer, "target_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."ban_user"("current_user_id" integer, "target_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ban_user"("current_user_id" integer, "target_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_share_request"("current_user_id" integer, "target_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_share_request"("current_user_id" integer, "target_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_share_request"("current_user_id" integer, "target_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_role_management_permission"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_role_management_permission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_role_management_permission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_hospitality_hours_from_interest"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_hospitality_hours_from_interest"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_hospitality_hours_from_interest"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_role"("target_user_id" "uuid", "user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_role"("target_user_id" "uuid", "user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_role"("target_user_id" "uuid", "user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deny_share_request"("requester_id" integer, "current_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deny_share_request"("requester_id" integer, "current_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deny_share_request"("requester_id" integer, "current_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_user_names"("user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hospitality_display_name"("vi_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_hospitality_display_name"("vi_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hospitality_display_name"("vi_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hospitality_slots"("p_program_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_hospitality_slots"("p_program_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hospitality_slots"("p_program_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_registration_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_registration_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_registration_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_user_info"("user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_user_info"("user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_user_info"("user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_users_info"("user_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_users_info"("user_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_users_info"("user_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_saved_events"("p_device_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_saved_events"("p_device_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_saved_events"("p_device_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_volunteering_interest_by_type"("interest_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_volunteering_interest_by_type"("interest_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_volunteering_interest_by_type"("interest_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_volunteering_interest_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_volunteering_interest_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_volunteering_interest_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("target_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("target_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("target_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("device_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("device_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_user_schedule"("device_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_sharing"("current_user_id" integer, "target_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."remove_sharing"("current_user_id" integer, "target_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_sharing"("current_user_id" integer, "target_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."request_schedule_share"("requester_id" integer, "target_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."request_schedule_share"("requester_id" integer, "target_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_schedule_share"("requester_id" integer, "target_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."stop_viewing_schedule"("current_user_id" integer, "target_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."stop_viewing_schedule"("current_user_id" integer, "target_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."stop_viewing_schedule"("current_user_id" integer, "target_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."unban_user"("current_user_id" integer, "target_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."unban_user"("current_user_id" integer, "target_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."unban_user"("current_user_id" integer, "target_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "user_role" "text", "user_permissions" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."accessibility_forms" TO "anon";
GRANT ALL ON TABLE "public"."accessibility_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."accessibility_forms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."accessibility_forms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."accessibility_forms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."accessibility_forms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."activity" TO "anon";
GRANT ALL ON TABLE "public"."activity" TO "authenticated";
GRANT ALL ON TABLE "public"."activity" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."committee_mappings" TO "anon";
GRANT ALL ON TABLE "public"."committee_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_mappings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."committee_mappings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."committee_mappings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."committee_mappings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."pre-conf-events" TO "anon";
GRANT ALL ON TABLE "public"."pre-conf-events" TO "authenticated";
GRANT ALL ON TABLE "public"."pre-conf-events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq1" TO "service_role";



GRANT ALL ON TABLE "public"."food" TO "anon";
GRANT ALL ON TABLE "public"."food" TO "authenticated";
GRANT ALL ON TABLE "public"."food" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hospitality_forms" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_forms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hospitality_forms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hospitality_forms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hospitality_forms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hospitality_hours" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_hours" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hospitality_hours_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hospitality_hours_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hospitality_hours_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."oncall_assignments" TO "anon";
GRANT ALL ON TABLE "public"."oncall_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."oncall_assignments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."oncall_assignments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."oncall_assignments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."oncall_assignments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."outreach_reminders" TO "anon";
GRANT ALL ON TABLE "public"."outreach_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."outreach_reminders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."outreach_reminders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."outreach_reminders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."outreach_reminders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."panel_chairpeople" TO "anon";
GRANT ALL ON TABLE "public"."panel_chairpeople" TO "authenticated";
GRANT ALL ON TABLE "public"."panel_chairpeople" TO "service_role";



GRANT ALL ON SEQUENCE "public"."panel_chairpeople_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."panel_chairpeople_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."panel_chairpeople_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."panel_notifications" TO "anon";
GRANT ALL ON TABLE "public"."panel_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."panel_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."panel_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."panel_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."panel_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile-names" TO "anon";
GRANT ALL ON TABLE "public"."profile-names" TO "authenticated";
GRANT ALL ON TABLE "public"."profile-names" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile-names_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile-names_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile-names_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."registrations" TO "anon";
GRANT ALL ON TABLE "public"."registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reminders" TO "anon";
GRANT ALL ON TABLE "public"."reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON SEQUENCE "public"."resources_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."resources_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."resources_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ride_forms" TO "anon";
GRANT ALL ON TABLE "public"."ride_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_forms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ride_forms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ride_forms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ride_forms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."security_time_slot_assignments" TO "anon";
GRANT ALL ON TABLE "public"."security_time_slot_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."security_time_slot_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."sms_agreements" TO "anon";
GRANT ALL ON TABLE "public"."sms_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_agreements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sms_agreements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sms_agreements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sms_agreements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sms_delivery_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_delivery_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_delivery_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sms_delivery_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sms_delivery_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sms_delivery_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."support_chats" TO "anon";
GRANT ALL ON TABLE "public"."support_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."support_chats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."support_chats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."support_chats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."support_chats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transportation" TO "anon";
GRANT ALL ON TABLE "public"."transportation" TO "authenticated";
GRANT ALL ON TABLE "public"."transportation" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transportation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transportation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transportation_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."twilio_messages" TO "anon";
GRANT ALL ON TABLE "public"."twilio_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."twilio_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."twilio_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."twilio_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."twilio_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."volunteering" TO "anon";
GRANT ALL ON TABLE "public"."volunteering" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteering" TO "service_role";



GRANT ALL ON SEQUENCE "public"."volunteering_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."volunteering_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."volunteering_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."volunteering_interest" TO "anon";
GRANT ALL ON TABLE "public"."volunteering_interest" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteering_interest" TO "service_role";



GRANT ALL ON SEQUENCE "public"."volunteering_interest_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."volunteering_interest_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."volunteering_interest_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






