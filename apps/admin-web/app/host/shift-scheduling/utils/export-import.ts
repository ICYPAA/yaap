import { Shift, ShiftAssignment } from "../types"
import { format } from "date-fns"

/**
 * Export shifts to Excel with proper table formatting and all assignment details
 */
export async function exportScheduleWithTables(shifts: Shift[]) {
  const XLSX = await import("xlsx")
  // Sort shifts by date and time
  const sortedShifts = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.start_time.localeCompare(b.start_time)
  })
  
  // Prepare data with individual rows for each assignment slot
  const scheduleData: any[] = []
  
  sortedShifts.forEach(shift => {
    // Create rows for assigned volunteers
    shift.assignments.forEach((assignment, idx) => {
      scheduleData.push({
        "Shift ID": shift.id,
        "Date": shift.date,
        "Day": format(new Date(shift.date + "T12:00:00"), "EEE"),
        "Start Time": shift.start_time.slice(0, 5),
        "End Time": shift.end_time.slice(0, 5),
        "Job Type": shift.job_type,
        "Location": shift.location?.join(', ') || "Lobby",
        "Min Volunteers": shift.min_volunteers,
        "Max Volunteers": shift.max_volunteers,
        "Slot #": idx + 1,
        "Volunteer Name": assignment.name,
        "Volunteer Type": assignment.type,
        "Contact": assignment.contact || "",
        "Source": assignment.sourceTable,
        "Vol Interest ID": assignment.volunteering_interest_id || "",
        "Notes": shift.notes || ""
      })
    })
    
    // Create empty rows for unfilled slots
    const emptySlots = shift.max_volunteers - shift.assignments.length
    for (let i = 0; i < emptySlots; i++) {
      scheduleData.push({
        "Shift ID": shift.id,
        "Date": shift.date,
        "Day": format(new Date(shift.date + "T12:00:00"), "EEE"),
        "Start Time": shift.start_time.slice(0, 5),
        "End Time": shift.end_time.slice(0, 5),
        "Job Type": shift.job_type,
        "Location": shift.location?.join(', ') || "Lobby",
        "Min Volunteers": shift.min_volunteers,
        "Max Volunteers": shift.max_volunteers,
        "Slot #": shift.assignments.length + i + 1,
        "Volunteer Name": "",
        "Volunteer Type": "",
        "Contact": "",
        "Source": "",
        "Vol Interest ID": "",
        "Notes": shift.notes || ""
      })
    }
  })
  
  // Create summary statistics
  const summaryData = createSummaryData(sortedShifts)
  
  // Create volunteer summary
  const volunteerData = createVolunteerSummary(sortedShifts)
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Add main schedule sheet with table formatting
  const scheduleWs = XLSX.utils.json_to_sheet(scheduleData)
  
  // Define the table range
  const range = XLSX.utils.decode_range(scheduleWs['!ref'] || 'A1')
  
  // Add table formatting
  scheduleWs['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
  
  // Set column widths
  scheduleWs["!cols"] = [
    { wch: 15 }, // Shift ID
    { wch: 12 }, // Date
    { wch: 8 },  // Day
    { wch: 10 }, // Start Time
    { wch: 10 }, // End Time
    { wch: 18 }, // Job Type
    { wch: 15 }, // Location
    { wch: 8 },  // Min Volunteers
    { wch: 8 },  // Max Volunteers
    { wch: 8 },  // Slot #
    { wch: 20 }, // Volunteer Name
    { wch: 12 }, // Volunteer Type
    { wch: 20 }, // Contact
    { wch: 15 }, // Source
    { wch: 12 }, // Vol Interest ID
    { wch: 30 }  // Notes
  ]
  
  // Apply cell formatting
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = { c: C, r: R }
      const cellRef = XLSX.utils.encode_cell(cellAddress)
      
      if (!scheduleWs[cellRef]) continue
      
      // Header row styling
      if (R === 0) {
        scheduleWs[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" }
        }
      }
      // Empty volunteer slots - highlight in yellow
      else if (C === 10 && !scheduleWs[cellRef].v) { // Volunteer Name column
        scheduleWs[cellRef].s = {
          fill: { fgColor: { rgb: "FFFF00" } }
        }
      }
    }
  }
  
  XLSX.utils.book_append_sheet(wb, scheduleWs, "Schedule")
  
  // Add summary sheet
  const summaryWs = XLSX.utils.json_to_sheet(summaryData)
  summaryWs['!autofilter'] = { ref: summaryWs['!ref'] || 'A1' }
  summaryWs["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 }
  ]
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")
  
  // Add volunteer sheet
  const volunteerWs = XLSX.utils.json_to_sheet(volunteerData)
  volunteerWs['!autofilter'] = { ref: volunteerWs['!ref'] || 'A1' }
  volunteerWs["!cols"] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 100 }
  ]
  XLSX.utils.book_append_sheet(wb, volunteerWs, "Volunteers")
  
  // Save file
  const filename = `shift-schedule-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Import shifts from Excel file
 */
export async function importScheduleFromExcel(file: File): Promise<Shift[]> {
  const XLSX = await import("xlsx")
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Get the Schedule sheet
        const scheduleSheet = workbook.Sheets["Schedule"]
        if (!scheduleSheet) {
          throw new Error("No 'Schedule' sheet found in the Excel file")
        }
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(scheduleSheet) as any[]
        
        // Group by shift ID to reconstruct shifts
        const shiftMap = new Map<string, Shift>()
        
        jsonData.forEach(row => {
          const shiftId = row["Shift ID"]
          if (!shiftId) return
          
          // Create or get existing shift
          if (!shiftMap.has(shiftId)) {
            shiftMap.set(shiftId, {
              id: shiftId,
              date: row["Date"],
              start_time: padTime(row["Start Time"]),
              end_time: padTime(row["End Time"]),
              job_type: row["Job Type"],
              location: row["Location"] ? row["Location"].split(',').map((s: string) => s.trim()) : ["Lobby"],
              min_volunteers: Number(row["Min Volunteers"]) || 1,
              max_volunteers: Number(row["Max Volunteers"]) || 1,
              assignments: [],
              notes: row["Notes"] || undefined
            })
          }
          
          // Add assignment if volunteer name is present
          if (row["Volunteer Name"] && row["Volunteer Name"].trim()) {
            const shift = shiftMap.get(shiftId)!
            
            // Check if this volunteer is already assigned (prevent duplicates)
            const existingAssignment = shift.assignments.find(
              a => a.name === row["Volunteer Name"] && a.id === String(row["Vol Interest ID"] || row["Volunteer Name"])
            )
            
            if (!existingAssignment) {
              shift.assignments.push({
                id: String(row["Vol Interest ID"] || `import-${Date.now()}-${Math.random()}`),
                name: row["Volunteer Name"],
                type: parseVolunteerType(row["Volunteer Type"]),
                contact: row["Contact"] || undefined,
                sourceTable: row["Source"] || "manual_import",
                volunteering_interest_id: row["Vol Interest ID"] ? Number(row["Vol Interest ID"]) : undefined
              })
            }
          }
        })
        
        const shifts = Array.from(shiftMap.values())
        resolve(shifts)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }
    
    reader.readAsBinaryString(file)
  })
}

/**
 * Helper function to create summary data
 */
function createSummaryData(shifts: Shift[]) {
  const jobTypeSummary = new Map()
  
  shifts.forEach(shift => {
    if (!jobTypeSummary.has(shift.job_type)) {
      jobTypeSummary.set(shift.job_type, {
        totalShifts: 0,
        totalSlots: 0,
        filledSlots: 0,
        needsCoverage: 0
      })
    }
    const summary = jobTypeSummary.get(shift.job_type)
    summary.totalShifts++
    summary.totalSlots += shift.max_volunteers
    summary.filledSlots += shift.assignments.length
    if (shift.assignments.length < shift.min_volunteers) {
      summary.needsCoverage++
    }
  })
  
  return Array.from(jobTypeSummary.entries()).map(([jobType, summary]) => ({
    "Job Type": jobType,
    "Total Shifts": summary.totalShifts,
    "Total Slots": summary.totalSlots,
    "Filled Slots": summary.filledSlots,
    "Coverage %": Math.round((summary.filledSlots / summary.totalSlots) * 100) + "%",
    "Shifts Needing Coverage": summary.needsCoverage
  }))
}

/**
 * Helper function to create volunteer summary
 */
function createVolunteerSummary(shifts: Shift[]) {
  const volunteerMap = new Map()
  
  shifts.forEach(shift => {
    shift.assignments.forEach(assignment => {
      const key = `${assignment.name}-${assignment.id}`
      if (!volunteerMap.has(key)) {
        volunteerMap.set(key, {
          name: assignment.name,
          type: assignment.type,
          contact: assignment.contact || "",
          shifts: []
        })
      }
      volunteerMap.get(key).shifts.push({
        date: shift.date,
        time: `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`,
        job: shift.job_type,
        location: shift.location || "Lobby"
      })
    })
  })
  
  return Array.from(volunteerMap.values()).map(volunteer => ({
    "Name": volunteer.name,
    "Type": volunteer.type,
    "Contact": volunteer.contact,
    "Total Shifts": volunteer.shifts.length,
    "Schedule Details": volunteer.shifts
      .map((s: any) => `${format(new Date(s.date + "T12:00:00"), "EEE MMM d")} ${s.time}: ${s.job} @ ${s.location}`)
      .join(" | ")
  }))
}

/**
 * Helper function to pad time strings
 */
function padTime(time: string): string {
  if (!time) return "00:00:00"
  const parts = time.split(':')
  const hours = (parts[0] || '0').padStart(2, '0')
  const minutes = (parts[1] || '0').padStart(2, '0')
  const seconds = (parts[2] || '0').padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Helper function to parse volunteer type
 */
function parseVolunteerType(type: string): 'host' | 'volunteer' | 'hospitality' | 'panel_chair' | 'panelist' {
  const lowerType = (type || 'volunteer').toLowerCase()
  if (lowerType.includes('host')) return 'host'
  if (lowerType.includes('hospital')) return 'hospitality'
  if (lowerType.includes('chair')) return 'panel_chair'
  if (lowerType.includes('panel')) return 'panelist'
  return 'volunteer'
}