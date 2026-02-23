import * as XLSX from "xlsx"

export interface PanelPanelist {
  name: string
  email?: string
  phone?: string
}

export interface ParsedPanel {
  id: string
  timeDay: string
  room: string
  title: string
  topic?: string
  description?: string
  literatureReference?: string
  panelists: PanelPanelist[]
  rawData: Record<string, any>
}

export interface ParsedPanelData {
  panels: ParsedPanel[]
  errors: string[]
  totalRows: number
  successfulRows: number
}

// Phone number patterns used for extraction and cleaning
const phonePatterns = [
  /\+1\s?\(\d{3}\)\s?\d{3}-\d{4}/, // +1 (123) 456-7890
  /\(\d{3}\)\s?\d{3}-?\d{4}/, // (123) 123-1234 or (123)123-1234
  /\(\d{3}\)\s?\d{3}\s?\d{4}/, // (123) 123 1234
  /\d{3}-\d{3}-\d{4}/, // 123-123-1234
  /\d{3}\.\d{3}\.\d{4}/, // 123.123.1234
  /\d{3}\s\d{3}\s\d{4}/, // 123 123 1234
  /\+1\s?\d{3}\s?\d{3}\s?\d{4}/, // +1 123 123 1234
  /\+1\s?\d{3}-\d{3}-\d{4}/, // +1 123-123-1234
  /\d{10}/, // 1234567890
  /\+1\d{10}/ // +11234567890
]

// Helper function to extract contact info from a text string
function extractContactInfo(text: string): { email?: string; phone?: string } {
  if (!text) return {}

  const contact: { email?: string; phone?: string } = {}

  // Look for email pattern
  const emailMatch = text.match(/[\w\.-]+@[\w\.-]+\.\w+/)
  if (emailMatch) {
    contact.email = emailMatch[0]
  }

  // Look for phone patterns
  for (const pattern of phonePatterns) {
    const phoneMatch = text.match(pattern)
    if (phoneMatch) {
      contact.phone = phoneMatch[0]
      break
    }
  }

  return contact
}

// Helper function to extract panelist name from text
function extractPanelistName(text: string): string {
  if (!text) return ""

  let name = text

  // 1. Remove email addresses
  name = name.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, "")

  // 2. Remove all known phone patterns
  for (const pattern of phonePatterns) {
    name = name.replace(pattern, "")
  }

  // 3. Remove other parenthesized text (pronouns, notes like "grapevine", etc.)
  name = name.replace(/\s*\([^)]+\)/g, "")

  // 4. Remove specific keywords and phrases (case-insensitive)
  const noisePatterns = [
    /Text\/Phone\s*-\s*Email/gi,
    /Cell\s*-\s*\.\s*Email\s*-/gi,
    /P\s*:\s*\/\s*E\s*:/gi,
    /Call\/Text/gi,
    /Call\s*me\s*:/gi,
    /Text\s*:/gi,
    /Phone\s*:/gi,
    /Cellphone/gi,
    /Text/gi,
    /Call/gi,
    /Email/gi,
    /Phone/gi,
    /Cell/gi
  ]
  for (const pattern of noisePatterns) {
    name = name.replace(pattern, "")
  }

  // 5. Remove leftover special characters that are not hyphens within words.
  name = name.replace(/[,/:.]/g, "")

  // 6. Clean up extra whitespace and trailing/leading hyphens
  name = name.replace(/\s+/g, " ").trim()
  name = name.replace(/^[-\s]+|[-\s]+$/g, "").trim()

  return name
}

// Helper function to extract panelists from row data
function extractPanelists(rowData: Record<string, any>): PanelPanelist[] {
  const panelists: PanelPanelist[] = []

  // Check columns G, I, K, M for panelist info
  const panelistColumns = ["F", "H", "J", "L"]

  for (const col of panelistColumns) {
    const cellValue = rowData[col]
    if (cellValue && typeof cellValue === "string" && cellValue.trim()) {
      // Skip cells containing "seeking"
      if (cellValue.toLowerCase().includes("seeking")) {
        continue
      }

      const contact = extractContactInfo(cellValue)
      const name = extractPanelistName(cellValue)

      if (name) {
        panelists.push({
          name,
          ...contact
        })
      }
    }
  }

  return panelists
}

// Helper function to generate panel ID
function generatePanelId(rowData: Record<string, any>, index: number): string {
  const title = rowData["B"] || `Panel ${index + 1}`
  const room = rowData["N"] || "Unknown Room"
  const timeDay = rowData["A"] || "Unknown Time"

  return `${title}-${room}-${timeDay}`
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
}

// Helper function to strip seconds from time strings
function stripSeconds(timeStr: string): string {
  // Remove seconds from time strings (e.g., "10:30:00" -> "10:30", "4:45:00 PM" -> "4:45 PM")
  // This specifically targets the seconds part after HH:MM:SS format
  return timeStr.replace(/(\d{1,2}:\d{2}):\d{2}(\s*[AP]M)?/gi, "$1$2")
}

// Helper function to parse time and day information
function parseTimeDay(
  cellValue: string,
  previousDay: string
): { timeDay: string; currentDay: string } {
  if (!cellValue) return { timeDay: previousDay, currentDay: previousDay }

  const value = cellValue.trim()

  // Check if this is just a day (no time)
  const dayOnly =
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(value)
  if (dayOnly) {
    return { timeDay: value, currentDay: value }
  }

  // Check if this is just a time (use previous day)
  const timeOnly = /^\d{1,2}:\d{2}|^\d{1,2}(am|pm)/i.test(value)
  if (timeOnly && previousDay) {
    const cleanTime = stripSeconds(value)
    return { timeDay: `${previousDay} ${cleanTime}`, currentDay: previousDay }
  }

  // Check if this contains both day and time
  const dayTimeMatch = value.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(.*)$/i
  )
  if (dayTimeMatch) {
    const day = dayTimeMatch[1]
    const time = dayTimeMatch[2].trim()
    const cleanTime = stripSeconds(time)
    return { timeDay: cleanTime ? `${day} ${cleanTime}` : day, currentDay: day }
  }

  // Default case - strip seconds and return
  const cleanValue = stripSeconds(value)
  return { timeDay: cleanValue, currentDay: cleanValue }
}

export async function parseXLSXPanelData(file: File): Promise<ParsedPanelData> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    // Get the "Panels" sheet (tab 2)
    const sheetNames = workbook.SheetNames
    const panelsSheetName =
      sheetNames.find((name) => name.toLowerCase().includes("panels")) ||
      sheetNames[1]

    if (!panelsSheetName) {
      throw new Error("Could not find Panels sheet in the workbook")
    }

    const worksheet = workbook.Sheets[panelsSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: "A",
      raw: false,
      defval: ""
    })

    const panels: ParsedPanel[] = []
    const errors: string[] = []
    let currentDay = ""
    let foundStartTime = false

    jsonData.forEach((row: any, index: number) => {
      try {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) return

        // Check if this is the "Start Time" indicator
        if (
          row["A"] === "Start Time" ||
          row["A"]?.toLowerCase().includes("start time")
        ) {
          foundStartTime = true
          return
        }

        // Check if this is the "Open" header - process panels from this point
        if (row["A"] === "Open" || row["A"]?.toLowerCase().includes("open")) {
          // This is a header row, skip it but start processing subsequent rows
          return
        }

        // Skip rows without required data
        if (!row["A"] && !row["B"] && !row["C"]) return

        const timeDay = parseTimeDay(row["A"], currentDay)
        currentDay = timeDay.currentDay

        const room = row["N"]?.trim() || ""
        const title = row["B"]?.trim() || ""
        const topic = row["C"]?.trim() || ""
        const description = row["D"]?.trim() || ""
        const literatureReference = row["O"]?.trim() || ""

        // Skip rows without essential data
        if (!room && !title) return

        const panelists = extractPanelists(row)

        const panel: ParsedPanel = {
          id: generatePanelId(row, index),
          timeDay: timeDay.timeDay,
          room,
          title,
          topic: topic || undefined,
          description: description || undefined,
          literatureReference: literatureReference || undefined,
          panelists,
          rawData: row
        }

        panels.push(panel)
      } catch (error) {
        errors.push(
          `Row ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    })

    return {
      panels,
      errors,
      totalRows: jsonData.length,
      successfulRows: panels.length
    }
  } catch (error) {
    return {
      panels: [],
      errors: [
        error instanceof Error ? error.message : "Unknown error occurred"
      ],
      totalRows: 0,
      successfulRows: 0
    }
  }
}

export function validatePanelData(panel: ParsedPanel): string[] {
  const errors: string[] = []

  if (!panel.title || panel.title.trim() === "") {
    errors.push("Panel title is required")
  }

  if (!panel.room || panel.room.trim() === "") {
    errors.push("Room is required")
  }

  if (!panel.timeDay || panel.timeDay.trim() === "") {
    errors.push("Time and day are required")
  }

  if (panel.panelists.length === 0) {
    errors.push("At least one panelist is required")
  }

  // Validate panelists have contact info
  panel.panelists.forEach((panelist, index) => {
    if (!panelist.name || panelist.name.trim() === "") {
      errors.push(`Panelist ${index + 1} name is required`)
    }

    if (!panelist.email && !panelist.phone) {
      errors.push(
        `Panelist ${index + 1} (${panelist.name}) must have either email or phone`
      )
    }
  })

  return errors
}

export function formatPanelForDisplay(panel: ParsedPanel): string {
  const panelistInfo = panel.panelists
    .map(
      (p) =>
        `${p.name}${p.email ? ` (${p.email})` : ""}${p.phone ? ` (${p.phone})` : ""}`
    )
    .join(", ")

  return `${panel.title} - ${panel.room} - ${panel.timeDay}${panelistInfo ? ` - Panelists: ${panelistInfo}` : ""}`
}
