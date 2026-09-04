export const DEFAULT_CONFERENCE_TIME_ZONE = "America/New_York"

export const CONFERENCE_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
  { value: "America/Detroit", label: "Eastern Time — Michigan (EST/EDT)" },
  {
    value: "America/Indiana/Indianapolis",
    label: "Eastern Time — Indiana (EST/EDT)"
  },
  { value: "America/Chicago", label: "Central Time (CST/CDT)" },
  { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST/AKDT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (AST)" }
] as const

const STATE_TIME_ZONES: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Denver",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  DC: "America/New_York",
  PR: "America/Puerto_Rico"
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC",
  "PUERTO RICO": "PR"
}

type ConferenceLocation =
  | {
      address?: {
        state?: string
      }
    }
  | string
  | null
  | undefined

const normalizeState = (state?: string) => {
  const value = state?.trim().toUpperCase() || ""
  return value.length === 2 ? value : STATE_ABBREVIATIONS[value] || value
}

export const inferConferenceTimeZone = (location: ConferenceLocation) => {
  if (!location || typeof location === "string") {
    return DEFAULT_CONFERENCE_TIME_ZONE
  }

  return (
    STATE_TIME_ZONES[normalizeState(location.address?.state)] ||
    DEFAULT_CONFERENCE_TIME_ZONE
  )
}

export const resolveConferenceTimeZone = (
  timeZone: string | null | undefined,
  location?: ConferenceLocation
) => timeZone?.trim() || inferConferenceTimeZone(location)

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

export const normalizeConferenceDateOnly = (
  value: string | null | undefined
) => value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ""

const formatParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date)

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>
}

export const formatConferenceDateTimeForInput = (
  value: string,
  timeZone: string
) => {
  if (!value) return ""

  const localValue = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?!.*(?:Z|[+-]\d{2}:?\d{2})$)/
  )
  if (localValue) return localValue[0]

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = formatParts(date, timeZone)

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute
  ).padStart(2, "0")}`
}

const timeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = formatParts(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

export const conferenceLocalDateTimeToIso = (
  value: string,
  timeZone: string
) => {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (!match) return value

  const [, year, month, day, hour, minute, second = "0"] = match
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )

  let instant = wallClockUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextInstant =
      wallClockUtc - timeZoneOffsetMs(new Date(instant), timeZone)
    if (nextInstant === instant) break
    instant = nextInstant
  }

  return new Date(instant).toISOString()
}

export const formatConferenceDate = (
  value: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {}
) => {
  if (!value) return ""

  const dateOnly = value.match(dateOnlyPattern)
  const date = dateOnly
    ? new Date(
        Date.UTC(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3])
        )
      )
    : new Date(value)

  if (Number.isNaN(date.getTime())) return "Invalid Date"

  return new Intl.DateTimeFormat("en-US", {
    timeZone: dateOnly ? "UTC" : timeZone,
    ...options
  }).format(date)
}

export const getConferenceWeekday = (value: string) =>
  formatConferenceDate(value, "UTC", { weekday: "long" })
