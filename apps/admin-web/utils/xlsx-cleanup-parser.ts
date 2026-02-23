import * as XLSX from 'xlsx'

export interface CleanupEntry {
  name: string
  last_initial: string
  location: string
  date: string
  time: string
  phone?: string
}

/**
 * Parse day range like "Thur-Sat" or "Thursday-Saturday" into individual dates
 */
function parseDayRange(dayStr: string): string[] {
  const dayMap: Record<string, string> = {
    'thursday': '2025-08-28',
    'thurs': '2025-08-28',
    'thur': '2025-08-28',
    'thu': '2025-08-28',
    'friday': '2025-08-29',
    'fri': '2025-08-29',
    'saturday': '2025-08-30',
    'sat': '2025-08-30',
    'sunday': '2025-08-31',
    'sun': '2025-08-31'
  }
  
  const dates: string[] = []
  const cleanDay = dayStr.trim().toLowerCase()
  
  // Check if it's a range (contains dash)
  if (cleanDay.includes('-')) {
    const [startDay, endDay] = cleanDay.split('-').map(d => d.trim())
    
    // Find the start and end dates
    let startDate: string | null = null
    let endDate: string | null = null
    
    for (const [key, date] of Object.entries(dayMap)) {
      if (startDay.includes(key) || key.includes(startDay)) {
        startDate = date
      }
      if (endDay.includes(key) || key.includes(endDay)) {
        endDate = date
      }
    }
    
    if (startDate && endDate) {
      // Get all dates in the range
      const allDates = ['2025-08-28', '2025-08-29', '2025-08-30', '2025-08-31']
      const startIdx = allDates.indexOf(startDate)
      const endIdx = allDates.indexOf(endDate)
      
      if (startIdx !== -1 && endIdx !== -1) {
        for (let i = startIdx; i <= endIdx; i++) {
          dates.push(allDates[i])
        }
      }
    }
  } else {
    // Single day
    for (const [key, date] of Object.entries(dayMap)) {
      if (cleanDay.includes(key) || key.includes(cleanDay)) {
        dates.push(date)
        break
      }
    }
  }
  
  // If no dates found, default to all days
  if (dates.length === 0) {
    console.warn(`Could not parse day(s): "${dayStr}", defaulting to Thursday`)
    dates.push('2025-08-28')
  }
  
  return dates
}

/**
 * Parse date/time string like "Thur-Sat 6pm-6:45pm" or "Friday 2pm-4pm"
 */
function parseDateTimeRange(dateTimeStr: string): { dates: string[], timeRange: string } {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return { dates: ['2025-08-28'], timeRange: '18:00 - 18:45' }
  }
  
  const trimmed = dateTimeStr.trim()
  
  // Split by space to separate days from time
  // Look for the last occurrence of a number followed by am/pm
  const timeMatch = trimmed.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))[^a-z]*-[^a-z]*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
  
  let dayPart = trimmed
  let timePart = '6pm-6:45pm' // default
  
  if (timeMatch) {
    const timeIndex = trimmed.indexOf(timeMatch[0])
    dayPart = trimmed.substring(0, timeIndex).trim()
    timePart = timeMatch[0]
  } else {
    // Try to find any time pattern
    const simpleTimeMatch = trimmed.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/i)
    if (simpleTimeMatch) {
      const timeIndex = trimmed.indexOf(simpleTimeMatch[0])
      dayPart = trimmed.substring(0, timeIndex).trim()
      timePart = trimmed.substring(timeIndex).trim()
    }
  }
  
  // Parse the day(s)
  const dates = parseDayRange(dayPart)
  
  // Parse and format the time
  const timeRange = formatTimeRange(timePart)
  
  return { dates, timeRange }
}

/**
 * Format time range like "6pm-6:45pm" to "18:00 - 18:45"
 */
function formatTimeRange(timeStr: string): string {
  // Clean up the time string
  const cleanTime = timeStr.replace(/\s+/g, '').toLowerCase()
  
  // Extract start and end times
  const match = cleanTime.match(/(\d{1,2}(?::\d{2})?)(am|pm)?-(\d{1,2}(?::\d{2})?)(am|pm)?/)
  
  if (!match) {
    return '18:00 - 18:45' // default
  }
  
  const [, startTime, startPeriod, endTime, endPeriod] = match
  
  // Determine AM/PM for both times
  let startAmPm = startPeriod || endPeriod || 'pm'
  let endAmPm = endPeriod || startAmPm
  
  // Convert to 24-hour format
  const start24 = convertTo24Hour(startTime, startAmPm)
  const end24 = convertTo24Hour(endTime, endAmPm)
  
  return `${start24} - ${end24}`
}

/**
 * Convert 12-hour time to 24-hour format
 */
function convertTo24Hour(time: string, period: string): string {
  let [hourStr, minuteStr = '00'] = time.split(':')
  let hour = parseInt(hourStr)
  const minute = parseInt(minuteStr)
  
  if (period === 'pm' && hour !== 12) {
    hour += 12
  } else if (period === 'am' && hour === 12) {
    hour = 0
  }
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

/**
 * Parse name and extract first name only, use dash for last initial
 */
function parseName(nameStr: string): { name: string, last_initial: string } {
  if (!nameStr || typeof nameStr !== 'string') {
    return { name: '', last_initial: '-' }
  }
  
  const trimmed = nameStr.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 0) {
    return { name: '', last_initial: '-' }
  }
  
  // Only use the first part (index 0) as the name
  const firstName = parts[0]
  
  return {
    name: firstName,
    last_initial: '-'
  }
}

/**
 * Format phone number
 */
function formatPhone(phoneStr: string | undefined): string | undefined {
  if (!phoneStr) return undefined
  
  // Remove all non-digits
  const digits = phoneStr.replace(/\D/g, '')
  
  if (digits.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  return phoneStr // Return as-is if not 10 digits
}

export async function parseCleanupSpreadsheet(file: File): Promise<CleanupEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON with header mapping
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[]
        
        const entries: CleanupEntry[] = []
        
        // Process each row
        jsonData.forEach((row, index) => {
          // Skip header row if it contains column labels
          if (index === 0 && typeof row.A === 'string' && 
              (row.A.toLowerCase().includes('name') || row.A === 'Name')) {
            return
          }
          
          // Skip empty rows
          if (!row.A) return
          
          const nameData = parseName(String(row.A || ''))
          const location = String(row.B || 'TBD')
          const dateTimeStr = String(row.C || '')
          const phone = formatPhone(String(row.D || ''))
          
          // Parse date/time to get multiple dates if it's a range
          const { dates, timeRange } = parseDateTimeRange(dateTimeStr)
          
          // Create an entry for each date in the range
          dates.forEach(date => {
            entries.push({
              name: nameData.name,
              last_initial: nameData.last_initial,
              location,
              date,
              time: timeRange,
              phone
            })
          })
        })
        
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