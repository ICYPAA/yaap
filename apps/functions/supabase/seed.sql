-- Local-only fixtures for development and E2E testing.
-- These credentials are intentionally disposable and must never be used in a
-- hosted environment.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@yaap.local',
    extensions.crypt('local-admin-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Local Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'manager@yaap.local',
    extensions.crypt('local-manager-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Conference Manager"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'viewer@yaap.local',
    extensions.crypt('local-viewer-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Read Only User"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id::text,
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
)
ON CONFLICT (provider_id, provider) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

INSERT INTO public."profile-names" (user_id, profile_name)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Local Admin'),
  ('00000000-0000-4000-8000-000000000002', 'Conference Manager'),
  ('00000000-0000-4000-8000-000000000003', 'Read Only User')
ON CONFLICT (user_id) DO UPDATE SET
  profile_name = EXCLUDED.profile_name,
  modified_at = now();

INSERT INTO public.roles (user_id, role, permissions)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin', '{}'),
  (
    '00000000-0000-4000-8000-000000000002',
    'host',
    ARRAY['program:edit']::text[]
  ),
  ('00000000-0000-4000-8000-000000000003', 'host', '{}')
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  updated_at = now();

INSERT INTO public.programs (
  id,
  title,
  description,
  start_date,
  end_date,
  timezone,
  location,
  venue_rooms,
  hospitality,
  theme,
  big_book_passage,
  design,
  promote,
  content,
  supported_languages,
  childcare_hours,
  features,
  host_committee,
  ndah_content
)
VALUES (
  9001,
  'Local Test Conference',
  'A deterministic conference used for local development and E2E testing.',
  (current_date + 1)::timestamp AT TIME ZONE 'America/Chicago',
  (current_date + 3)::timestamp AT TIME ZONE 'America/Chicago',
  'America/Chicago',
  '{
    "name": "Local Conference Center",
    "address": {
      "street": "100 Recovery Way",
      "suite": "",
      "city": "Test City",
      "state": "MN",
      "zip": "55401"
    }
  }'::jsonb,
  ARRAY['Main Ballroom', 'Workshop Room', 'Hospitality Suite'],
  jsonb_build_object(
    'location', 'Hospitality Suite',
    'times', jsonb_build_array(
      jsonb_build_object(
        'day', to_char(current_date + 1, 'FMDay'),
        'start_time', '08:00',
        'end_time', '22:00'
      ),
      jsonb_build_object(
        'day', to_char(current_date + 2, 'FMDay'),
        'start_time', '08:00',
        'end_time', '22:00'
      )
    )
  ),
  'Together in Recovery',
  'We are responsible.',
  '{
    "colors": {
      "primary": "#2457C5",
      "secondary": "#E5A93D",
      "primaryDark": "#7EA5FF",
      "secondaryDark": "#F5C96A"
    }
  }'::jsonb,
  ARRAY[9201]::numeric[],
  '{
    "services": {
      "accessibility": {
        "title": "Accessibility Assistance",
        "description": "Request conference accessibility support.",
        "internal_description": "Tell us what would make the conference accessible for you."
      },
      "hospitality": {
        "title": "Hospitality Updates",
        "description": "Tell attendees what your group is bringing.",
        "internal_description": "Share the food or supplies your group plans to provide."
      },
      "volunteering": {
        "title": "Volunteer at the Conference",
        "description": "Offer to help with conference service.",
        "internal_description": "Choose the areas and times where you can help.",
        "signup_destination": "internal",
        "external_signup_url": ""
      },
      "support": {
        "title": "Conference Support",
        "description": "Start a conversation with the conference team."
      }
    },
    "childcare": {
      "title": "Safe, Supervised Care",
      "description": "Childcare information for conference attendees.",
      "features": ["Background-checked caregivers", "Age-appropriate activities"],
      "note": "Advance requests help us plan appropriate coverage.",
      "linkText": "Request Childcare Services"
    },
    "faq": [
      {
        "question": "Where do I pick up my badge?",
        "answer": "Badge pickup is in the main lobby."
      }
    ]
  }'::jsonb,
  '["en"]'::jsonb,
  '[]'::jsonb,
  '{
    "child_care_enabled": true,
    "hospitality_enabled": true,
    "bid_schedule_enabled": false,
    "support_chat_enabled": true,
    "volunteering_enabled": true,
    "accessibility_enabled": true,
    "schedule_sharing_enabled": true,
    "push_notifications_enabled": false,
    "language_option_enabled": false
  }'::jsonb,
  '[]'::jsonb,
  '{
    "safety_statement": "Everyone deserves a safe and welcoming conference.",
    "anti_harassment_short": "Harassment is not tolerated.",
    "anti_discrimination_short": "Discrimination is not tolerated.",
    "ndah_link": "https://icypaa.org/ndahp.pdf",
    "report_crime": {
      "info": "Contact local authorities when immediate help is needed.",
      "emergency_number": "911",
      "non_emergency_number": "311"
    },
    "committee_contact": {
      "info": "Contact the conference safety team for support.",
      "contact": "safety@yaap.local"
    }
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  timezone = EXCLUDED.timezone,
  location = EXCLUDED.location,
  venue_rooms = EXCLUDED.venue_rooms,
  hospitality = EXCLUDED.hospitality,
  theme = EXCLUDED.theme,
  big_book_passage = EXCLUDED.big_book_passage,
  design = EXCLUDED.design,
  promote = EXCLUDED.promote,
  content = EXCLUDED.content,
  supported_languages = EXCLUDED.supported_languages,
  childcare_hours = EXCLUDED.childcare_hours,
  features = EXCLUDED.features,
  host_committee = EXCLUDED.host_committee,
  ndah_content = EXCLUDED.ndah_content;

INSERT INTO public.programs (
  id,
  title,
  description,
  start_date,
  end_date,
  timezone,
  location,
  venue_rooms,
  hospitality,
  theme,
  big_book_passage,
  design,
  promote,
  content
)
VALUES (
  8999,
  'Past Local Conference',
  'A completed conference used to verify historical visibility rules.',
  (current_date - 10)::timestamp AT TIME ZONE 'America/Chicago',
  (current_date - 7)::timestamp AT TIME ZONE 'America/Chicago',
  'America/Chicago',
  '{
    "name": "Former Conference Hotel",
    "address": {
      "street": "1 Archive Lane",
      "suite": "",
      "city": "Test City",
      "state": "MN",
      "zip": "55401"
    }
  }'::jsonb,
  '{}'::text[],
  '{}'::jsonb,
  'Previous Theme',
  '',
  NULL,
  '{}'::numeric[],
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  timezone = EXCLUDED.timezone,
  location = EXCLUDED.location,
  theme = EXCLUDED.theme;

INSERT INTO public.event_categories (id, program_id, title, color)
VALUES
  (9101, 9001, 'Main Events', '#2457C5'),
  (9102, 9001, 'Workshops', '#8A4EC7')
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  title = EXCLUDED.title,
  color = EXCLUDED.color;

INSERT INTO public.events (
  id,
  program_id,
  title,
  description,
  date,
  start_time,
  end_time,
  location,
  event_category_id,
  can_save,
  speakers,
  chairpeople,
  asl,
  hybrid,
  languages
)
VALUES
  (
    9201,
    9001,
    'Opening Celebration',
    'Welcome, conference orientation, and opening speaker.',
    current_date + 1,
    '19:00',
    '21:00',
    'Main Ballroom',
    9101,
    true,
    ARRAY['Alex R.'],
    ARRAY['Jordan M.'],
    true,
    false,
    ARRAY['spanish']
  ),
  (
    9202,
    9001,
    'Building a Personal Program',
    'A practical workshop about connection and service.',
    current_date + 2,
    '10:00',
    '11:30',
    'Workshop Room',
    9102,
    true,
    ARRAY['Taylor S.'],
    ARRAY['Morgan K.'],
    false,
    true,
    '{}'::text[]
  ),
  (
    9203,
    9001,
    'Closing Meeting',
    'Conference reflections and closing announcements.',
    current_date + 3,
    '10:00',
    '12:00',
    'Main Ballroom',
    9101,
    true,
    ARRAY['Casey L.'],
    ARRAY['Sam P.'],
    false,
    false,
    '{}'::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  date = EXCLUDED.date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  location = EXCLUDED.location,
  event_category_id = EXCLUDED.event_category_id,
  can_save = EXCLUDED.can_save,
  speakers = EXCLUDED.speakers,
  chairpeople = EXCLUDED.chairpeople,
  asl = EXCLUDED.asl,
  hybrid = EXCLUDED.hybrid,
  languages = EXCLUDED.languages;

INSERT INTO public.venues (id, program_id, floors, amenities)
VALUES (
  9301,
  9001,
  '[
    {
      "name": "Local Venue Map",
      "url": "https://oolqeopfhhiuvsmamxln.supabase.co/storage/v1/object/public/assets//hotel.png",
      "description": "Tap to open and zoom the conference floor plan."
    }
  ]'::jsonb,
  '[
    {
      "name": "Registration and Information",
      "description": "Main lobby, open throughout the conference."
    },
    {
      "name": "Accessible Entrances",
      "description": "Step-free access is available at the east entrance."
    }
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  floors = EXCLUDED.floors,
  amenities = EXCLUDED.amenities;

INSERT INTO public.food (
  id,
  program_id,
  category,
  name,
  description,
  location,
  distance,
  menu
)
VALUES (
  9401,
  9001,
  'Coffee and Breakfast',
  'Local Test Cafe',
  'Coffee, breakfast, and quick snacks.',
  'Across from the conference center',
  0.1,
  null
)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  distance = EXCLUDED.distance,
  menu = EXCLUDED.menu;

INSERT INTO public.activities (
  id,
  program_id,
  category,
  name,
  description,
  location,
  distance
)
VALUES (
  9501,
  9001,
  'Outdoor',
  'River Walk',
  'A nearby walking path for free time.',
  'Two blocks from the conference center',
  0.2
)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  distance = EXCLUDED.distance;

UPDATE public.conference_state
SET
  current_program_id = 9001,
  status = 'active',
  updated_at = now(),
  updated_by = '00000000-0000-4000-8000-000000000001'
WHERE id = true;

SELECT setval(
  pg_get_serial_sequence('public.programs', 'id'),
  GREATEST((SELECT max(id) FROM public.programs), 1)
);
SELECT setval(
  pg_get_serial_sequence('public.event_categories', 'id'),
  GREATEST((SELECT max(id) FROM public.event_categories), 1)
);
SELECT setval(
  pg_get_serial_sequence('public.events', 'id'),
  GREATEST((SELECT max(id) FROM public.events), 1)
);
SELECT setval(
  pg_get_serial_sequence('public.venues', 'id'),
  GREATEST((SELECT max(id) FROM public.venues), 1)
);
SELECT setval(
  pg_get_serial_sequence('public.food', 'id'),
  GREATEST((SELECT max(id) FROM public.food), 1)
);
SELECT setval(
  pg_get_serial_sequence('public.activities', 'id'),
  GREATEST((SELECT max(id) FROM public.activities), 1)
);
