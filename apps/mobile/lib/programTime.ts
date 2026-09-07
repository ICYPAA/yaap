import type { Program } from '../types/program'

import { conferenceEventDateTimeToDate, resolveConferenceTimeZone } from './conferenceTime'

export const getProgramTimeZone = (program: Program | null) => resolveConferenceTimeZone(program)

export function conferenceClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)!.value
  return { date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')) }
}

export function hasEventEnded(date: string, start: string, end: string | null | undefined,
  timeZone: string, now = new Date()): boolean {
  const instant = conferenceEventDateTimeToDate(date, end || start, timeZone, start)
  return instant !== null && instant.getTime() <= now.getTime()
}

export function initialProgramDay(dates: string[], timeZone: string, now = new Date()) {
  const today = conferenceClock(now, timeZone).date
  const next = dates.findIndex(date => date.slice(0, 10) >= today)
  return next < 0 ? Math.max(0, dates.length - 1) : next
}
