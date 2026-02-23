import * as XLSX from "xlsx"

export interface MeetingMember {
  name: string
  phone: string
}

export interface ParsedMeeting {
  id: string
  name?: string
  date?: string
  time?: string
  location?: string
  day?: string
  isRecurring: boolean
  isMultipleDaysPerWeek: boolean
  daysOfWeek?: string[]
  members: MeetingMember[]
  rawData: Record<string, any>
}

export interface ParsedMeetingData {
  meetings: ParsedMeeting[]
  errors: string[]
  totalRows: number
  successfulRows: number
}



// Helper function to generate unique ID for meeting based on meeting name, time, and location
function generateMeetingId(
  meetingName: string,
  time: string,
  location: string
): string {
  // Create a unique ID based on meeting name, time, and location combination
  const nameStr = meetingName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 20)
  const timeStr = time.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
  const locationStr = location.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 20)
  
  return `meeting-${nameStr}-${timeStr}-${locationStr}`
}

export async function parseXLSXMeetingData(
  file: File
): Promise<ParsedMeetingData> {
  const errors: string[] = []
  const meetings: ParsedMeeting[] = []

  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      type: "array",
      cellDates: true
    })

    if (!workbook.SheetNames.length) {
      throw new Error("No sheets found in the workbook")
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: ""
    }) as Record<string, any>[]

    if (!jsonData.length) {
      throw new Error("No data found in the spreadsheet")
    }

    // Get headers from the first row
    const headers = Object.keys(jsonData[0])

    jsonData.forEach((row, index) => {
      try {
        // Extract basic meeting information based on specific column positions
        // A = Meeting, B = Members Going, C = Time, D = Location, E = Link
        const rowValues = Object.values(row)
        const meetingName = rowValues[0]?.toString().trim() || ""
        const membersGoing = rowValues[1]?.toString().trim() || ""
        const time = rowValues[2]?.toString().trim() || ""
        const location = rowValues[3]?.toString().trim() || ""
        const link = rowValues[4]?.toString().trim() || ""
        
        // Skip row 1 if empty
        if (index === 0 && !meetingName && !membersGoing && !time && !location) {
          return
        }
        
        // Skip row 2 if it's headers
        if (index === 1 && meetingName.toLowerCase().includes('meeting')) {
          return
        }
        
        // Skip day delineation rows (rows with just day names like "Monday", "Tuesday" etc)
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        if (dayNames.includes(meetingName.toLowerCase()) && !membersGoing && !time && !location) {
          return
        }
        
        // Skip rows where members going is empty or starts with "~"
        if (!membersGoing || membersGoing.startsWith("~")) {
          return
        }
        
        // Parse members from the members going column (comma separated list of "name phone")
        const members: MeetingMember[] = []
        const memberPairs = membersGoing.split(',')
        
        for (const pair of memberPairs) {
          const trimmedPair = pair.trim()
          if (trimmedPair) {
            // Phone number starts with a digit or parenthesis
            // Match patterns like: "John Doe 123-456-7890" or "John Doe (123) 456-7890" or "John Doe 1234567890"
            const phoneStartMatch = trimmedPair.match(/[\d\(]/)
            
            if (phoneStartMatch) {
              // Find where the phone number starts
              const phoneStartIndex = phoneStartMatch.index || 0
              
              // Split name and phone based on where phone starts
              const name = trimmedPair.substring(0, phoneStartIndex).trim()
              const phoneStr = trimmedPair.substring(phoneStartIndex).trim()
              
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
              
              members.push({ 
                name: name || "", 
                phone: formattedPhone 
              })
            } else {
              // If no phone number found, just add the name
              members.push({ 
                name: trimmedPair, 
                phone: "" 
              })
            }
          }
        }
        
        // Skip if no valid members were parsed
        if (members.length === 0) {
          return
        }

        // For outreach reminders, we don't have recurring meetings
        const isRecurring = false
        const isMultipleDaysPerWeek = false

        // Generate unique ID based on meeting name, time, and location
        const id = generateMeetingId(meetingName, time, location)

        const meetingData: ParsedMeeting = {
          id,
          name: meetingName,
          date: undefined, // No date column in this format
          time: time ? time.toString() : undefined,
          location: location ? location.toString() : undefined,
          day: undefined,
          isRecurring,
          isMultipleDaysPerWeek,
          daysOfWeek: undefined,
          members,
          rawData: row
        }

        meetings.push(meetingData)
      } catch (rowError) {
        errors.push(
          `Row ${index + 2}: ${rowError instanceof Error ? rowError.message : "Unknown error"}`
        )
      }
    })

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

// Helper function to validate meeting data
export function validateMeetingData(meeting: ParsedMeeting): string[] {
  const validationErrors: string[] = []

  if (!meeting.name) {
    validationErrors.push("Meeting name is required")
  }

  if (meeting.members.length === 0) {
    validationErrors.push("At least one member should be specified")
  }

  meeting.members.forEach((member, index) => {
    if (!member.name && !member.phone) {
      validationErrors.push(
        `Member ${index + 1}: Either name or phone is required`
      )
    }
  })

  return validationErrors
}

// Helper function to format meeting for display
export function formatMeetingForDisplay(meeting: ParsedMeeting): string {
  let display = meeting.name || "Unnamed Meeting"

  if (meeting.time) {
    display += ` at ${meeting.time}`
  }

  if (meeting.location) {
    display += ` @ ${meeting.location}`
  }

  return display
}
