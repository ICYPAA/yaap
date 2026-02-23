import * as XLSX from "xlsx"

export interface ParsedChairperson {
  id: string
  name: string
  phone?: string
  dayTime: string
  panelName: string
  rawData: Record<string, any>
}

export interface ParsedChairpersonData {
  chairpeople: ParsedChairperson[]
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

// Helper function to extract phone number from text
function extractPhoneNumber(text: string): string | undefined {
  if (!text) return undefined

  // Try each phone pattern
  for (const pattern of phonePatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return undefined
}

// Helper function to clean name by removing phone numbers
function cleanName(text: string): string {
  if (!text) return ""

  let name = text

  // Remove all phone patterns
  for (const pattern of phonePatterns) {
    name = name.replace(pattern, "")
  }

  // Remove extra whitespace and punctuation
  name = name.replace(/[,\-()]/g, " ")
  name = name.replace(/\s+/g, " ")
  name = name.trim()

  return name
}

// Helper function to parse name and phone from combined field
function parseNameAndPhone(text: string): { name: string; phone?: string } {
  if (!text) return { name: "", phone: undefined }

  const phone = extractPhoneNumber(text)
  const name = cleanName(text)

  return { name, phone }
}

// Helper function to generate chairperson ID
function generateChairpersonId(
  name: string,
  panelName: string,
  dayTime: string,
  index: number
): string {
  const nameSlug = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  const panelSlug = panelName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  const timeSlug = dayTime.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  
  return `chair-${nameSlug}-${panelSlug}-${timeSlug}-${index}`
}

export async function parseXLSXChairpersonData(
  file: File
): Promise<ParsedChairpersonData> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    // Get the first sheet (or you can look for a specific sheet name)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convert to JSON with headers as specified:
    // A: Name and number
    // B: Day and Time
    // C: Panel Name
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: "A",
      raw: false,
      defval: ""
    })

    const chairpeople: ParsedChairperson[] = []
    const errors: string[] = []
    let skippedHeaderRows = 0
    let skippedEmptyRows = 0
    let totalProcessedRows = 0

    console.log(`Processing ${jsonData.length} total rows from spreadsheet`)

    jsonData.forEach((row: any, index: number) => {
      totalProcessedRows++
      try {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
          skippedEmptyRows++
          return
        }

        // Skip header rows (check for common header text - be more specific)
        const cellA = row["A"]?.toString() || ""
        const cellB = row["B"]?.toString() || ""
        const cellC = row["C"]?.toString() || ""
        
        const cellALower = cellA.toLowerCase()
        const cellBLower = cellB.toLowerCase()
        const cellCLower = cellC.toLowerCase()

        // Only skip if it's clearly a header row (exact matches or very specific patterns)
        if (
          (cellALower === "name" || cellALower === "chairperson" || cellALower === "name and number") &&
          (cellBLower === "day" || cellBLower === "time" || cellBLower === "day and time") &&
          (cellCLower === "panel" || cellCLower === "panel name" || cellCLower === "meeting")
        ) {
          skippedHeaderRows++
          return
        }

        // Extract data from columns
        const nameAndNumberField = row["A"]?.toString().trim() || ""
        const dayTimeField = row["B"]?.toString().trim() || ""
        const panelNameField = row["C"]?.toString().trim() || ""

        // Skip rows without essential data
        // Skip if ALL fields are empty
        if (!nameAndNumberField && !dayTimeField && !panelNameField) {
          skippedEmptyRows++
          return
        }
        
        // Skip day delineation rows (e.g., just "Thursday" in column A with nothing else)
        // These are rows that only have a day name and no other data
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        if (dayNames.includes(nameAndNumberField.toLowerCase()) && !dayTimeField && !panelNameField) {
          // This is a day separator row, skip it silently
          return
        }
        
        // Skip if name field is completely empty
        if (!nameAndNumberField) {
          // Don't log error for empty rows
          return
        }
        
        // Skip if panel name is missing (this is essential for matching)
        if (!panelNameField) {
          // Don't log error for rows that are likely separators or incomplete
          return
        }

        // Parse name and phone from column A
        const { name, phone } = parseNameAndPhone(nameAndNumberField)

        // Skip if we couldn't extract a valid name
        if (!name) {
          errors.push(`Row ${index + 1}: Could not extract valid name from "${nameAndNumberField}"`)
          return
        }

        const chairperson: ParsedChairperson = {
          id: generateChairpersonId(name, panelNameField, dayTimeField || "unknown", index),
          name,
          phone,  // Phone can be undefined - that's OK
          dayTime: dayTimeField || "",
          panelName: panelNameField,  // This is required
          rawData: row
        }

        chairpeople.push(chairperson)
      } catch (error) {
        errors.push(
          `Row ${index + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      }
    })

    console.log(`Parsing complete:
      - Total rows in file: ${jsonData.length}
      - Skipped header rows: ${skippedHeaderRows}
      - Skipped empty rows: ${skippedEmptyRows}
      - Successfully parsed: ${chairpeople.length}
      - Errors: ${errors.length}`)

    return {
      chairpeople,
      errors,
      totalRows: jsonData.length - skippedHeaderRows - skippedEmptyRows,
      successfulRows: chairpeople.length
    }
  } catch (error) {
    return {
      chairpeople: [],
      errors: [
        error instanceof Error ? error.message : "Unknown error occurred"
      ],
      totalRows: 0,
      successfulRows: 0
    }
  }
}

export function validateChairpersonData(chairperson: ParsedChairperson): string[] {
  const errors: string[] = []

  if (!chairperson.name || chairperson.name.trim() === "") {
    errors.push("Chairperson name is required")
  }

  if (!chairperson.dayTime || chairperson.dayTime.trim() === "") {
    errors.push("Day and time are required")
  }

  if (!chairperson.panelName || chairperson.panelName.trim() === "") {
    errors.push("Panel name is required")
  }

  return errors
}

export function formatChairpersonForDisplay(chairperson: ParsedChairperson): string {
  return `${chairperson.name}${chairperson.phone ? ` (${chairperson.phone})` : ""} - ${
    chairperson.dayTime
  } - ${chairperson.panelName}`
}

// Helper function to normalize panel names for matching
function normalizePanelName(name: string): string {
  // Convert to lowercase
  let normalized = name.toLowerCase()
  
  // Remove special characters except numbers
  // Keep numbers as they may be important (e.g., "Step 1", "Big Book Study 2")
  normalized = normalized.replace(/[^a-z0-9\s]/g, '')
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Trim
  normalized = normalized.trim()
  
  return normalized
}

// Helper function to match chairpeople to existing panels
export function matchChairpersonToPanel(
  chairperson: ParsedChairperson,
  panels: Array<{ title: string; timeDay: string; room: string }>
): {
  matched: boolean
  panel?: { title: string; timeDay: string; room: string }
  confidence: number
} {
  // Normalize the chairperson's panel name
  const chairPanelNormalized = normalizePanelName(chairperson.panelName)
  
  // Try to find exact match first (after normalization)
  const exactMatch = panels.find((panel) => {
    const panelTitleNormalized = normalizePanelName(panel.title)
    return (
      panelTitleNormalized === chairPanelNormalized &&
      panel.timeDay.toLowerCase().includes(chairperson.dayTime.toLowerCase())
    )
  })

  if (exactMatch) {
    return { matched: true, panel: exactMatch, confidence: 100 }
  }

  // Try match without time constraint
  const nameOnlyMatch = panels.find((panel) => {
    const panelTitleNormalized = normalizePanelName(panel.title)
    return panelTitleNormalized === chairPanelNormalized
  })

  if (nameOnlyMatch) {
    // Check time similarity
    const timeSimilarity = nameOnlyMatch.timeDay
      .toLowerCase()
      .includes(chairperson.dayTime.toLowerCase())
      ? 30
      : 0
    
    return {
      matched: true,
      panel: nameOnlyMatch,
      confidence: 70 + timeSimilarity
    }
  }

  // Try partial match on normalized names
  const partialMatch = panels.find((panel) => {
    const panelTitleNormalized = normalizePanelName(panel.title)
    
    // Check if either contains the other (minimum 3 characters)
    return (
      (chairPanelNormalized.length >= 3 && panelTitleNormalized.includes(chairPanelNormalized)) ||
      (panelTitleNormalized.length >= 3 && chairPanelNormalized.includes(panelTitleNormalized))
    )
  })

  if (partialMatch) {
    // Calculate confidence based on how similar the time is
    const timeSimilarity = partialMatch.timeDay
      .toLowerCase()
      .includes(chairperson.dayTime.toLowerCase())
      ? 25
      : 0

    return {
      matched: true,
      panel: partialMatch,
      confidence: 25 + timeSimilarity
    }
  }

  return { matched: false, confidence: 0 }
}