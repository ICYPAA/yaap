-- Migration: 008_add_row_level_security.sql
-- Description: Adds Row Level Security (RLS) policies to tables

-- Enable RLS on all tables
ALTER TABLE accessibility_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE food ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitality_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- accessibility_forms: Authenticated users can read/update, anyone can insert
CREATE POLICY accessibility_forms_select ON accessibility_forms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY accessibility_forms_insert ON accessibility_forms
  FOR INSERT WITH CHECK (true);

CREATE POLICY accessibility_forms_update ON accessibility_forms
  FOR UPDATE USING (auth.role() = 'authenticated');

-- activities: Anyone can read
CREATE POLICY activities_select ON activities
  FOR SELECT USING (true);

-- event_categories: Anyone can read
CREATE POLICY event_categories_select ON event_categories
  FOR SELECT USING (true);

-- events: Anyone can read
CREATE POLICY events_select ON events
  FOR SELECT USING (true);

-- food: Anyone can read
CREATE POLICY food_select ON food
  FOR SELECT USING (true);

-- hospitality_forms: Authenticated users can read/update, anyone can insert
CREATE POLICY hospitality_forms_select ON hospitality_forms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY hospitality_forms_insert ON hospitality_forms
  FOR INSERT WITH CHECK (true);

CREATE POLICY hospitality_forms_update ON hospitality_forms
  FOR UPDATE USING (auth.role() = 'authenticated');

-- programs: Anyone can read
CREATE POLICY programs_select ON programs
  FOR SELECT USING (true);

-- ride_forms: Authenticated users can read/update, anyone can insert
CREATE POLICY ride_forms_select ON ride_forms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY ride_forms_insert ON ride_forms
  FOR INSERT WITH CHECK (true);

CREATE POLICY ride_forms_update ON ride_forms
  FOR UPDATE USING (auth.role() = 'authenticated');

-- support_chats: Users can read/update their own chats, authenticated users can read/update any, anyone can insert
CREATE POLICY support_chats_select_user ON support_chats
  FOR SELECT USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY support_chats_insert ON support_chats
  FOR INSERT WITH CHECK (true);

CREATE POLICY support_chats_update_user ON support_chats
  FOR UPDATE USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.role() = 'authenticated'
  );

-- transportation: Anyone can read
CREATE POLICY transportation_select ON transportation
  FOR SELECT USING (true);

-- users: Only the user can read/update their own row, anyone can insert
CREATE POLICY users_select ON users
  FOR SELECT USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
  );

-- Allow anyone to read a user's first name and last initial if they have the user's ID
CREATE POLICY users_select_public_info ON users
  FOR SELECT TO public
  USING (true);

-- Create security definer function to only expose first name and last initial
CREATE OR REPLACE FUNCTION public.get_public_user_info(user_id int4)
RETURNS TABLE (id int4, first_name TEXT, last_initial TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_initial
  FROM users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get public info for multiple users by IDs
CREATE OR REPLACE FUNCTION public.get_public_users_info(user_ids int4[])
RETURNS TABLE (id int4, first_name TEXT, last_initial TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_initial
  FROM users u
  WHERE u.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql;

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
  );

CREATE POLICY users_delete ON users
  FOR DELETE USING (device_id = current_setting('request.headers')::json->>'x-device-id');

-- venues: Anyone can read
CREATE POLICY venues_select ON venues
  FOR SELECT USING (true);
