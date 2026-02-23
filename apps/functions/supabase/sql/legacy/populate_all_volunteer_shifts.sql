-- SQL Query to populate ALL volunteer shifts from the volunteer signup time slots
-- This should be run after the shifts table is created

-- Clear existing shifts (optional - comment out if you want to keep existing data)
-- DELETE FROM shifts;

-- Registration Shifts (from RegistrationSignup.tsx)
WITH registration_shifts AS (
  SELECT * FROM (VALUES
    -- Thursday Registration
    ('2025-08-28', '15:00:00', '17:00:00', 'Registration', 'Lobby', 2, 2),      -- 3pm-5pm (slow)
    ('2025-08-28', '17:00:00', '18:30:00', 'Registration', 'Lobby', 4, 4),      -- 5pm-6:30pm (busy)
    ('2025-08-28', '18:30:00', '20:00:00', 'Registration', 'Lobby', 2, 2),      -- 6:30pm-8pm (slow)
    ('2025-08-28', '20:00:00', '22:00:00', 'Registration', 'Lobby', 4, 4),      -- 8pm-10pm (busy)
    ('2025-08-28', '22:00:00', '23:59:00', 'Registration', 'Lobby', 2, 2),      -- 10pm-12am (slow)

    -- Friday Registration
    ('2025-08-29', '07:00:00', '09:00:00', 'Registration', 'Lobby', 2, 2),      -- 7am-9am (slow)
    ('2025-08-29', '09:00:00', '11:00:00', 'Registration', 'Lobby', 2, 2),      -- 9am-11am (slow)
    ('2025-08-29', '11:00:00', '13:00:00', 'Registration', 'Lobby', 2, 2),      -- 11am-1pm (slow)
    ('2025-08-29', '13:00:00', '15:00:00', 'Registration', 'Lobby', 2, 2),      -- 1pm-3pm (slow)
    ('2025-08-29', '15:00:00', '17:00:00', 'Registration', 'Lobby', 2, 2),      -- 3pm-5pm (slow)
    ('2025-08-29', '17:00:00', '19:30:00', 'Registration', 'Lobby', 4, 4),      -- 5pm-7:30pm (busy)
    ('2025-08-29', '19:30:00', '21:30:00', 'Registration', 'Lobby', 2, 2),      -- 7:30pm-9:30pm (slow)
    ('2025-08-29', '21:30:00', '22:30:00', 'Registration', 'Lobby', 4, 4),      -- 9:30pm-10:30pm (busy)
    ('2025-08-29', '22:30:00', '23:59:00', 'Registration', 'Lobby', 2, 2),      -- 10:30pm-12am (slow)

    -- Saturday Registration
    ('2025-08-30', '07:00:00', '09:00:00', 'Registration', 'Lobby', 2, 2),      -- 7am-9am (slow)
    ('2025-08-30', '09:00:00', '11:00:00', 'Registration', 'Lobby', 2, 2),      -- 9am-11am (slow)
    ('2025-08-30', '11:00:00', '13:00:00', 'Registration', 'Lobby', 2, 2),      -- 11am-1pm (slow)
    ('2025-08-30', '13:00:00', '15:00:00', 'Registration', 'Lobby', 2, 2),      -- 1pm-3pm (slow)
    ('2025-08-30', '15:00:00', '17:00:00', 'Registration', 'Lobby', 2, 2),      -- 3pm-5pm (slow)
    ('2025-08-30', '17:00:00', '19:30:00', 'Registration', 'Lobby', 4, 4),      -- 5pm-7:30pm (busy)
    ('2025-08-30', '19:30:00', '21:30:00', 'Registration', 'Lobby', 2, 2)       -- 7:30pm-9:30pm (slow)
  ) AS t(date, start_time, end_time, job_type, location, min_volunteers, max_volunteers)
),

-- Security Shifts (from SecuritySignup.tsx)
security_shifts AS (
  SELECT * FROM (VALUES
    -- Thursday Security
    ('2025-08-28', '12:00:00', '14:00:00', 'Security', 'Lobby', 5, 5),
    ('2025-08-28', '14:00:00', '16:00:00', 'Security', 'Lobby', 5, 5),
    ('2025-08-28', '16:00:00', '18:00:00', 'Security', 'Lobby', 4, 4),
    ('2025-08-28', '18:00:00', '20:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-28', '20:00:00', '22:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-28', '22:00:00', '23:59:00', 'Security', 'Lobby', 15, 15),

    -- Friday Security
    ('2025-08-29', '00:00:00', '02:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-29', '02:00:00', '04:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-29', '04:00:00', '06:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-29', '06:00:00', '08:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '08:00:00', '10:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '10:00:00', '12:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '12:00:00', '14:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '14:00:00', '16:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '16:00:00', '18:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-29', '18:00:00', '20:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-29', '20:00:00', '22:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-29', '22:00:00', '23:59:00', 'Security', 'Lobby', 15, 15),

    -- Saturday Security
    ('2025-08-30', '00:00:00', '02:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-30', '02:00:00', '04:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-30', '04:00:00', '06:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-30', '06:00:00', '08:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '08:00:00', '10:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '10:00:00', '12:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '12:00:00', '14:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '14:00:00', '16:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '16:00:00', '18:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-30', '18:00:00', '20:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-30', '20:00:00', '22:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-30', '22:00:00', '23:59:00', 'Security', 'Lobby', 15, 15),

    -- Sunday Security
    ('2025-08-31', '00:00:00', '02:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-31', '02:00:00', '04:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-31', '04:00:00', '06:00:00', 'Security', 'Lobby', 15, 15),
    ('2025-08-31', '06:00:00', '08:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-31', '08:00:00', '10:00:00', 'Security', 'Lobby', 9, 9),
    ('2025-08-31', '10:00:00', '12:00:00', 'Security', 'Lobby', 9, 9)
  ) AS t(date, start_time, end_time, job_type, location, min_volunteers, max_volunteers)
),

-- Marathon Meeting Shifts (from timeSlotData.ts)
-- Each slot is 1 hour for marathon meetings
marathon_shifts AS (
  SELECT * FROM (VALUES
    -- Aug 28 Marathon
    ('2025-08-28', '22:00:00', '23:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-28', '23:00:00', '23:59:00', 'Marathon Meetings', 'Lobby', 1, 1),

    -- Aug 29 Marathon (Full 24 hours minus regular meeting times)
    ('2025-08-29', '00:00:00', '01:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '01:00:00', '02:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '02:00:00', '03:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '03:00:00', '04:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '04:00:00', '05:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '05:00:00', '06:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '06:00:00', '07:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '07:00:00', '08:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '22:00:00', '23:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-29', '23:00:00', '23:59:00', 'Marathon Meetings', 'Lobby', 1, 1),

    -- Aug 30 Marathon
    ('2025-08-30', '00:00:00', '01:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '01:00:00', '02:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '02:00:00', '03:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '03:00:00', '04:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '04:00:00', '05:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '05:00:00', '06:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '06:00:00', '07:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '07:00:00', '08:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '22:00:00', '23:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-30', '23:00:00', '23:59:00', 'Marathon Meetings', 'Lobby', 1, 1),

    -- Aug 31 Marathon (early morning only)
    ('2025-08-31', '00:00:00', '01:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '01:00:00', '02:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '02:00:00', '03:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '03:00:00', '04:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '04:00:00', '05:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '05:00:00', '06:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '06:00:00', '07:00:00', 'Marathon Meetings', 'Lobby', 1, 1),
    ('2025-08-31', '07:00:00', '08:00:00', 'Marathon Meetings', 'Lobby', 1, 1)
  ) AS t(date, start_time, end_time, job_type, location, min_volunteers, max_volunteers)
),

-- Merch Shifts (from timeSlotData.ts)
merch_shifts AS (
  SELECT * FROM (VALUES
    -- Aug 28 Merch
    ('2025-08-28', '13:00:00', '15:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-28', '15:00:00', '17:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-28', '17:00:00', '19:00:00', 'Merch', 'Lobby', 2, 3),
    -- 7-9pm break for main speaker
    ('2025-08-28', '21:00:00', '22:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-28', '22:00:00', '23:59:00', 'Merch', 'Lobby', 2, 3),

    -- Aug 29 Merch
    ('2025-08-29', '08:00:00', '10:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '10:00:00', '12:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '12:00:00', '14:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '14:00:00', '16:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '16:00:00', '18:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '18:00:00', '19:00:00', 'Merch', 'Lobby', 2, 3),
    -- 7-9pm break for main speaker
    ('2025-08-29', '21:00:00', '22:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-29', '22:00:00', '23:59:00', 'Merch', 'Lobby', 2, 3),

    -- Aug 30 Merch
    ('2025-08-30', '08:00:00', '10:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '10:00:00', '12:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '12:00:00', '14:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '14:00:00', '16:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '16:00:00', '18:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '18:00:00', '19:00:00', 'Merch', 'Lobby', 2, 3),
    -- 7-9pm break for main speaker
    ('2025-08-30', '21:00:00', '22:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-30', '22:00:00', '23:59:00', 'Merch', 'Lobby', 2, 3),

    -- Aug 31 Merch (limited hours)
    ('2025-08-31', '08:00:00', '10:00:00', 'Merch', 'Lobby', 2, 3),
    ('2025-08-31', '10:00:00', '12:00:00', 'Merch', 'Lobby', 2, 3)
  ) AS t(date, start_time, end_time, job_type, location, min_volunteers, max_volunteers)
)

-- Insert all shifts
INSERT INTO shifts (date, start_time, end_time, job_type, location, min_volunteers, max_volunteers, assignments)
SELECT date::date, start_time::time, end_time::time, job_type, location, min_volunteers, max_volunteers, '[]'::jsonb
FROM registration_shifts
UNION ALL
SELECT date::date, start_time::time, end_time::time, job_type, location, min_volunteers, max_volunteers, '[]'::jsonb
FROM security_shifts
UNION ALL
SELECT date::date, start_time::time, end_time::time, job_type, location, min_volunteers, max_volunteers, '[]'::jsonb
FROM marathon_shifts
UNION ALL
SELECT date::date, start_time::time, end_time::time, job_type, location, min_volunteers, max_volunteers, '[]'::jsonb
FROM merch_shifts
ON CONFLICT (id) DO NOTHING; -- Skip if shifts already exist

-- Show summary of created shifts
SELECT
  job_type,
  COUNT(*) as total_shifts,
  SUM(min_volunteers) as total_min_slots,
  SUM(max_volunteers) as total_max_slots
FROM shifts
GROUP BY job_type
ORDER BY job_type;