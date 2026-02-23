"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import * as XLSX from "xlsx"
import { COUNTRY_MAPPINGS, STATE_MAPPINGS } from "./constants"

type ExcelRow = {
  "Order date": string | number
  "Guest first name": string
  "Ticket type": string
  "Ticket price": string
  "Total ticket price": string
  "Wix service fee": string
  Committee: string
  "City, State": string
  Country: string
}

type ProcessedData = {
  total: number
  country: Record<string, number>
  state: Record<string, number>
  committee: Record<string, number>
  data: ExcelRow[]
  scholarships: {
    total: number
    rows: ExcelRow[]
  }
}

function normalizeString(str: string | undefined | null): string {
  if (!str || typeof str !== "string") return ""
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Keep letters and numbers
    .trim()
}

function normalizeCountry(country: string | undefined | null): string {
  const normalized = normalizeString(country)
  return COUNTRY_MAPPINGS[normalized] || "United States" // Default to US if no match found
}

function normalizeState(cityState: string | undefined | null): string | null {
  if (!cityState || typeof cityState !== "string") return null
  // Split on any combination of commas and whitespace
  const parts = cityState.split(/[\s,]+/).filter(Boolean)

  // Try each part to see if it matches a state
  for (const part of parts) {
    const normalized = normalizeString(part)
    const state = STATE_MAPPINGS[normalized]
    if (state) return state
  }

  return null
}

async function normalizeCommittee(committee: string): Promise<string> {
  if (!committee || typeof committee !== "string") return "None/Unaffiliated"

  const cleanedCommittee = committee.toLowerCase().trim()
  const condensedNormalized = cleanedCommittee.replace(/[^a-z0-9]/g, "")

  // Get all mappings from database
  try {
    const allMappings = await getCommitteeMappings()

    // Rule 1: Check exact match with cleaned committee name
    const exactMatch = allMappings.find(
      (mapping) => mapping.input_name === cleanedCommittee
    )
    if (exactMatch) {
      return exactMatch.mapped_to
    }

    // Rule 2: Check condensed normalized match
    const condensedMatch = allMappings.find(
      (mapping) => mapping.input_name === condensedNormalized
    )
    if (condensedMatch) {
      return condensedMatch.mapped_to
    }

    // Rule 3: Check if the whole string is a state name/abbreviation for our specific bid committees
    const stateNameFromAll = STATE_MAPPINGS[condensedNormalized]
    if (stateNameFromAll) {
      // Check if we have a mapping for this state to a bid committee
      const stateMappingKey = stateNameFromAll
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
      const stateMapping = allMappings.find(
        (mapping) => mapping.input_name === stateMappingKey
      )
      if (stateMapping) {
        return stateMapping.mapped_to
      }
      // Fallback to default state bid format
      return `${stateNameFromAll} Bid for ICYPAA`
    }

    // Rule 4: Check if the string contains "bid" and a state name
    if (cleanedCommittee.includes("bid")) {
      // Split into words to find a state name
      const words = cleanedCommittee.split(/[\s,.-]+/)
      for (const word of words) {
        // Check for a match in state mappings (e.g., 'ca', 'california')
        const stateNameFromWord = STATE_MAPPINGS[word]
        if (stateNameFromWord) {
          // Check if we have a mapping for this state to a bid committee
          const stateMappingKey = stateNameFromWord
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
          const stateMapping = allMappings.find(
            (mapping) => mapping.input_name === stateMappingKey
          )
          if (stateMapping) {
            return stateMapping.mapped_to
          }
          // Fallback to default state bid format
          return `${stateNameFromWord} Bid for ICYPAA`
        }
      }
    }
  } catch (error) {
    console.error("Error fetching mappings:", error)
  }

  return committee // Fallback to original
}

/**
 * Converts an Excel serial date to a JavaScript Date object.
 * Excel's epoch starts on December 30, 1899.
 * @param serial - The Excel serial date number.
 * @returns A JavaScript Date object.
 */
function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400 // seconds in a day
  const date_info = new Date(utc_value * 1000)

  const fractional_day = serial - Math.floor(serial) + 0.0000001

  let total_seconds = Math.floor(86400 * fractional_day)

  const seconds = total_seconds % 60
  total_seconds -= seconds

  const hours = Math.floor(total_seconds / (60 * 60))
  const minutes = Math.floor((total_seconds - hours * 60 * 60) / 60)

  date_info.setHours(hours)
  date_info.setMinutes(minutes)
  date_info.setSeconds(seconds)

  return date_info
}

export async function submitRegistrationForm(
  prevState: any,
  formData: FormData
) {
  try {
    const file = formData.get("registrations-file") as File
    if (!file) {
      return { error: "No file uploaded" }
    }

    const arrayBuffer = await file.arrayBuffer()
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
        cellDates: true
      })
    } catch (error) {
      return {
        error: "Invalid file format. Please upload a valid spreadsheet."
      }
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false
    }) as ExcelRow[]

    // Convert 'Order date' from serial number to formatted string
    const processedData = jsonData.map((row) => {
      if (typeof row["Order date"] === "number") {
        const date = excelDateToJSDate(row["Order date"])
        // Format the date as desired, e.g., 'MM/DD/YYYY HH:MM:SS AM/PM'
        const formattedDate = date.toLocaleString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true
        })
        return { ...row, "Order date": formattedDate }
      }
      return row
    })

    // Separate scholarship fund entries and registration entries
    const scholarshipData = processedData.filter(
      (row) => row["Ticket type"] === "Contribute to Scholarship Fund"
    )

    // Calculate total scholarship amount
    const scholarshipTotal = scholarshipData.reduce((sum, row) => {
      // Parse the ticket price as a number, removing any non-numeric characters except decimal points
      const price = parseFloat(row["Ticket price"].replace(/[^\d.-]/g, "")) || 0
      return sum + price
    }, 0)

    // Filter out scholarship fund entries for regular registration processing
    const filteredData = processedData.filter(
      (row) => row["Ticket type"] !== "Contribute to Scholarship Fund"
    )

    // Process committee data with custom mappings
    const processedDataWithCommittees = await Promise.all(
      filteredData.map(async (row) => {
        const normalizedCommittee = await normalizeCommittee(
          row["Committee"] || ""
        )
        return {
          ...row,
          Committee: normalizedCommittee
        }
      })
    )

    console.log(
      "Processed data with committees:",
      processedDataWithCommittees.slice(0, 5)
    )

    const processed: ProcessedData = {
      total: processedDataWithCommittees.length,
      country: {},
      state: {},
      committee: {},
      data: processedDataWithCommittees,
      scholarships: {
        total: scholarshipTotal,
        rows: scholarshipData
      }
    }

    // Count by normalized country
    processedDataWithCommittees.forEach((row) => {
      const normalizedCountry = normalizeCountry(row.Country)
      processed.country[normalizedCountry] =
        (processed.country[normalizedCountry] || 0) + 1
    })

    console.log(processed.country)

    // Count by normalized state for US entries
    processedDataWithCommittees.forEach((row) => {
      const normalizedCountry = normalizeCountry(row.Country)
      if (normalizedCountry === "United States") {
        const state = normalizeState(row["City, State"])
        if (state) {
          processed.state[state] = (processed.state[state] || 0) + 1
        }
      }
    })

    // Count by normalized committee
    processedDataWithCommittees.forEach((row) => {
      if (row.Committee && row.Committee !== "None/Unaffiliated") {
        processed.committee[row.Committee] =
          (processed.committee[row.Committee] || 0) + 1
      }
    })

    console.log(processed.state)
    console.log("Committee breakdown:", processed.committee)
    console.log("Scholarship data:", processed.scholarships)

    const supabase = await createClient()

    const { data: registration, error } = await supabase
      .from("registrations")
      .insert({
        registrations: processed.total,
        countries: Object.keys(processed.country).length,
        us_states: Object.keys(processed.state).length,
        data: processed.data,
        scholarships: processed.scholarships
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting registration:", error)
      return { error: "Failed to save registration data" }
    }

    const { data: action } = await supabase
      .from("activity")
      .insert([
        {
          action: `created registration report`,
          metadata: { registration_report_id: registration.id }
        }
      ])
      .select()
      .single()

    console.log(registration)

    revalidatePath("/host/registration")
    return {
      success: "Registrations uploaded successfully",
      registration,
      action
    }
  } catch (error) {
    console.error("Error processing file:", error)
    return { error: "Failed to process file" }
  }
}

export async function getRegistrations() {
  const supabase = await createClient()
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false })
  const { data: registrationEvents } = await supabase
    .from("activity")
    .select("user, metadata")
    .ilike("action", "created registration report")
  const {
    data: { users }
  } = await (
    await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ).auth.admin.listUsers()
  const { data: profileNames } = await supabase
    .from("profile-names")
    .select("*")

  if (error) {
    console.error("Error fetching registrations:", error)
    return { error: "Failed to fetch registrations" }
  }

  return registrations.map((registration: any) => {
    const action = registrationEvents?.find(
      (event: any) => event.metadata.registration_report_id === registration.id
    )
    const user = users.find((u: any) => u.id === action?.user)
    return {
      ...registration,
      user: {
        name: profileNames?.find((p: any) => p.user_id === user?.id)
          ?.profile_name,
        avatar_url: user?.user_metadata.avatar_url
      }
    }
  })
}

export async function getCommitteeMappings() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("committee_mappings")
    .select("*")
    .order("input_name", { ascending: true })

  if (error) {
    console.error("Error fetching committee mappings:", error)
    return []
  }

  return data || []
}

export async function addCommitteeMapping(inputName: string, mappedTo: string) {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  console.log(
    "User in addCommitteeMapping:",
    user ? "authenticated" : "not authenticated"
  )

  // For development: If no user, try anyway (local development might have RLS issues)
  const insertData = {
    input_name: inputName.toLowerCase().trim(),
    mapped_to: mappedTo,
    ...(user && { created_by: user.id })
  }

  console.log("Attempting to insert mapping:", insertData)

  const { data, error } = await supabase
    .from("committee_mappings")
    .insert([insertData])
    .select()
    .single()

  if (error) {
    console.error("Error adding committee mapping:", error)

    // If it's an RLS error and we're in development, provide helpful info
    if (error.code === "42501") {
      return {
        error: {
          message: `RLS Policy Error: ${error.message}. User authenticated: ${!!user}. This might be a local development database issue.`,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      }
    }

    return { error: { message: error.message, code: error.code } }
  }

  console.log("Successfully added mapping:", data)
  return { data }
}

export async function removeCommitteeMapping(id: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("committee_mappings")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error removing committee mapping:", error)
    return { error: error.message }
  }

  return { success: true }
}
