import * as XLSX from "xlsx"

export interface ParsedHospitalitySlot {
  date_time: Date
  group_hosting?: string
  group_contact?: string
  group_confirmed: boolean
  group_phone?: string
  group_email?: string
  planning_to_bring?: string
  rawData: Record<string, any>
}

export interface ParsedHospitalityData {
  slots: ParsedHospitalitySlot[]
  errors: string[]
  totalRows: number
  successfulRows: number
}

// Helper function to parse date and time from column A
// NOTE: This function automatically corrects July dates to August dates
// since the conference is August 28-31, 2025 and the source data
// sometimes incorrectly has July dates
function parseDateAndTime(value: string | number): Date | null {
  if (!value) return null

  try {
    // If it's already a number (Excel date), convert it
    if (typeof value === 'number') {
      // Excel dates are days since 1900-01-01 (with a leap year bug)
      const excelDate = new Date((value - 25569) * 86400 * 1000)
      // Fix month if it's July (month 6 in JS) - change to August (month 7)
      if (excelDate.getMonth() === 6 && excelDate.getFullYear() === 2025) {
        excelDate.setMonth(7) // Change July to August
      }
      return excelDate
    }

    // Try to parse various date/time formats
    const dateStr = value.toString().trim()
    
    // Handle format like "7/28/2025 5pm-7pm" or "7/28/2025 10pm-12am" - extract date and start time
    const rangeMatch = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}(?::\d{2})?)(am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?(am|pm)?)?/i)
    if (rangeMatch) {
      let [, datePart, timePart, meridiem] = rangeMatch
      
      // Fix month if date shows 7/XX/2025 (July) - change to 8/XX/2025 (August)
      datePart = datePart.replace(/^7\//, '8/')
      
      // Construct a proper date string
      let timeStr = timePart
      // Add :00 if no minutes specified
      if (!timeStr.includes(':')) {
        timeStr += ':00'
      }
      // Add space and meridiem
      timeStr += ' ' + meridiem.toUpperCase()
      
      const fullDateStr = `${datePart} ${timeStr}`
      let parsed = new Date(fullDateStr)
      
      if (!isNaN(parsed.getTime())) {
        const hour = parseInt(timePart)
        const isAM = meridiem.toLowerCase() === 'am'
        
        // Special handling for 12am (midnight) and 12pm (noon)
        if (hour === 12) {
          if (isAM) {
            // 12am = midnight = start of day
            parsed.setHours(0)
          }
          // 12pm is already correct (noon)
        }
        
        // Handle times after midnight for next day
        // If we have times like 12am, 2am, 4am they might be for the next day
        if (isAM && hour <= 6) {
          // Check if this might be early morning of the next day
          // This is a heuristic - times before 6am are often continuations from the previous day
          // You may need to adjust based on your actual data
        }
        
        return parsed
      }
    }
    
    // Also try with optional space before meridiem
    const rangeMatch2 = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)
    if (rangeMatch2) {
      let [, datePart, timePart, meridiem] = rangeMatch2
      
      // Fix month if date shows 7/XX/2025 (July) - change to 8/XX/2025 (August)
      datePart = datePart.replace(/^7\//, '8/')
      
      let timeStr = timePart
      if (!timeStr.includes(':')) {
        timeStr += ':00'
      }
      timeStr += ' ' + meridiem.toUpperCase()
      
      const fullDateStr = `${datePart} ${timeStr}`
      let parsed = new Date(fullDateStr)
      
      if (!isNaN(parsed.getTime())) {
        const hour = parseInt(timePart)
        const isAM = meridiem.toLowerCase() === 'am'
        
        // Special handling for 12am (midnight) and 12pm (noon)
        if (hour === 12) {
          if (isAM) {
            // 12am = midnight = start of day
            parsed.setHours(0)
          }
          // 12pm is already correct (noon)
        }
        
        return parsed
      }
    }
    
    // Handle format like "Aug 28 8:00 AM - 10:00 AM" or "Aug 28 8am-10am"
    const monthDayMatch = dateStr.match(/^([A-Za-z]+\s+\d{1,2})\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)
    if (monthDayMatch) {
      const [, datePart, timePart, meridiem] = monthDayMatch
      
      let timeStr = timePart
      if (!timeStr.includes(':')) {
        timeStr += ':00'
      }
      if (meridiem) {
        timeStr += ' ' + meridiem.toUpperCase()
      }
      
      const fullDateStr = `${datePart} 2025 ${timeStr}`
      const parsed = new Date(fullDateStr)
      
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }

    // Try native Date parsing for standard formats
    // First fix any July dates to August
    const fixedDateStr = dateStr.replace(/^7\//, '8/').replace(/Jul(?:y)?/i, 'Aug')
    const parsed = new Date(fixedDateStr)
    if (!isNaN(parsed.getTime())) {
      // If year is missing or seems wrong, set to 2025
      if (parsed.getFullYear() < 2025) {
        parsed.setFullYear(2025)
      }
      // Additional check: Fix month if it's still July (month 6 in JS) - change to August (month 7)
      if (parsed.getMonth() === 6 && parsed.getFullYear() === 2025) {
        parsed.setMonth(7) // Change July to August
      }
      return parsed
    }

    // If no year in string, append 2025
    if (!dateStr.match(/\d{4}/)) {
      // Fix any July references to August before parsing
      const fixedStr = dateStr.replace(/^7\//, '8/').replace(/Jul(?:y)?/i, 'Aug')
      const withYear = fixedStr + ' 2025'
      const parsedWithYear = new Date(withYear)
      if (!isNaN(parsedWithYear.getTime())) {
        // Fix month if it's still July (month 6 in JS) - change to August (month 7)
        if (parsedWithYear.getMonth() === 6 && parsedWithYear.getFullYear() === 2025) {
          parsedWithYear.setMonth(7) // Change July to August
        }
        return parsedWithYear
      }
    }

    // If we still couldn't parse, log the format for debugging
    console.warn(`Could not parse date/time: "${dateStr}". Expected formats: "7/28/2025 5pm-7pm", "MM/DD/YYYY HH:MM AM/PM", etc.`)
    return null
  } catch (error) {
    console.error('Error parsing date:', value, error)
    return null
  }
}

// Helper function to parse boolean from Excel
function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1' || lower === 'confirmed'
  }
  return false
}

// Helper function to clean and extract email
function extractEmail(value: string): string | undefined {
  if (!value) return undefined
  
  const emailMatch = value.match(/[\w\.-]+@[\w\.-]+\.\w+/)
  return emailMatch ? emailMatch[0] : undefined
}

// Helper function to clean and extract phone
function extractPhone(value: string): string | undefined {
  if (!value) return undefined
  
  // Remove all non-digit characters except + for international
  const cleaned = value.replace(/[^\d+]/g, '')
  
  // Check if it looks like a valid phone number (at least 10 digits)
  if (cleaned.length >= 10) {
    return cleaned
  }
  
  return undefined
}

export async function parseXLSXHospitalityData(
  file: File
): Promise<ParsedHospitalityData> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { 
      type: "array",
      cellDates: false, // Don't auto-parse dates, we'll handle it
      raw: false
    })

    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: "A",
      raw: false,
      defval: ""
    })

    const slots: ParsedHospitalitySlot[] = []
    const errors: string[] = []
    let skippedHeaderRows = 0

    jsonData.forEach((row: any, index: number) => {
      try {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
          return
        }

        // Skip header rows
        const cellA = row["A"]?.toString().toLowerCase() || ""
        if (
          cellA.includes("date") ||
          cellA.includes("time") ||
          cellA === "a" ||
          index === 0 // Often first row is header
        ) {
          skippedHeaderRows++
          return
        }

        // Parse the row data according to columns:
        // A=Date and Time
        // B=Group Hosting
        // C=Group Contact
        // D=Group Confirmed
        // E=Group phone
        // F=Group email
        // G=planning to bring

        const dateTime = parseDateAndTime(row["A"])
        
        if (!dateTime) {
          // Only add error if the cell had content
          if (row["A"] && row["A"].toString().trim()) {
            errors.push(`Row ${index + 1}: Could not parse date/time from "${row["A"]}"`)
          }
          return
        }

        const groupHosting = row["B"]?.toString().trim() || undefined
        const groupContact = row["C"]?.toString().trim() || undefined
        const groupConfirmed = parseBoolean(row["D"])
        const groupPhone = extractPhone(row["E"]?.toString() || "")
        const groupEmail = extractEmail(row["F"]?.toString() || "")
        const planningToBring = row["G"]?.toString().trim() || undefined

        const slot: ParsedHospitalitySlot = {
          date_time: dateTime,
          group_hosting: groupHosting,
          group_contact: groupContact,
          group_confirmed: groupConfirmed,
          group_phone: groupPhone,
          group_email: groupEmail,
          planning_to_bring: planningToBring,
          rawData: row
        }

        slots.push(slot)
      } catch (error) {
        errors.push(
          `Row ${index + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      }
    })

    // Sort slots by date/time
    slots.sort((a, b) => a.date_time.getTime() - b.date_time.getTime())

    return {
      slots,
      errors,
      totalRows: jsonData.length - skippedHeaderRows,
      successfulRows: slots.length
    }
  } catch (error) {
    return {
      slots: [],
      errors: [
        error instanceof Error ? error.message : "Unknown error occurred"
      ],
      totalRows: 0,
      successfulRows: 0
    }
  }
}

export function validateHospitalitySlot(slot: ParsedHospitalitySlot): string[] {
  const errors: string[] = []

  if (!slot.date_time || isNaN(slot.date_time.getTime())) {
    errors.push("Valid date and time is required")
  }

  // Group hosting can be empty for placeholder slots
  // but if provided, should have contact info
  if (slot.group_hosting) {
    if (!slot.group_contact) {
      errors.push("Group contact name is recommended when group is specified")
    }
    
    if (!slot.group_email && !slot.group_phone) {
      errors.push("At least one contact method (email or phone) is recommended")
    }
  }

  return errors
}

export function formatSlotForDisplay(slot: ParsedHospitalitySlot): string {
  const dateStr = slot.date_time.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  const groupStr = slot.group_hosting || "Open Slot"
  const confirmedStr = slot.group_confirmed ? " ✓" : ""
  
  return `${dateStr} - ${groupStr}${confirmedStr}`
}