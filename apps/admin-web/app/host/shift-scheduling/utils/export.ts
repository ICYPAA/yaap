import { Shift } from "../types"
import { format } from "date-fns"

export async function exportSchedule(shifts: Shift[]) {
  const XLSX = await import("xlsx")
  
  // Sort shifts by date and time
  const sortedShifts = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.start_time.localeCompare(b.start_time)
  })
  
  // Main schedule sheet data
  const scheduleData = sortedShifts.map(shift => ({
    "Date": format(new Date(shift.date + "T12:00:00"), "EEE, MMM d"),
    "Time": `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`,
    "Job Type": shift.job_type,
    "Location": shift.location || "",
    "Min Required": shift.min_volunteers,
    "Max Allowed": shift.max_volunteers,
    "Currently Assigned": shift.assignments.length,
    "Status": shift.assignments.length < shift.min_volunteers 
      ? "⚠️ Needs Coverage" 
      : shift.assignments.length >= shift.max_volunteers 
      ? "✓ Full" 
      : "Partial",
    "Assigned Volunteers": shift.assignments
      .map(a => `${a.name} (${a.type})`)
      .join(", "),
    "Notes": shift.notes || ""
  }))
  
  // Summary by job type
  const jobTypeSummary = new Map()
  sortedShifts.forEach(shift => {
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
  
  const summaryData = Array.from(jobTypeSummary.entries()).map(([jobType, summary]) => ({
    "Job Type": jobType,
    "Total Shifts": summary.totalShifts,
    "Total Slots": summary.totalSlots,
    "Filled Slots": summary.filledSlots,
    "Coverage %": Math.round((summary.filledSlots / summary.totalSlots) * 100) + "%",
    "Shifts Needing Coverage": summary.needsCoverage
  }))
  
  // Volunteer assignments sheet
  const volunteerMap = new Map()
  sortedShifts.forEach(shift => {
    shift.assignments.forEach(assignment => {
      if (!volunteerMap.has(assignment.id)) {
        volunteerMap.set(assignment.id, {
          name: assignment.name,
          type: assignment.type,
          contact: assignment.contact || "",
          shifts: []
        })
      }
      volunteerMap.get(assignment.id).shifts.push({
        date: shift.date,
        time: `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`,
        job: shift.job_type,
        location: shift.location || ""
      })
    })
  })
  
  const volunteerData = Array.from(volunteerMap.values()).map(volunteer => ({
    "Name": volunteer.name,
    "Type": volunteer.type,
    "Contact": volunteer.contact,
    "Total Shifts": volunteer.shifts.length,
    "Assignments": volunteer.shifts
      .map((s: any) => `${format(new Date(s.date + "T12:00:00"), "MMM d")} ${s.time}: ${s.job}`)
      .join("; ")
  }))
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Add sheets
  const scheduleWs = XLSX.utils.json_to_sheet(scheduleData)
  scheduleWs["!cols"] = [
    { wch: 12 }, // Date
    { wch: 15 }, // Time
    { wch: 15 }, // Job Type
    { wch: 15 }, // Location
    { wch: 12 }, // Min Required
    { wch: 12 }, // Max Allowed
    { wch: 15 }, // Currently Assigned
    { wch: 15 }, // Status
    { wch: 50 }, // Assigned Volunteers
    { wch: 30 }  // Notes
  ]
  XLSX.utils.book_append_sheet(wb, scheduleWs, "Schedule")
  
  const summaryWs = XLSX.utils.json_to_sheet(summaryData)
  summaryWs["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 }
  ]
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")
  
  const volunteerWs = XLSX.utils.json_to_sheet(volunteerData)
  volunteerWs["!cols"] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 80 }
  ]
  XLSX.utils.book_append_sheet(wb, volunteerWs, "Volunteers")
  
  // Save file
  const filename = `shift-schedule-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`
  XLSX.writeFile(wb, filename)
}