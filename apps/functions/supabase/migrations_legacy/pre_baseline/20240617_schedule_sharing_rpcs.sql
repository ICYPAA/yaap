-- Migration file for ICYPAA schedule sharing RPC functions
-- These functions handle bidirectional updates for schedule sharing operations

-- Helper function to ensure schedule arrays are initialized
CREATE OR REPLACE FUNCTION initialize_user_schedule(target_id int4)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to request to see someone's schedule
CREATE OR REPLACE FUNCTION request_schedule_share(
  requester_id int4,
  target_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to accept a share request
CREATE OR REPLACE FUNCTION accept_share_request(
  requester_id int4,
  acceptor_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to deny a share request
CREATE OR REPLACE FUNCTION deny_share_request(
  requester_id int4,
  current_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to remove sharing (stop sharing with someone)
CREATE OR REPLACE FUNCTION remove_sharing(
  current_user_id int4,
  target_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to cancel a pending share request
CREATE OR REPLACE FUNCTION cancel_share_request(
  current_user_id int4,
  target_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to stop viewing someone's schedule
CREATE OR REPLACE FUNCTION stop_viewing_schedule(
  current_user_id int4,
  target_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to ban a user
CREATE OR REPLACE FUNCTION ban_user(
  current_user_id int4,
  target_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to unban a user
CREATE OR REPLACE FUNCTION unban_user(
  current_user_id int4,
  target_user_id int4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get public user info for a list of user IDs
CREATE OR REPLACE FUNCTION get_public_users_info(user_ids int4[])
RETURNS TABLE (
  id int4,
  first_name text,
  last_initial text,
  profile_image text
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get saved events from all users sharing their schedule with current user
CREATE OR REPLACE FUNCTION get_shared_saved_events(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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