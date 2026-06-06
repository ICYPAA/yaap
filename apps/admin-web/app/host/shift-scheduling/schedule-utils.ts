import { format } from "date-fns"

interface ExportShiftAssignment {
  volunteer_name: string
  is_host_member?: boolean
}

interface ExportShift {
  name: string
  job_type_id: string | number
  job_types: {
    name: string
  }
  location?: string | null
  start_time: string
  end_time: string
  min_volunteers: number
  max_volunteers: number
  shift_assignments: ExportShiftAssignment[]
  notes?: string | null
}

interface ExportJobType {
  id: string | number
  name: string
}

interface ImportedShift {
  name: string
  job_type: string
  location: string | null
  date: string
  start_time: string
  end_time: string
  min_volunteers: number
  max_volunteers: number
  notes: string | null
  assigned_volunteers: string
}

type ImportRow = Record<string, string | number | null | undefined>

export async function exportToExcel(shifts: ExportShift[], jobTypes: ExportJobType[]) {
  const XLSX = await import("xlsx")
  
  const worksheetData = shifts.map(shift => ({
    "Shift Name": shift.name,
    "Job Type": shift.job_types.name,
    "Location": shift.location || "",
    "Date": format(new Date(shift.start_time), "yyyy-MM-dd"),
    "Start Time": format(new Date(shift.start_time), "HH:mm"),
    "End Time": format(new Date(shift.end_time), "HH:mm"),
    "Min Volunteers": shift.min_volunteers,
    "Max Volunteers": shift.max_volunteers,
    "Current Assignments": shift.shift_assignments.length,
    "Assigned Volunteers": shift.shift_assignments
      .map((a) => `${a.volunteer_name}${a.is_host_member ? " (Host)" : ""}`)
      .join(", "),
    "Status": shift.shift_assignments.length < shift.min_volunteers 
      ? "Needs Coverage" 
      : shift.shift_assignments.length >= shift.max_volunteers 
      ? "Full" 
      : "Partial",
    "Notes": shift.notes || ""
  }))
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(worksheetData)
  
  const colWidths = [
    { wch: 20 }, // Shift Name
    { wch: 15 }, // Job Type
    { wch: 15 }, // Location
    { wch: 12 }, // Date
    { wch: 10 }, // Start Time
    { wch: 10 }, // End Time
    { wch: 12 }, // Min Volunteers
    { wch: 12 }, // Max Volunteers
    { wch: 15 }, // Current Assignments
    { wch: 40 }, // Assigned Volunteers
    { wch: 15 }, // Status
    { wch: 30 }  // Notes
  ]
  ws["!cols"] = colWidths
  
  XLSX.utils.book_append_sheet(wb, ws, "Shift Schedule")
  
  const summaryData = jobTypes.map(jobType => {
    const jobShifts = shifts.filter(s => s.job_type_id === jobType.id)
    const totalSlots = jobShifts.reduce((sum, s) => sum + s.max_volunteers, 0)
    const filledSlots = jobShifts.reduce((sum, s) => sum + s.shift_assignments.length, 0)
    const needsCoverage = jobShifts.filter(s => s.shift_assignments.length < s.min_volunteers).length
    
    return {
      "Job Type": jobType.name,
      "Total Shifts": jobShifts.length,
      "Total Slots": totalSlots,
      "Filled Slots": filledSlots,
      "Coverage %": totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) + "%" : "0%",
      "Shifts Needing Coverage": needsCoverage
    }
  })
  
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
  
  const filename = `shift-schedule-${format(new Date(), "yyyy-MM-dd")}.xlsx`
  XLSX.writeFile(wb, filename)
}

export interface ImportPreview {
  newShifts: ImportedShift[]
  updatedShifts: ImportedShift[]
  deletedShifts: ImportedShift[]
  errors: string[]
}

export async function parseImportFile(file: File): Promise<ImportPreview | null> {
  const XLSX = await import("xlsx")
  
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
          resolve(null)
          return
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<ImportRow>(worksheet)
        
        // Parse the data and generate preview
        const preview: ImportPreview = {
          newShifts: [],
          updatedShifts: [],
          deletedShifts: [],
          errors: []
        }
        
        // Process each row
        jsonData.forEach((row, index: number) => {
          try {
            // Validate required fields
            if (!row["Shift Name"] || !row["Job Type"] || !row["Date"] || !row["Start Time"] || !row["End Time"]) {
              preview.errors.push(`Row ${index + 2}: Missing required fields`)
              return
            }
            
            // Create shift object from import data
            const importedShift = {
              name: String(row["Shift Name"]),
              job_type: String(row["Job Type"]),
              location: row["Location"] ? String(row["Location"]) : null,
              date: String(row["Date"]),
              start_time: `${row["Date"]} ${row["Start Time"]}`,
              end_time: `${row["Date"]} ${row["End Time"]}`,
              min_volunteers: parseInt(String(row["Min Volunteers"] || "")) || 1,
              max_volunteers: parseInt(String(row["Max Volunteers"] || "")) || 1,
              notes: row["Notes"] ? String(row["Notes"]) : null,
              assigned_volunteers: row["Assigned Volunteers"]
                ? String(row["Assigned Volunteers"])
                : ""
            }
            
            // For now, treat all as new shifts
            // In a real implementation, you'd compare with existing shifts
            preview.newShifts.push(importedShift)
          } catch (error) {
            preview.errors.push(`Row ${index + 2}: Invalid data format`)
          }
        })
        
        resolve(preview)
      } catch (error) {
        console.error("Error parsing file:", error)
        resolve(null)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export async function importFromExcel() {
  const XLSX = await import("xlsx")
  
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".xlsx,.xls"
  
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) return

        const data = new Uint8Array(e.target.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        console.log("Imported data:", jsonData)
        
      } catch (error) {
        console.error("Error importing file:", error)
      }
    }
    reader.readAsArrayBuffer(file)
  }
  
  input.click()
}
