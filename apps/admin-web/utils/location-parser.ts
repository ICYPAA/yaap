import {
  CITY_STATE_MAPPINGS,
  COUNTRY_MAPPINGS,
  STATE_MAPPINGS
} from "@/app/host/registration/constants"

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

export function normalizeCountry(country: string): string {
  if (!country) return "United States"
  const normalized = normalizeString(country)
  return COUNTRY_MAPPINGS[normalized] || country
}

export function parseLocationData(cityState: string): string | null {
  if (!cityState) return null

  const parts = cityState.split(/[\s,]+/).filter(Boolean)

  // First try to match states directly
  for (const part of parts) {
    const normalized = normalizeString(part)
    const state = STATE_MAPPINGS[normalized]
    if (state) return state
  }

  // Then try to match cities (individual parts)
  for (const part of parts) {
    const normalized = normalizeString(part)
    const state = CITY_STATE_MAPPINGS[normalized]
    if (state) return state
  }

  // Finally, try concatenating adjacent parts for multi-word cities
  for (let i = 0; i < parts.length - 1; i++) {
    const combined = normalizeString(parts[i] + parts[i + 1])
    const state = CITY_STATE_MAPPINGS[combined]
    if (state) return state
  }

  // Also try concatenating up to 3 words (for cases like "New York City")
  for (let i = 0; i < parts.length - 2; i++) {
    const combined = normalizeString(parts[i] + parts[i + 1] + parts[i + 2])
    const state = CITY_STATE_MAPPINGS[combined]
    if (state) return state
  }

  return null
}

export { CITY_STATE_MAPPINGS, COUNTRY_MAPPINGS, STATE_MAPPINGS }
