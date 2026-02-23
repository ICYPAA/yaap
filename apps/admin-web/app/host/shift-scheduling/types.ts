export interface ShiftAssignment {
  id: string
  name: string
  type: 'host' | 'volunteer' | 'hospitality' | 'panel_chair' | 'panelist' | 'general' | 'greeter' | 'cleanup' | 'security' | 'registration' | 'marathon' | 'merch' | 'outreach' | 'entertainment' | string
  contact?: string
  sourceTable: string
  volunteering_interest_id?: number // Link back to volunteering_interest table
  reminderSent?: boolean // Track if reminder was sent for this assignment
}

export interface Shift {
  id: string
  date: string
  start_time: string
  end_time: string
  job_type: string
  location?: string[] // Array of venue room names
  min_volunteers: number
  max_volunteers: number
  assignments: ShiftAssignment[]
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface Volunteer {
  id: string
  name: string
  type: 'host' | 'volunteer' | 'hospitality' | 'panel_chair' | 'panelist' | 'general' | 'greeter' | 'cleanup' | 'security' | 'registration' | 'marathon' | 'merch' | 'outreach' | 'entertainment' | string
  source_table: string
  contact_info?: string
  has_conflict?: boolean
  total_shifts?: number
  volunteering_interest_id?: number
  volunteer_type?: 'general' | 'greeter' | 'cleanup' | 'security' | 'registration' | 'marathon' | 'merch' | 'outreach' | 'hospitality' | 'entertainment' | string // From volunteering_interest.type field
  data?: any // Additional data like time slots and days for greeters/cleanup
}

export const JOB_TYPES = [
  { name: 'Greeting', color: '#10B981' },
  { name: 'Registration', color: '#3B82F6' },
  { name: 'Merch', color: '#F59E0B' },
  { name: 'Marathon Meetings', color: '#14B8A6' },
  { name: 'Security', color: '#EF4444' },
  { name: 'Hospitality', color: '#8B5CF6' },
  { name: 'Accessibility', color: '#F97316' },
  { name: 'Chairperson', color: '#EC4899' },
  { name: 'Clean up', color: '#6B7280' },
  { name: 'Speaking / On Panel', color: '#06B6D4' },
  { name: 'Entertainment', color: '#A855F7' }
]

// Use CST timezone - dates are already in CST from the database
// No timezone conversion needed
export const CONFERENCE_DATES = {
  start: '2025-08-28',
  end: '2025-08-31',
  days: [
    { date: '2025-08-28', label: 'Thursday, Aug 28' },
    { date: '2025-08-29', label: 'Friday, Aug 29' },
    { date: '2025-08-30', label: 'Saturday, Aug 30' },
    { date: '2025-08-31', label: 'Sunday, Aug 31' }
  ]
}