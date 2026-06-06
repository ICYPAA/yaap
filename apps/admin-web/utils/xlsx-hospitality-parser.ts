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

export interface HospitalityDateOptions {
  startDate?: string | null
  endDate?: string | null
}

function enumerateConferenceDates(options?: HospitalityDateOptions): Date[] {
  if (!options?.startDate || !options?.endDate) return []

  const dates: Date[] = []
  const current = new Date(`${options.startDate}T00:00:00`)
  const end = new Date(`${options.endDate}T00:00:00`)

  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return []
  }

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function getConferenceYear(options?: HospitalityDateOptions): number {
  const start = options?.startDate
    ? new Date(`${options.startDate}T00:00:00`)
    : null
  return start && !Number.isNaN(start.getTime())
    ? start.getFullYear()
    : new Date().getFullYear()
}

function coerceToConferenceDate(
  parsed: Date,
  options?: HospitalityDateOptions
): Date {
  const conferenceDates = enumerateConferenceDates(options)
  const matchingDate = conferenceDates.find(
    (date) => date.getDate() === parsed.getDate()
  )

  if (!matchingDate) return parsed

  const corrected = new Date(matchingDate)
  corrected.setHours(
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds(),
    parsed.getMilliseconds()
  )
  return corrected
}

function parseDateAndTime(
  value: string | number,
  options?: HospitalityDateOptions
): Date | null {
  if (!value) return null

  try {
    // If it's already a number (Excel date), convert it
    if (typeof value === 'number') {
      // Excel dates are days since 1900-01-01 (with a leap year bug)
      const excelDate = new Date((value - 25569) * 86400 * 1000)
      return coerceToConferenceDate(excelDate, options)
    }

    // Try to parse various date/time formats
    const dateStr = value.toString().trim()
    
    // Handle format like "7/28/2025 5pm-7pm" or "7/28/2025 10pm-12am" - extract date and start time
    const rangeMatch = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}(?::\d{2})?)(am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?(am|pm)?)?/i)
    if (rangeMatch) {
      const [, datePart, timePart, meridiem] = rangeMatch
      
      // Construct a proper date string
      let timeStr = timePart
      // Add :00 if no minutes specified
      if (!timeStr.includes(':')) {
        timeStr += ':00'
      }
      // Add space and meridiem
      timeStr += ' ' + meridiem.toUpperCase()
      
      const fullDateStr = `${datePart} ${timeStr}`
      const parsed = new Date(fullDateStr)
      
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
        
        return coerceToConferenceDate(parsed, options)
      }
    }
    
    // Also try with optional space before meridiem
    const rangeMatch2 = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)
    if (rangeMatch2) {
      const [, datePart, timePart, meridiem] = rangeMatch2
      
      let timeStr = timePart
      if (!timeStr.includes(':')) {
        timeStr += ':00'
      }
      timeStr += ' ' + meridiem.toUpperCase()
      
      const fullDateStr = `${datePart} ${timeStr}`
      const parsed = new Date(fullDateStr)
      
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
        
        return coerceToConferenceDate(parsed, options)
      }
    }
    
    // Handle format like "Sep 12 8:00 AM - 10:00 AM" or "Sep 12 8am-10am"
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
      
      const fullDateStr = `${datePart} ${getConferenceYear(options)} ${timeStr}`
      const parsed = new Date(fullDateStr)
      
      if (!isNaN(parsed.getTime())) {
        return coerceToConferenceDate(parsed, options)
      }
    }

    // Try native Date parsing for standard formats
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      return coerceToConferenceDate(parsed, options)
    }

    // If no year in string, append the selected conference year.
    if (!dateStr.match(/\d{4}/)) {
      const withYear = `${dateStr} ${getConferenceYear(options)}`
      const parsedWithYear = new Date(withYear)
      if (!isNaN(parsedWithYear.getTime())) {
        return coerceToConferenceDate(parsedWithYear, options)
      }
    }

    // If we still couldn't parse, log the format for debugging
    console.warn(`Could not parse date/time: "${dateStr}". Expected formats: "MM/DD/YYYY 5pm-7pm", "MM/DD/YYYY HH:MM AM/PM", etc.`)
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
  file: File,
  dateOptions?: HospitalityDateOptions
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

        const dateTime = parseDateAndTime(row["A"], dateOptions)
        
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
