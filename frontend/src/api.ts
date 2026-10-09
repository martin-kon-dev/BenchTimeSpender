export type Activity = { id: number; title: string; category: string; category_id: number | null; description: string; completion_percentage: number }
export type Category = { id: number; name: string; color: string; version: number; activity_count: number }
export type Timer = { id: string; activity_id: number; started_at: number }

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (HTTP ${response.status}). Check the fields and retry.`)
  }
  return response.status === 204 ? undefined as T : response.json()
}
export function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
export function matchesActivity(activity: Activity, search: string, category: string, completed: boolean) {
  const query = search.trim().toLocaleLowerCase()
  return (activity.completion_percentage === 100) === completed
    && (category === 'all' || (category === 'uncategorized' ? activity.category_id == null : activity.category_id === Number(category)))
    && (!query || `${activity.title}\n${activity.description}`.toLocaleLowerCase().includes(query))
}
