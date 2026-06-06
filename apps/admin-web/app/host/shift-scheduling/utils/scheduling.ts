import { Shift, Volunteer } from "../types"

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }
  
  const start1Min = toMinutes(start1)
  const end1Min = toMinutes(end1)
  const start2Min = toMinutes(start2)
  const end2Min = toMinutes(end2)
  
  return start1Min < end2Min && end1Min > start2Min
}

/**
 * Find all shifts that conflict with a given time slot for a volunteer
 */
export function findConflictingShifts(
  volunteerId: string,
  date: string,
  startTime: string,
  endTime: string,
  shifts: Shift[],
  excludeShiftId?: string
): Shift[] {
  return shifts.filter(shift => {
    // Skip the shift we're checking against
    if (excludeShiftId && shift.id === excludeShiftId) return false
    
    // Only check same date
    if (shift.date !== date) return false
    
    // Check if volunteer is assigned to this shift
    const isAssigned = shift.assignments.some(a => a.id === volunteerId)
    if (!isAssigned) return false
    
    // Check if times overlap
    return doTimesOverlap(startTime, endTime, shift.start_time, shift.end_time)
  })
}

/**
 * Calculate a suitability score for a volunteer for a given shift
 */
export function calculateVolunteerScore(
  volunteer: Volunteer,
  shift: Shift,
  allShifts: Shift[]
): {
  score: number
  conflicts: Shift[]
  totalShifts: number
  reasons: string[]
} {
  let score = 0
  const reasons: string[] = []
  
  // Check for conflicts
  const conflicts = findConflictingShifts(
    volunteer.id,
    shift.date,
    shift.start_time,
    shift.end_time,
    allShifts,
    shift.id
  )
  
  if (conflicts.length === 0) {
    score += 20
    reasons.push("✓ No schedule conflicts")
  } else {
    score -= 15
    reasons.push(`⚠ Conflicts with ${conflicts.length} other shift(s)`)
  }
  
  // Count total shifts assigned
  const totalShifts = allShifts.filter(s => 
    s.assignments.some(a => a.id === volunteer.id)
  ).length
  
  // Prefer volunteers with fewer shifts (workload balance)
  if (totalShifts < 3) {
    score += 5
    reasons.push(`✓ Low workload (${totalShifts} shifts)`)
  } else if (totalShifts >= 5) {
    score -= 5
    reasons.push(`⚠ High workload (${totalShifts} shifts)`)
  }
  
  // Host members get priority
  if (volunteer.type === 'host') {
    score += 10
    reasons.push("✓ Host committee member")
  }
  
  // Job type matching (if volunteer has a specific type that matches)
  if (shift.job_type === 'Hospitality' && volunteer.type === 'hospitality') {
    score += 8
    reasons.push("✓ Hospitality volunteer for hospitality shift")
  }
  
  // Check availability for greeter volunteers
  if (volunteer.volunteer_type === 'greeter' && volunteer.data) {
    const volunteerDay = volunteer.data.day
    const volunteerTime = volunteer.data.time_slot || volunteer.data.time
    
    if (shift.job_type === 'Greeting') {
      if (volunteerDay && shift.date === volunteerDay) {
        score += 10
        reasons.push(`✓ Available on ${volunteerDay}`)
      } else if (volunteerDay && shift.date !== volunteerDay) {
        score -= 20
        reasons.push(`⚠ Prefers ${volunteerDay}`)
      }
      
      if (volunteerTime) {
        // Check if shift time matches volunteer availability
        const shiftStart = parseInt(shift.start_time.slice(0, 2))
        const timeMatch = volunteerTime.toLowerCase().includes('morning') && shiftStart < 12 ||
                         volunteerTime.toLowerCase().includes('afternoon') && shiftStart >= 12 && shiftStart < 17 ||
                         volunteerTime.toLowerCase().includes('evening') && shiftStart >= 17
        if (timeMatch) {
          score += 5
          reasons.push(`✓ Preferred time: ${volunteerTime}`)
        }
      }
    }
  }
  
  // Check availability for cleanup volunteers  
  if (volunteer.volunteer_type === 'cleanup' && volunteer.data) {
    const volunteerDate = volunteer.data.date
    const volunteerTime = volunteer.data.time
    
    if (shift.job_type === 'Clean up') {
      if (volunteerDate && shift.date === volunteerDate) {
        score += 10
        reasons.push(`✓ Available on ${volunteerDate}`)
      } else if (volunteerDate && shift.date !== volunteerDate) {
        score -= 20
        reasons.push(`⚠ Prefers ${volunteerDate}`)
      }
      
      if (volunteerTime) {
        reasons.push(`Preferred time: ${volunteerTime}`)
      }
    }
  }
  
  // Check if volunteer has back-to-back shifts (can be efficient)
  const backToBack = allShifts.some(s => {
    if (s.id === shift.id || s.date !== shift.date) return false
    const isAssigned = s.assignments.some(a => a.id === volunteer.id)
    if (!isAssigned) return false
    
    // Check if end time of one matches start time of other
    return s.end_time === shift.start_time || s.start_time === shift.end_time
  })
  
  if (backToBack) {
    score += 3
    reasons.push("✓ Back-to-back with another shift")
  }
  
  return {
    score,
    conflicts,
    totalShifts,
    reasons
  }
}

/**
 * Get volunteer suggestions sorted by suitability
 */
export function getVolunteerSuggestions(
  shift: Shift,
  allVolunteers: Volunteer[],
  allShifts: Shift[]
): Array<Volunteer & {
  score: number
  conflicts: Shift[]
  totalShifts: number
  reasons: string[]
}> {
  // Filter out already assigned volunteers
  // Check by ID, name, and volunteering_interest_id to ensure no duplicates
  const assignedIds = new Set(shift.assignments.map(a => a.id))
  const assignedNames = new Set(shift.assignments.map(a => a.name.toLowerCase()))
  const assignedVolInterestIds = new Set(
    shift.assignments
      .filter(a => a.volunteering_interest_id)
      .map(a => String(a.volunteering_interest_id))
  )
  
  const availableVolunteers = allVolunteers.filter(v => 
    !assignedIds.has(v.id) && 
    !assignedNames.has(v.name.toLowerCase()) &&
    (!v.volunteering_interest_id || !assignedVolInterestIds.has(String(v.volunteering_interest_id)))
  )
  
  // Calculate scores for each volunteer
  const scoredVolunteers = availableVolunteers.map(volunteer => {
    const scoreData = calculateVolunteerScore(volunteer, shift, allShifts)
    return {
      ...volunteer,
      ...scoreData
    }
  })
  
  // Sort by score (highest first), then by name
  return scoredVolunteers.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.name.localeCompare(b.name)
  })
}

/**
 * Check if a shift needs coverage
 */
export function shiftNeedsCoverage(shift: Shift): boolean {
  return shift.assignments.length < shift.min_volunteers
}

/**
 * Check if a shift is fully staffed
 */
export function shiftIsFullyStaffed(shift: Shift): boolean {
  return shift.assignments.length >= shift.max_volunteers
}

/**
 * Get coverage statistics for all shifts
 */
export function getCoverageStats(shifts: Shift[]) {
  const stats = {
    totalShifts: shifts.length,
    totalSlots: 0,
    filledSlots: 0,
    shiftsNeedingCoverage: 0,
    fullyStaffedShifts: 0,
    byJobType: new Map<string, {
      totalShifts: number
      totalSlots: number
      filledSlots: number
      needsCoverage: number
    }>(),
    byDay: new Map<string, {
      totalShifts: number
      totalSlots: number
      filledSlots: number
      needsCoverage: number
    }>()
  }
  
  shifts.forEach(shift => {
    stats.totalSlots += shift.max_volunteers
    stats.filledSlots += shift.assignments.length
    
    if (shiftNeedsCoverage(shift)) {
      stats.shiftsNeedingCoverage++
    }
    
    if (shiftIsFullyStaffed(shift)) {
      stats.fullyStaffedShifts++
    }
    
    // By job type
    if (!stats.byJobType.has(shift.job_type)) {
      stats.byJobType.set(shift.job_type, {
        totalShifts: 0,
        totalSlots: 0,
        filledSlots: 0,
        needsCoverage: 0
      })
    }
    const jobStats = stats.byJobType.get(shift.job_type)!
    jobStats.totalShifts++
    jobStats.totalSlots += shift.max_volunteers
    jobStats.filledSlots += shift.assignments.length
    if (shiftNeedsCoverage(shift)) {
      jobStats.needsCoverage++
    }
    
    // By day
    if (!stats.byDay.has(shift.date)) {
      stats.byDay.set(shift.date, {
        totalShifts: 0,
        totalSlots: 0,
        filledSlots: 0,
        needsCoverage: 0
      })
    }
    const dayStats = stats.byDay.get(shift.date)!
    dayStats.totalShifts++
    dayStats.totalSlots += shift.max_volunteers
    dayStats.filledSlots += shift.assignments.length
    if (shiftNeedsCoverage(shift)) {
      dayStats.needsCoverage++
    }
  })
  
  return stats
}