import * as XLSX from "xlsx"

export interface MeetingRaidMember {
  name: string
  phone: string
}

export interface ParsedMeetingRaid {
  id: string
  date?: string
  dayOfWeek?: string
  time?: string
  meetingName: string
  address?: string
  members: MeetingRaidMember[]
  rawData: Record<string, any>
}

export interface ParsedMeetingRaidData {
  meetings: ParsedMeetingRaid[]
  errors: string[]
  totalRows: number
  successfulRows: number
}

// Helper function to parse member from cell value
// Format: "Name Phone" where phone starts with digit or (
function parseMemberFromCell(cellValue: string): MeetingRaidMember | null {
  if (!cellValue || !cellValue.trim()) return null
  
  const trimmed = cellValue.trim()
  
  // Phone number starts with a digit or parenthesis
  const phoneStartMatch = trimmed.match(/[\d\(]/)
  
  if (phoneStartMatch && phoneStartMatch.index !== undefined) {
    // Find where the phone number starts
    const phoneStartIndex = phoneStartMatch.index
    
    // Split name and phone based on where phone starts
    const name = trimmed.substring(0, phoneStartIndex).trim()
    const phoneStr = trimmed.substring(phoneStartIndex).trim()
    
    // Extract just the digits from the phone string
    const phoneDigits = phoneStr.replace(/\D/g, '')
    
    // Format phone number as ###-###-#### if we have 10 digits
    let formattedPhone = ""
    if (phoneDigits.length === 10) {
      formattedPhone = `${phoneDigits.substring(0, 3)}-${phoneDigits.substring(3, 6)}-${phoneDigits.substring(6)}`
    } else if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
      // Handle 11 digit numbers starting with 1
      formattedPhone = `${phoneDigits.substring(1, 4)}-${phoneDigits.substring(4, 7)}-${phoneDigits.substring(7)}`
    } else {
      formattedPhone = phoneStr // Keep original if not standard format
    }
    
    return {
      name: name || "",
      phone: formattedPhone
    }
  } else {
    // No phone number found, just return the name
    return {
      name: trimmed,
      phone: ""
    }
  }
}

// Helper function to generate unique ID for meeting
function generateMeetingId(
  date: string,
  time: string,
  meetingName: string,
  index: number
): string {
  const dateStr = date.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  const timeStr = time.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  const nameStr = meetingName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 20)
  
  return `raid-${dateStr}-${timeStr}-${nameStr}-${index}`
}

export async function parseXLSXMeetingRaidData(
  file: File
): Promise<ParsedMeetingRaidData> {
  const errors: string[] = []
  const meetings: ParsedMeetingRaid[] = []
  let skippedPastMeetings = 0

  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      type: "array",
      cellDates: true,  // Parse dates as JS Date objects
      raw: false,
      dateNF: 'mm/dd/yyyy'  // Expected date format
    })

    if (!workbook.SheetNames.length) {
      throw new Error("No sheets found in the workbook")
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: "A",
      raw: false,
      defval: ""
    })

    if (!jsonData.length) {
      throw new Error("No data found in the spreadsheet")
    }

    console.log(`Processing ${jsonData.length} rows from meeting raid spreadsheet`)

    jsonData.forEach((row: any, index: number) => {
      try {
        // Extract data from columns
        // A=Date, B=Day of week, C=Time, D=Meeting Name, E=Address
        // H=person 1, I=person 2, J=person 3, K=person 4
        const date = row["A"]?.toString().trim() || ""
        const dayOfWeek = row["B"]?.toString().trim() || ""
        const time = row["C"]?.toString().trim() || ""
        const meetingName = row["D"]?.toString().trim() || ""
        const address = row["E"]?.toString().trim() || ""
        
        // Skip header rows
        if (index === 0 && (
          date.toLowerCase().includes('date') ||
          meetingName.toLowerCase().includes('meeting')
        )) {
          return
        }
        
        // Skip empty rows
        if (!date && !dayOfWeek && !time && !meetingName && !address) {
          return
        }
        
        // Skip day delineation rows (just day names)
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        if (dayNames.includes(date.toLowerCase()) && !meetingName && !time) {
          return
        }
        
        // Meeting name is required
        if (!meetingName) {
          return
        }
        
        // Parse the date and skip if it's in the past
        if (date) {
          try {
            let meetingDate: Date
            
            // Check if date is already a Date object from Excel
            if (date instanceof Date) {
              meetingDate = date
            } else if (typeof date === 'number') {
              // Excel serial date number (days since 1900-01-01)
              // Excel incorrectly treats 1900 as a leap year, so we need to adjust
              const excelEpoch = new Date(1900, 0, 1)
              const daysSinceEpoch = date - 2 // Subtract 2 to account for Excel's date bug
              meetingDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000)
            } else {
              // Try to parse as string
              meetingDate = new Date(date)
              
              // If the year is not set or is in the past, assume current year
              if (meetingDate.getFullYear() < new Date().getFullYear()) {
                meetingDate.setFullYear(new Date().getFullYear())
              }
            }
            
            // Validate the parsed date
            if (isNaN(meetingDate.getTime())) {
              console.warn(`Invalid date "${date}" for meeting ${meetingName}, skipping date check`)
              // Don't skip the meeting if we can't parse the date
            } else {
              // Get today in CST/CDT timezone
              const today = new Date()
              const cstOffset = -6 * 60 // CST is UTC-6
              const cdtOffset = -5 * 60 // CDT is UTC-5
              
              // Determine if we're in daylight saving time (roughly March to November)
              const month = today.getMonth()
              const isDST = month >= 2 && month < 10 // March (2) to October (9)
              const offsetMinutes = isDST ? cdtOffset : cstOffset
              
              // Adjust today to CST/CDT
              const todayCST = new Date(today.getTime() + offsetMinutes * 60 * 1000)
              todayCST.setHours(0, 0, 0, 0) // Set to start of today in CST
              
              // Skip if the meeting date is before today
              if (meetingDate < todayCST) {
                console.log(`Skipping past meeting: ${meetingName} on ${meetingDate.toLocaleDateString()}`)
                skippedPastMeetings++
                return
              }
            }
          } catch (error) {
            // If date parsing fails, log it but continue
            console.warn(`Error parsing date "${date}" for meeting ${meetingName}:`, error)
          }
        }
        
        // Extract members from columns H, I, J, K (index 7, 8, 9, 10)
        const members: MeetingRaidMember[] = []
        
        // Column H - Person 1
        const person1 = row["H"]?.toString().trim() || ""
        if (person1) {
          const member = parseMemberFromCell(person1)
          if (member) members.push(member)
        }
        
        // Column I - Person 2
        const person2 = row["I"]?.toString().trim() || ""
        if (person2) {
          const member = parseMemberFromCell(person2)
          if (member) members.push(member)
        }
        
        // Column J - Person 3
        const person3 = row["J"]?.toString().trim() || ""
        if (person3) {
          const member = parseMemberFromCell(person3)
          if (member) members.push(member)
        }
        
        // Column K - Person 4
        const person4 = row["K"]?.toString().trim() || ""
        if (person4) {
          const member = parseMemberFromCell(person4)
          if (member) members.push(member)
        }
        
        const id = generateMeetingId(date, time, meetingName, index)

        const meetingData: ParsedMeetingRaid = {
          id,
          date: date || undefined,
          dayOfWeek: dayOfWeek || undefined,
          time: time || undefined,
          meetingName,
          address: address || undefined,
          members,
          rawData: row
        }

        meetings.push(meetingData)
      } catch (rowError) {
        errors.push(
          `Row ${index + 1}: ${rowError instanceof Error ? rowError.message : "Unknown error"}`
        )
      }
    })

    console.log(`Parsing complete:
      - Total rows: ${jsonData.length}
      - Successfully parsed: ${meetings.length}
      - Skipped past meetings: ${skippedPastMeetings}
      - Errors: ${errors.length}`)

    return {
      meetings,
      errors,
      totalRows: jsonData.length,
      successfulRows: meetings.length
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred"
    errors.push(`File parsing error: ${errorMessage}`)

    return {
      meetings: [],
      errors,
      totalRows: 0,
      successfulRows: 0
    }
  }
}

// Helper function to validate meeting raid data
export function validateMeetingRaidData(meeting: ParsedMeetingRaid): string[] {
  const validationErrors: string[] = []

  if (!meeting.meetingName) {
    validationErrors.push("Meeting name is required")
  }

  // At least one of date or time should be present
  if (!meeting.date && !meeting.time) {
    validationErrors.push("Either date or time should be specified")
  }

  return validationErrors
}

// Helper function to format meeting raid for display
export function formatMeetingRaidForDisplay(meeting: ParsedMeetingRaid): string {
  let display = meeting.meetingName

  if (meeting.date) {
    display += ` - ${meeting.date}`
  }
  
  if (meeting.dayOfWeek) {
    display += ` (${meeting.dayOfWeek})`
  }

  if (meeting.time) {
    display += ` at ${meeting.time}`
  }

  if (meeting.address) {
    display += ` @ ${meeting.address}`
  }

  if (meeting.members.length > 0) {
    display += ` [${meeting.members.length} volunteers]`
  }

  return display
}