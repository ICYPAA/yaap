import type { Program } from "../types/program"

export const DEFAULT_CONFERENCE_TIME_ZONE = "America/New_York"

const CENTRAL_STATES = new Set([
  "AL",
  "AR",
  "IA",
  "IL",
  "KS",
  "LA",
  "MN",
  "MO",
  "MS",
  "ND",
  "NE",
  "OK",
  "SD",
  "TN",
  "TX",
  "WI"
])
const MOUNTAIN_STATES = new Set(["CO", "ID", "MT", "NM", "UT", "WY"])
const PACIFIC_STATES = new Set(["CA", "NV", "OR", "WA"])

export const resolveConferenceTimeZone = (
  program?: Pick<Program, "timezone" | "location"> | null
) => {
  if (program?.timezone) return program.timezone

  const state = program?.location?.address?.state?.trim().toUpperCase()
  if (state === "MI") return "America/Detroit"
  if (state === "AZ") return "America/Phoenix"
  if (state === "AK") return "America/Anchorage"
  if (state === "HI") return "Pacific/Honolulu"
  if (state === "PR") return "America/Puerto_Rico"
  if (state && CENTRAL_STATES.has(state)) return "America/Chicago"
  if (state && MOUNTAIN_STATES.has(state)) return "America/Denver"
  if (state && PACIFIC_STATES.has(state)) return "America/Los_Angeles"
  return DEFAULT_CONFERENCE_TIME_ZONE
}

const zonedParts = (date: Date, timeZone: string) => {
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

const timeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = zonedParts(date, timeZone)
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) -
    Math.floor(date.getTime() / 1000) * 1000
  )
}

const parseTime = (value: string) => {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2])
  const period = match[3]
  if (period === "PM" && hour < 12) hour += 12
  if (period === "AM" && hour === 12) hour = 0

  return { hour, minute }
}

export const conferenceEventDateTimeToDate = (
  dateValue: string,
  timeValue: string,
  timeZone: string,
  startTimeValue?: string
) => {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const time = parseTime(timeValue)
  if (!dateMatch || !time) return null

  const startTime = startTimeValue ? parseTime(startTimeValue) : null
  const crossesMidnight =
    startTime !== null &&
    time.hour * 60 + time.minute < startTime.hour * 60 + startTime.minute

  const wallClockUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]) + (crossesMidnight ? 1 : 0),
    time.hour,
    time.minute
  )

  let instant = wallClockUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextInstant =
      wallClockUtc - timeZoneOffsetMs(new Date(instant), timeZone)
    if (nextInstant === instant) break
    instant = nextInstant
  }

  return new Date(instant)
}

export const formatConferenceProgramDate = (
  value: string | null | undefined,
  timeZone: string
) => {
  if (!value) return null
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dateOnly
    ? new Date(
        Date.UTC(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3])
        )
      )
    : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    timeZone: dateOnly ? "UTC" : timeZone,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date)
}
