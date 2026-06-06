import * as XLSX from 'xlsx'

export interface GreeterEntry {
  day: string
  name: string
  last_initial?: string
  meeting?: string
  room: string
  time: string
  phone_number?: string
  status?: 'accepted' | 'declined' | 'pending' | 'maybe'
  notes?: string
}

/**
 * Parse time string like "10am - 12pm" or "5-7pm" into start and end times
 */
function parseTimeRange(timeStr: string): { start: string, end: string } {
  // Remove all spaces and convert to lowercase
  const cleanTime = timeStr.replace(/\s/g, '').toLowerCase()
  
  // Split by dash
  const parts = cleanTime.split('-')
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}`)
  }
  
  const [startStr, endStr] = parts
  
  // Extract am/pm from end if present
  const endMatch = endStr.match(/(am|pm)$/)
  const endPeriod = endMatch ? endMatch[1] : null
  
  // If start doesn't have am/pm, use the same as end
  const startMatch = startStr.match(/(am|pm)$/)
  const startPeriod = startMatch ? startMatch[1] : endPeriod
  
  // Parse start time
  const startTime = parseIndividualTime(startStr, startPeriod)
  // Parse end time
  const endTime = parseIndividualTime(endStr, endPeriod)
  
  return { start: startTime, end: endTime }
}

/**
 * Parse individual time like "10am" or "5" with period into 24hr format
 */
function parseIndividualTime(timeStr: string, period: string | null): string {
  // Remove am/pm if present
  const cleanTime = timeStr.replace(/(am|pm)$/i, '')
  
  // Parse hour and optional minutes
  const colonIndex = cleanTime.indexOf(':')
  let hour: number
  let minute = 0
  
  if (colonIndex > -1) {
    hour = parseInt(cleanTime.substring(0, colonIndex))
    minute = parseInt(cleanTime.substring(colonIndex + 1))
  } else {
    hour = parseInt(cleanTime)
  }
  
  // Convert to 24hr format
  if (period === 'pm' && hour !== 12) {
    hour += 12
  } else if (period === 'am' && hour === 12) {
    hour = 0
  }
  
  // Format as HH:MM:SS
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`
}

/**
 * Parse name into first name and last initial
 */
function parseName(nameStr: string): { name: string, last_initial?: string } {
  if (!nameStr || typeof nameStr !== 'string') {
    return { name: '', last_initial: undefined }
  }
  
  const trimmed = nameStr.trim()
  
  // Find the last space
  const lastSpaceIndex = trimmed.lastIndexOf(' ')
  
  if (lastSpaceIndex === -1) {
    // No space, only first name
    return { name: trimmed, last_initial: undefined }
  }
  
  const firstName = trimmed.substring(0, lastSpaceIndex)
  const lastPart = trimmed.substring(lastSpaceIndex + 1)
  
  // Remove any punctuation from last initial
  const lastInitial = lastPart.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()
  
  return {
    name: firstName,
    last_initial: lastInitial || undefined
  }
}

function buildDayMap(conferenceDates: string[]): Record<string, string> {
  const dayMap: Record<string, string> = {}

  conferenceDates.forEach((date) => {
    const parsedDate = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return

    const weekday = parsedDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase()
    const shortWeekday = parsedDate
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toLowerCase()
    const monthDay = parsedDate
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toLowerCase()
    const dayNumber = String(parsedDate.getDate())

    dayMap[weekday] = date
    dayMap[shortWeekday] = date
    dayMap[weekday.slice(0, 4)] = date
    dayMap[weekday.slice(0, 5)] = date
    dayMap[dayNumber] = date
    dayMap[monthDay] = date
  })

  return dayMap
}

function dayToDate(day: string, conferenceDates: string[]): string {
  const dayMap = buildDayMap(conferenceDates)
  
  for (const [key, value] of Object.entries(dayMap)) {
    if (day.toLowerCase().includes(key)) {
      return value
    }
  }
  
  return conferenceDates[0]
}

/**
 * Parse status value
 */
function parseStatus(statusStr: string | undefined): 'accepted' | 'declined' | 'pending' | 'maybe' {
  if (!statusStr) return 'pending'
  
  const lower = statusStr.toLowerCase()
  if (lower.includes('accept') || lower.includes('yes') || lower.includes('confirmed')) {
    return 'accepted'
  }
  if (lower.includes('decline') || lower.includes('no')) {
    return 'declined'
  }
  if (lower.includes('maybe') || lower.includes('tentative')) {
    return 'maybe'
  }
  return 'pending'
}

export async function parseGreeterSpreadsheet(file: File, conferenceDates: string[]): Promise<GreeterEntry[]> {
  if (conferenceDates.length === 0) {
    throw new Error('Select a current conference before importing greeter volunteers')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        
        if (jsonData.length < 7) {
          throw new Error('Spreadsheet must have at least 7 rows')
        }
        
        // Get headers from row 1 (index 0)
        const headers = jsonData[0] as string[]
        
        // Find column indices
        const dayIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('day'))
        const nameIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('name'))
        const meetingIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('meeting'))
        const roomIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('room'))
        const timeIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('time'))
        const phoneIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('phone'))
        const statusIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('status'))
        const notesIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('note'))
        
        const entries: GreeterEntry[] = []
        
        // Process rows starting from row 7 (index 6)
        for (let i = 6; i < jsonData.length; i++) {
          const row = jsonData[i]
          
          // Skip empty rows
          if (!row || row.length === 0) continue
          
          // Skip if no name
          const nameValue = nameIndex >= 0 ? row[nameIndex] : null
          if (!nameValue) continue
          
          // Parse name
          const { name, last_initial } = parseName(String(nameValue))
          
          // Get day
          const dayValue = dayIndex >= 0 ? String(row[dayIndex] || '') : ''
          const date = dayToDate(dayValue, conferenceDates)
          
          // Get meeting - check if it's "Lobby" which means it's the room
          const meetingValue = meetingIndex >= 0 ? String(row[meetingIndex] || '') : ''
          let room = roomIndex >= 0 ? String(row[roomIndex] || '') : ''
          
          if (meetingValue.toLowerCase() === 'lobby' && !room) {
            room = 'Lobby'
          }
          
          // Get time and parse it
          const timeValue = timeIndex >= 0 ? String(row[timeIndex] || '') : ''
          let startTime = '09:00:00'
          let endTime = '11:00:00'
          
          try {
            if (timeValue) {
              const { start, end } = parseTimeRange(timeValue)
              startTime = start
              endTime = end
            }
          } catch (err) {
            console.warn(`Failed to parse time "${timeValue}":`, err)
          }
          
          // Get other fields
          const phone = phoneIndex >= 0 ? String(row[phoneIndex] || '') : undefined
          const status = statusIndex >= 0 ? parseStatus(String(row[statusIndex] || '')) : 'pending'
          const notes = notesIndex >= 0 ? String(row[notesIndex] || '') : undefined
          
          entries.push({
            day: date,
            name,
            last_initial,
            meeting: meetingValue !== 'Lobby' ? meetingValue : undefined,
            room: room || 'Lobby',
            time: `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`,
            phone_number: phone,
            status,
            notes
          })
        }
        
        resolve(entries)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsBinaryString(file)
  })
}
