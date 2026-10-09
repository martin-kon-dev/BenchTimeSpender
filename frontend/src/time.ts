export type TimeEntry = {
  id: number
  activity_id: number
  started_at: number
  duration_seconds: number
  source: 'manual' | 'timer'
  note?: string
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}

export function formatSavedTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  if (total === 0) return '0 min'
  if (total < 60) return '<1 min'
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} min`
  const remainder = minutes % 60
  return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ''}`
}

export function weeklySeconds(entries: TimeEntry[], now = new Date()): number {
  return timeTotals(entries, null, now).week
}

export function timeTotals(entries: TimeEntry[], timer: { started_at: number } | null, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const start = monday.getTime() / 1000
  const end = now.getTime() / 1000
  const intervals = entries.map(entry => ({ start: entry.started_at, duration: entry.duration_seconds }))
  if (timer) intervals.push({ start: timer.started_at, duration: Math.max(0, end - timer.started_at) })
  const overlap = (boundary: number) => intervals.reduce((total, entry) => total + Math.max(0,
    Math.min(end, entry.start + entry.duration) - Math.max(boundary, entry.start)), 0)
  return { today: overlap(today.getTime() / 1000), week: overlap(start), overall: intervals.reduce((total, entry) => total + entry.duration, 0) }
}
