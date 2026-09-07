import { conferenceClock, hasEventEnded, initialProgramDay } from '../programTime'

describe('conference-local schedule controls', () => {
  const days = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']
  it('opens Saturday in Detroit while a traveling attendee is still on Friday', () => {
    const now = new Date('2026-09-05T04:30:00Z')
    expect(conferenceClock(now, 'America/Los_Angeles').date).toBe('2026-09-04')
    expect(initialProgramDay(days, 'America/Detroit', now)).toBe(2)
  })
  it('chooses first before the conference and last after it', () => {
    expect(initialProgramDay(days, 'America/Detroit', new Date('2026-09-01T12:00Z'))).toBe(0)
    expect(initialProgramDay(days, 'America/Detroit', new Date('2026-09-09T12:00Z'))).toBe(3)
  })
  it('keeps an overnight event visible until its next-day ending', () => {
    expect(hasEventEnded('2026-09-04', '23:00', '01:00', 'America/Detroit', new Date('2026-09-05T04:30Z'))).toBe(false)
    expect(hasEventEnded('2026-09-04', '23:00', '01:00', 'America/Detroit', new Date('2026-09-05T05:00Z'))).toBe(true)
  })
  it('uses the end time and handles the fall daylight-saving transition', () => {
    expect(hasEventEnded('2026-10-31', '23:00', '03:00', 'America/New_York', new Date('2026-11-01T07:59Z'))).toBe(false)
    expect(hasEventEnded('2026-10-31', '23:00', '03:00', 'America/New_York', new Date('2026-11-01T08:00Z'))).toBe(true)
  })
})
