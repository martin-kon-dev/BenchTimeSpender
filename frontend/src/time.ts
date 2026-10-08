export type TimeEntry = {
  id: number
  activity_id: number
  started_at: number
  duration_seconds: number
  source: 'manual' | 'timer'
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}

export function weeklySeconds(entries: TimeEntry[], now = new Date()): number {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const start = monday.getTime() / 1000
  const end = now.getTime() / 1000
  return entries.reduce((total, entry) => total + Math.max(0,
    Math.min(end, entry.started_at + entry.duration_seconds) - Math.max(start, entry.started_at)), 0)
}
