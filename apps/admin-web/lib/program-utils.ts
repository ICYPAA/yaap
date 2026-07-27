export function toDateOnly(value?: string | null) {
  return value ? value.split("T")[0] : ""
}

export function formatProgramDate(value?: string | null) {
  const date = toDateOnly(value)
  if (!date) return ""

  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  })
}

export function formatProgramDateRange(program?: {
  start_date?: string | null
  end_date?: string | null
} | null) {
  if (!program?.start_date || !program?.end_date) return "Dates TBD"

  const start = new Date(`${toDateOnly(program.start_date)}T12:00:00`)
  const end = new Date(`${toDateOnly(program.end_date)}T12:00:00`)
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric"
    })}-${end.toLocaleDateString("en-US", {
      day: "numeric",
      year: "numeric"
    })}`
  }

  return `${formatProgramDate(program.start_date)} - ${formatProgramDate(
    program.end_date
  )}`
}

export function formatProgramLocation(program?: { location?: unknown } | null) {
  const location = program?.location
  if (!location) return "Location TBD"

  if (typeof location === "string") return location
  if (typeof location !== "object") return "Location TBD"

  const locationRecord = location as Record<string, unknown>
  const name =
    typeof locationRecord.name === "string" ? locationRecord.name : undefined
  const address =
    typeof locationRecord.address === "object" && locationRecord.address
      ? (locationRecord.address as Record<string, unknown>)
      : undefined
  const city =
    typeof address?.city === "string" ? address.city : undefined
  const state =
    typeof address?.state === "string" ? address.state : undefined
  const cityState = [city, state].filter(Boolean).join(", ")

  return [name, cityState].filter(Boolean).join(" - ") || "Location TBD"
}

export function buildProgramDayMap(program?: {
  start_date?: string | null
  end_date?: string | null
} | null) {
  const start = toDateOnly(program?.start_date)
  const end = toDateOnly(program?.end_date)
  const dayMap: Record<string, string> = {}

  if (!start || !end) return dayMap

  const cursor = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)

  while (cursor <= endDate) {
    const date = cursor.toISOString().slice(0, 10)
    const names = [
      cursor.toLocaleDateString("en-US", { weekday: "long" }),
      cursor.toLocaleDateString("en-US", { weekday: "short" }),
      cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    ]

    names.forEach((name) => {
      dayMap[name.toLowerCase()] = date
    })
    dayMap[cursor.getDate().toString()] = date
    cursor.setDate(cursor.getDate() + 1)
  }

  return dayMap
}
