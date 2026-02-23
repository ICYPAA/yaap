-- SQL Query to populate Panel Support shifts from events table
-- This script creates shifts specifically for panel events (event_category_id = 12)

-- First, ensure we have a Panel Support job type
INSERT INTO job_types (name, color, description)
VALUES (
  'Panel Support',
  '#9333EA',
  'Support panel events by managing room setup, assisting speakers, and ensuring smooth transitions'
)
ON CONFLICT (name) DO UPDATE
SET 
  color = EXCLUDED.color,
  description = EXCLUDED.description;

-- Create shifts for all panel events (event_category_id = 12)
WITH panel_job_type AS (
  SELECT id FROM job_types WHERE name = 'Panel Support' LIMIT 1
),
panel_events AS (
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.start_time,
    e.end_time,
    e.location,
    e.chairpeople,
    e.speakers
  FROM events e
  WHERE e.event_category_id = 12  -- Panel event category
)
INSERT INTO shifts (
  job_type_id,
  name,
  location,
  start_time,
  end_time,
  min_volunteers,
  max_volunteers,
  notes,
  shift_assignments
)
SELECT 
  pjt.id as job_type_id,
  'Panel Support: ' || pe.title as name,
  COALESCE(pe.location, 'TBD') as location,
  -- Start 15 minutes before the event for setup
  (pe.date || ' ' || pe.start_time)::timestamp - INTERVAL '15 minutes' as start_time,
  -- End 15 minutes after the event for cleanup
  (pe.date || ' ' || pe.end_time)::timestamp + INTERVAL '15 minutes' as end_time,
  2 as min_volunteers,  -- Minimum 2 volunteers per panel
  3 as max_volunteers,  -- Maximum 3 volunteers per panel
  CASE 
    WHEN pe.description IS NOT NULL 
    THEN 'Support for panel: ' || pe.title || '. Description: ' || pe.description
    ELSE 'Support for panel: ' || pe.title
  END as notes,
  '[]'::jsonb as shift_assignments
FROM panel_events pe
CROSS JOIN panel_job_type pjt
ON CONFLICT (id) DO NOTHING;  -- Skip if shifts already exist

-- Show summary of created panel shifts
SELECT 
  'Panel Support Shifts Summary' as report_type,
  COUNT(*) as total_shifts,
  SUM(min_volunteers) as total_min_volunteers_needed,
  SUM(max_volunteers) as total_max_volunteers_capacity,
  MIN(start_time::date) as first_shift_date,
  MAX(end_time::date) as last_shift_date
FROM shifts
WHERE job_type_id = (SELECT id FROM job_types WHERE name = 'Panel Support' LIMIT 1);

-- Show detailed list of created panel shifts
SELECT 
  s.name,
  s.location,
  TO_CHAR(s.start_time, 'YYYY-MM-DD HH24:MI') as shift_start,
  TO_CHAR(s.end_time, 'HH24:MI') as shift_end,
  s.min_volunteers || '-' || s.max_volunteers as volunteers_needed
FROM shifts s
WHERE s.job_type_id = (SELECT id FROM job_types WHERE name = 'Panel Support' LIMIT 1)
ORDER BY s.start_time;