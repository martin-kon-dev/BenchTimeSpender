import { onMounted, onUnmounted, reactive } from 'vue'
import { json, request, type Timer } from './api'
import type { TimeEntry } from './time'

export function useTracker() {
  const state = reactive({ entries: [] as TimeEntry[], timer: null as Timer | null, now: Date.now(), ready: false, busy: false, error: '', notice: '' })
  async function refresh() {
    state.ready = false
    const [timer, entries] = await Promise.all([request<Timer | null>('/api/timer'), request<TimeEntry[]>('/api/time-entries')])
    // Replace both together: saved time and running time must never be double-counted.
    state.timer = timer; state.entries = entries; state.now = Date.now(); state.ready = true
  }
  async function reload() {
    if (state.busy) return
    state.busy = true; state.error = ''
    try { await refresh() } catch (error) { state.error = (error as Error).message }
    finally { state.busy = false }
  }
  async function perform(action: () => Promise<unknown>, success: string) {
    if (state.busy || !state.ready) return false
    state.busy = true; state.error = ''; state.notice = ''
    let saved = false
    try { await action(); saved = true; state.notice = success }
    catch (error) { state.error = (error as Error).message }
    finally {
      try { await refresh() } catch { state.error = 'Could not confirm tracking state. Reload tracking before continuing.' }
      state.busy = false
    }
    return saved
  }
  async function start(activityId: number) {
    if (state.timer) return false
    return perform(() => request('/api/timer/start', json('POST', { activity_id: activityId })), 'Timer started.')
  }
  async function stop() {
    const id = state.timer?.id
    if (!id) return false
    return perform(() => request(`/api/timer/${id}/stop`, { method: 'POST' }), 'Time saved.')
  }
  async function manual(body: { activity_id: number; started_at: string; duration_seconds: number; note: string }) {
    return perform(() => request('/api/time-entries', json('POST', body)), 'Manual entry saved.')
  }
  let interval: ReturnType<typeof setInterval>
  const visible = () => { state.now = Date.now(); if (!document.hidden) void reload() }
  onMounted(() => { void reload(); interval = setInterval(() => { state.now = Date.now() }, 1000); document.addEventListener('visibilitychange', visible) })
  onUnmounted(() => { clearInterval(interval); document.removeEventListener('visibilitychange', visible) })
  return { state, reload, start, stop, manual }
}
export type Tracker = ReturnType<typeof useTracker>
