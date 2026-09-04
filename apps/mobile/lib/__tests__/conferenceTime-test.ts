import {
  conferenceEventDateTimeToDate,
  formatConferenceProgramDate,
  resolveConferenceTimeZone
} from "../conferenceTime"
import type { Program } from "../../types/program"

const program = (state: string, timezone?: string) =>
  ({
    timezone,
    location: { address: { state } }
  }) as Program

describe("conference time", () => {
  it("uses the program timezone and falls back to its venue state", () => {
    expect(resolveConferenceTimeZone(program("MI"))).toBe("America/Detroit")
    expect(resolveConferenceTimeZone(program("WI"))).toBe("America/Chicago")
    expect(
      resolveConferenceTimeZone(program("MI", "America/Los_Angeles"))
    ).toBe("America/Los_Angeles")
  })

  it("interprets an event wall-clock time in the conference timezone", () => {
    expect(
      conferenceEventDateTimeToDate(
        "2026-09-03",
        "9:30 PM",
        "America/Detroit"
      )?.toISOString()
    ).toBe("2026-09-04T01:30:00.000Z")
  })

  it("handles events ending after midnight", () => {
    expect(
      conferenceEventDateTimeToDate(
        "2026-09-03",
        "1:00 AM",
        "America/Detroit",
        "11:00 PM"
      )?.toISOString()
    ).toBe("2026-09-04T05:00:00.000Z")
  })

  it("formats program timestamps in conference time", () => {
    expect(
      formatConferenceProgramDate(
        "2026-09-03T04:00:00.000Z",
        "America/Detroit"
      )
    ).toContain("September 3, 2026")
    expect(
      formatConferenceProgramDate("2026-09-03", "America/Detroit")
    ).toContain("September 3, 2026")
  })
})
