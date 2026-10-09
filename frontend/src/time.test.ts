import { describe, expect, it } from 'vitest'
import { formatDuration, formatSavedTime, weeklySeconds, type TimeEntry } from './time'

describe('time calculations', () => {
  it.each([
    [0, '0 min'], [7, '<1 min'], [59, '<1 min'], [60, '1 min'],
    [720, '12 min'], [3600, '1h'], [4800, '1h 20m'], [90000, '25h'],
  ])('formats %i saved seconds as %s', (seconds, expected) => {
    expect(formatSavedTime(seconds)).toBe(expected)
  })
  it('formats seconds without wrapping after 24 hours', () => {
    expect(formatDuration(0)).toBe('00:00:00')
    expect(formatDuration(5075)).toBe('01:24:35')
    expect(formatDuration(90000)).toBe('25:00:00')
  })

  it('clips entries to the current local week', () => {
    const monday = new Date(2026, 0, 5, 0).getTime() / 1000
    const entry = (start: number, seconds: number): TimeEntry => ({
      id: 1, activity_id: 1, started_at: start, duration_seconds: seconds, source: 'manual',
    })
    expect(weeklySeconds([
      entry(monday - 3600, 7200), // One hour on either side of the week boundary.
      entry(monday - 7200, 600), // Entirely before this week.
      entry(monday + 3600, 1800),
    ], new Date(2026, 0, 5, 12))).toBe(5400)
  })
})
