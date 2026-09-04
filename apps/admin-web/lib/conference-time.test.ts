import { describe, expect, it } from "vitest"
import {
  conferenceLocalDateTimeToIso,
  formatConferenceDate,
  formatConferenceDateTimeForInput,
  getConferenceWeekday,
  inferConferenceTimeZone,
  normalizeConferenceDateOnly
} from "./conference-time"

describe("conference time", () => {
  it("defaults Michigan conferences to Eastern Time", () => {
    expect(
      inferConferenceTimeZone({ address: { state: "Michigan" } })
    ).toBe("America/Detroit")
    expect(inferConferenceTimeZone({ address: { state: "MI" } })).toBe(
      "America/Detroit"
    )
  })

  it("keeps Wisconsin conferences in Central Time", () => {
    expect(inferConferenceTimeZone({ address: { state: "WI" } })).toBe(
      "America/Chicago"
    )
  })

  it("round trips a conference-local date and time across daylight saving", () => {
    const iso = conferenceLocalDateTimeToIso(
      "2026-09-03T09:30",
      "America/Detroit"
    )

    expect(iso).toBe("2026-09-03T13:30:00.000Z")
    expect(
      formatConferenceDateTimeForInput(iso, "America/Detroit")
    ).toBe("2026-09-03T09:30")
  })

  it("formats date-only event values without using the viewer timezone", () => {
    expect(
      formatConferenceDate("2026-09-03", "America/Detroit", {
        weekday: "long",
        month: "long",
        day: "numeric"
      })
    ).toBe("Thursday, September 3")
    expect(getConferenceWeekday("2026-09-03")).toBe("Thursday")
  })

  it("keeps an event date as a calendar value at edit and save boundaries", () => {
    expect(normalizeConferenceDateOnly("2026-09-03")).toBe("2026-09-03")
    expect(
      normalizeConferenceDateOnly("2026-09-03T00:00:00.000Z")
    ).toBe("2026-09-03")
  })

  it("does not move an Eastern calendar date backward when formatting", () => {
    const easternMidnight = new Date("2026-09-04T00:00:00-04:00")
    expect(
      easternMidnight.toLocaleDateString("en-US", {
        timeZone: "America/Chicago"
      })
    ).toBe("9/3/2026")

    expect(formatConferenceDate("2026-09-04", "America/Detroit")).toBe(
      "9/4/2026"
    )
  })
})
