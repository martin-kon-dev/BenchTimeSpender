import { vi } from 'vitest'
import type { Activity, Category, Timer } from './api'
import type { TimeEntry } from './time'
export const activity: Activity = { id: 1, title: 'Learn Python', category: 'Learning', category_id: 1, description: 'Practice FastAPI', completion_percentage: 50 }
export function server(options: { empty?: boolean; running?: boolean; failSave?: boolean; failDelete?: boolean; failLoad?: boolean } = {}) {
  let activities: Activity[] = options.empty ? [] : [{ ...activity }, { ...activity, id: 2, title: 'Portfolio', description: 'Vue practice', category_id: null, category: 'Uncategorized', completion_percentage: 100 }]
  let timer: Timer | null = options.running ? { id: 'timer-1', activity_id: 1, started_at: Math.floor(Date.now() / 1000) - 120 } : null
  let entries: TimeEntry[] = options.empty ? [] : [{ id: 1, activity_id: 1, started_at: Math.floor(Date.now() / 1000) - 4000, duration_seconds: 3600, source: 'manual', note: 'Original note' }]
  const categories: Category[] = [{ id: 1, name: 'Learning', color: '#f97316', version: 1, activity_count: 1 }]
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const data = init?.body ? JSON.parse(init.body as string) : null
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url === '/api/activities' && init?.method === 'POST') {
      if (options.failSave) return response({ detail: 'Please retry saving.' }, 503)
      const created = { ...data, id: 3, category: data.category_id ? 'Learning' : 'Uncategorized' }; activities.push(created); return response(created, 201)
    }
    if (url === '/api/activities') { if (options.failLoad) return response({ detail: 'Load failed.' }, 503); return response(activities) }
    if (url === '/api/categories') return response(categories)
    if (url === '/api/timer') return response(timer)
    if (url === '/api/time-entries' && init?.method === 'POST') { const entry = { ...data, id: entries.length + 1, started_at: Date.parse(data.started_at) / 1000, source: 'manual' }; entries.push(entry); return response(entry, 201) }
    if (url === '/api/time-entries') return response(entries)
    if (url === '/api/timer/start') { timer = { id: 'timer-2', activity_id: data.activity_id, started_at: Math.floor(Date.now() / 1000) }; return response(timer, 201) }
    if (url.endsWith('/stop')) { if (timer) entries.push({ id: 3, activity_id: timer.activity_id, started_at: timer.started_at, duration_seconds: Math.max(1, Math.floor(Date.now() / 1000) - timer.started_at), source: 'timer' }); timer = null; return response(entries.at(-1)) }
    if (url.startsWith('/api/activities/') && init?.method === 'PATCH') { const a = activities.find(a => a.id === Number(url.split('/').at(-1)))!; Object.assign(a, data); return response(a) }
    if (url.startsWith('/api/activities/') && init?.method === 'DELETE') {
      if (options.failDelete) return response({ detail: 'Stop and save the timer before deleting this activity.' }, 409)
      const id = Number(url.split('/').at(-1)); activities = activities.filter(a => a.id !== id); entries = entries.filter(e => e.activity_id !== id); return new Response(null, { status: 204 })
    }
    throw Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, options }
}
