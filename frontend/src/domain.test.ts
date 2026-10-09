import { describe, expect, it } from 'vitest'
import { matchesActivity } from './api'
import { timeTotals, type TimeEntry } from './time'
import { activity } from './test-server'
const entry = (start: Date, duration: number): TimeEntry => ({ id: 1, activity_id: 1, started_at: start.getTime()/1000, duration_seconds: duration, source: 'manual' })
describe('time allocation', () => {
  it('splits an entry across local midnight and includes a running session once', () => {
    const now = new Date(2026,9,9,1,0), start = new Date(2026,9,8,23,30)
    const saved = entry(start, 3600), timer = { started_at: new Date(2026,9,9,0,45).getTime()/1000 }
    expect(timeTotals([saved], timer, now)).toEqual({ today: 2700, week: 4500, overall: 4500 })
  })
  it('clips to the local Monday boundary without changing historical overall time', () => {
    const now = new Date(2026,9,12,1,0), saved = entry(new Date(2026,9,11,23,30),3600)
    expect(timeTotals([saved],null,now)).toEqual({ today: 1800, week: 1800, overall: 3600 })
  })
  it('uses local calendar boundaries across a DST change', () => {
    const start = new Date(2026,2,8,0,0), end = new Date(2026,2,9,0,0)
    const seconds = (end.getTime()-start.getTime())/1000
    const totals = timeTotals([entry(start,seconds)], null, new Date(2026,2,8,23,59,59))
    expect(totals.today).toBe(seconds-1)
    expect(totals.overall).toBe(seconds)
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/New_York') expect(seconds).toBe(23*3600)
  })
})
it('combines category, status, and trimmed title/description search', () => {
  expect(matchesActivity(activity,'  FASTAPI ','1',false)).toBe(true)
  expect(matchesActivity(activity,'Python','uncategorized',false)).toBe(false)
  expect(matchesActivity(activity,'Python','all',true)).toBe(false)
  expect(matchesActivity({...activity, category_id:null},'', 'uncategorized',false)).toBe(true)
})
