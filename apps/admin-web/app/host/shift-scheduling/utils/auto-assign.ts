import { Shift, Volunteer, ShiftAssignment } from "../types"

interface AutoAssignment {
  shift: Shift
  volunteer: Volunteer
  reason: string
}

/**
 * Auto-assign volunteers to shifts based on their volunteering interest type
 * Returns a preview of assignments without actually applying them
 * 
 * IMPORTANT: Each volunteer entry represents ONE slot they can fill.
 * A person may have multiple entries for different time slots.
 * We should match entries to their exact requested type and time.
 */
export function generateAutoAssignments(
  shifts: Shift[],
  volunteers: Volunteer[]
): AutoAssignment[] {
  const assignments: AutoAssignment[] = []
  
  console.log(`Starting auto-assignment with ${shifts.length} shifts and ${volunteers.length} volunteers`)
  
  // Track which volunteer entries have already been used
  const usedVolunteerEntryIds = new Set<string>()
  
  // Get already assigned volunteer entry IDs from existing shifts
  shifts.forEach(shift => {
    shift.assignments.forEach(a => {
      // Track both the assignment ID and the volunteering_interest_id
      // The assignment.id IS the volunteering_interest entry id for auto-assigned volunteers
      if (a.volunteering_interest_id) {
        usedVolunteerEntryIds.add(String(a.volunteering_interest_id))
      }
      // Also add the assignment id itself in case it matches a volunteering_interest entry
      if (a.sourceTable === 'volunteering_interest') {
        usedVolunteerEntryIds.add(a.id)
      }
    })
  })
  
  // Map volunteer types to job types - EXACT matches only
  // EXCLUDE general and hospitality from auto-assignment
  const typeMapping: Record<string, string[]> = {
    'registration': ['Registration'],
    'security': ['Security'],
    'merch': ['Merch'],
    'marathon': ['Marathon Meetings'],
    'cleanup': ['Clean up'],
    'greeter': ['Greeting']
    // 'general' is excluded - handled manually
    // 'hospitality' is excluded - managed via hospitality_hours table
  }
  
  // Filter to only unassigned volunteer entries with specific types
  // Exclude general and hospitality volunteers
  const unassignedVolunteerEntries = volunteers.filter(v => 
    !usedVolunteerEntryIds.has(v.id) && 
    v.volunteer_type && 
    v.volunteer_type !== 'general' && 
    v.volunteer_type !== 'hospitality'
  )
  
  console.log(`Found ${unassignedVolunteerEntries.length} unassigned volunteers (excluding general/hospitality)`)
  console.log(`Already used volunteer IDs: ${Array.from(usedVolunteerEntryIds).slice(0, 5).join(', ')}...`)
  
  // Sort shifts by date and time to assign chronologically
  const sortedShifts = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.start_time.localeCompare(b.start_time)
  })
  
  // For each unassigned volunteer entry, find the BEST matching shift
  unassignedVolunteerEntries.forEach(volunteerEntry => {
    // Skip if already used in preview
    if (assignments.some(a => a.volunteer.id === volunteerEntry.id)) return
    
    const applicableJobTypes = typeMapping[volunteerEntry.volunteer_type || ''] || []
    if (applicableJobTypes.length === 0) return
    
    // Find the first available shift that matches their type
    for (const shift of sortedShifts) {
      // Check if job type matches EXACTLY
      if (!applicableJobTypes.includes(shift.job_type)) continue
      
      // Check time slot and day for greeter and cleanup volunteers
      if (volunteerEntry.volunteer_type === 'greeter' && volunteerEntry.data) {
        const volunteerDay = volunteerEntry.data.day
        const volunteerTime = volunteerEntry.data.time_slot || volunteerEntry.data.time
        
        // Skip if day doesn't match
        if (volunteerDay && shift.date !== volunteerDay) continue
        
        // Skip if time slot doesn't overlap
        if (volunteerTime) {
          // Parse time slot like "9am-11am" or "9:00 AM - 11:00 AM"
          const timeMatch = volunteerTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
          if (timeMatch) {
            const startHour = parseInt(timeMatch[1]) + (timeMatch[3]?.toLowerCase() === 'pm' && parseInt(timeMatch[1]) !== 12 ? 12 : 0)
            const endHour = parseInt(timeMatch[4]) + (timeMatch[6]?.toLowerCase() === 'pm' && parseInt(timeMatch[4]) !== 12 ? 12 : 0)
            const shiftStartHour = parseInt(shift.start_time.slice(0, 2))
            const shiftEndHour = parseInt(shift.end_time.slice(0, 2))
            
            // Check if shift is within volunteer's available time
            if (shiftStartHour < startHour || shiftEndHour > endHour) continue
          }
        }
      }
      
      if (volunteerEntry.volunteer_type === 'cleanup' && volunteerEntry.data) {
        const volunteerDate = volunteerEntry.data.date
        const volunteerTime = volunteerEntry.data.time
        
        // Skip if date doesn't match
        if (volunteerDate && shift.date !== volunteerDate) continue
        
        // Skip if time doesn't match (for cleanup, time is more specific)
        if (volunteerTime) {
          // Check if the shift time matches the volunteer's availability
          const timeMatch = volunteerTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
          if (timeMatch) {
            const volunteerHour = parseInt(timeMatch[1]) + (timeMatch[3]?.toLowerCase() === 'pm' && parseInt(timeMatch[1]) !== 12 ? 12 : 0)
            const shiftStartHour = parseInt(shift.start_time.slice(0, 2))
            
            // Check if shift starts at or near volunteer's specified time
            if (Math.abs(shiftStartHour - volunteerHour) > 2) continue
          }
        }
      }
      
      // Check if shift needs more volunteers
      const currentAssignments = shift.assignments.length
      const previewAssignmentsForShift = assignments.filter(a => a.shift.id === shift.id).length
      const totalAssigned = currentAssignments + previewAssignmentsForShift
      
      if (totalAssigned >= shift.max_volunteers) continue
      
      // Check if this same person (by name) already has a conflicting assignment
      // This prevents the same person from being double-booked
      const personName = volunteerEntry.name.toLowerCase()
      const hasPersonConflict = assignments.some(a => {
        // Check if it's the same person (by name)
        if (a.volunteer.name.toLowerCase() !== personName) return false
        if (a.shift.date !== shift.date) return false
        
        const assignedStart = timeToMinutes(a.shift.start_time)
        const assignedEnd = timeToMinutes(a.shift.end_time)
        const shiftStart = timeToMinutes(shift.start_time)
        const shiftEnd = timeToMinutes(shift.end_time)
        
        return shiftStart < assignedEnd && shiftEnd > assignedStart
      })
      
      // Also check existing assignments for conflicts
      const hasExistingConflict = shifts.some(s => {
        if (s.date !== shift.date) return false
        
        // Check if this person is already assigned to a conflicting shift
        const isAssigned = s.assignments.some(a => 
          a.name.toLowerCase() === personName
        )
        if (!isAssigned) return false
        
        const existingStart = timeToMinutes(s.start_time)
        const existingEnd = timeToMinutes(s.end_time)
        const shiftStart = timeToMinutes(shift.start_time)
        const shiftEnd = timeToMinutes(shift.end_time)
        
        return shiftStart < existingEnd && shiftEnd > existingStart
      })
      
      if (hasPersonConflict || hasExistingConflict) continue
      
      // Add to preview - THIS volunteer entry for THIS shift
      assignments.push({
        shift,
        volunteer: volunteerEntry,
        reason: `${volunteerEntry.volunteer_type} volunteer → ${shift.job_type}`
      })
      
      // Mark this specific volunteer entry as used
      break // Move to next volunteer entry
    }
  })
  
  console.log(`Generated ${assignments.length} auto-assignments`)
  return assignments
}

/**
 * Apply auto-assignments to shifts
 */
export function applyAutoAssignments(
  shifts: Shift[],
  assignments: AutoAssignment[]
): Shift[] {
  console.log(`Applying ${assignments.length} assignments to shifts`)
  const updatedShifts = shifts.map(shift => ({ ...shift, assignments: [...shift.assignments] }))
  
  let appliedCount = 0
  let skippedCount = 0
  
  assignments.forEach(({ shift, volunteer }) => {
    const shiftToUpdate = updatedShifts.find(s => s.id === shift.id)
    if (!shiftToUpdate) return
    
    // Check if this specific volunteer entry is already assigned to this shift
    // We check by volunteering_interest_id to prevent duplicate assignments
    const alreadyAssigned = shiftToUpdate.assignments.some(a => 
      (a.volunteering_interest_id && String(a.volunteering_interest_id) === String(volunteer.volunteering_interest_id)) ||
      a.id === volunteer.id
    )
    
    if (alreadyAssigned) {
      console.log(`Skipping ${volunteer.name} - already assigned to ${shift.job_type}`)
      skippedCount++
      return
    }
    
    // Create assignment with a unique ID (using volunteer.id which is the volunteering_interest entry id)
    const assignment: ShiftAssignment = {
      id: volunteer.id,
      name: volunteer.name,
      type: volunteer.type,
      contact: volunteer.contact_info,
      sourceTable: volunteer.source_table,
      volunteering_interest_id: volunteer.volunteering_interest_id
    }
    
    shiftToUpdate.assignments = [...shiftToUpdate.assignments, assignment]
    appliedCount++
  })
  
  console.log(`Applied ${appliedCount} assignments, skipped ${skippedCount} duplicates`)
  return updatedShifts
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}