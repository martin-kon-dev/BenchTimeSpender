import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import TimeTracking from './TimeTracking.vue'

const activities = [{ id: 1, title: 'Learn Python' }]
const startSeconds = Math.floor(new Date('2026-01-05T12:00:00Z').getTime() / 1000)
const running = { id: 'timer-1', activity_id: 1, started_at: startSeconds }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date(startSeconds * 1000))
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

function mockServer(initialTimer: typeof running | null = null) {
  let timer = initialTimer
  const entries: object[] = []
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/timer') return new Response(JSON.stringify(timer))
    if (url === '/api/time-entries' && !options) return new Response(JSON.stringify(entries))
    if (url === '/api/timer/start') {
      timer = running
      return new Response(JSON.stringify(timer), { status: 201 })
    }
    if (url === '/api/timer/timer-1/stop') {
      timer = null
      const entry = { id: 1, activity_id: 1, started_at: startSeconds, duration_seconds: 65, source: 'timer' }
      entries.push(entry)
      return new Response(JSON.stringify(entry))
    }
    if (url === '/api/time-entries' && options?.method === 'POST') {
      const data = JSON.parse(options.body as string)
      const entry = { ...data, id: 2, started_at: new Date(data.started_at).getTime() / 1000, source: 'manual' }
      entries.push(entry)
      return new Response(JSON.stringify(entry), { status: 201 })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('time tracking', () => {
  it('selects the first activity created without requiring a refresh', async () => {
    mockServer()
    const addedActivities = reactive<{ id: number; title: string }[]>([])
    const wrapper = mount(TimeTracking, { props: { activities: addedActivities } })
    await flushPromises()
    expect(wrapper.get('[data-testid="timer-toggle"]').attributes('disabled')).toBeDefined()
    addedActivities.push(activities[0]!)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="timer-toggle"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('starts and stops a timer and publishes saved entries', async () => {
    const fetchMock = mockServer()
    const wrapper = mount(TimeTracking, { props: { activities } })
    await flushPromises()
    await wrapper.get('[data-testid="timer-toggle"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/timer/start', expect.objectContaining({ body: '{"activity_id":1}' }))
    expect(wrapper.text()).toContain('Currently tracking')
    vi.setSystemTime(new Date((startSeconds + 65) * 1000))
    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.timer').text()).toBe('00:01:06')
    await wrapper.get('[data-testid="timer-toggle"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Timer stopped. Time saved.')
    expect(wrapper.text()).toContain('00:01:05')
    expect(wrapper.emitted('entriesChanged')?.at(-1)?.[0]).toEqual([expect.objectContaining({ duration_seconds: 65 })])
    wrapper.unmount()
  })

  it('restores a running timer after refresh', async () => {
    mockServer(running)
    vi.setSystemTime(new Date((startSeconds + 120) * 1000))
    const wrapper = mount(TimeTracking, { props: { activities } })
    await flushPromises()
    expect(wrapper.get('.timer').text()).toBe('00:02:00')
    expect(wrapper.get('[data-testid="timer-toggle"]').text()).toBe('Stop & save')
    expect(wrapper.get('select').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('saves manual time in UTC and displays the entry', async () => {
    const fetchMock = mockServer()
    const wrapper = mount(TimeTracking, { props: { activities } })
    await flushPromises()
    await wrapper.get('.manual-button').trigger('click')
    await wrapper.get('input[name="started_at"]').setValue('2026-01-04T10:00')
    await wrapper.get('input[name="hours"]').setValue(1)
    await wrapper.get('input[name="minutes"]').setValue(15)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/time-entries', expect.objectContaining({
      body: JSON.stringify({ activity_id: 1, started_at: new Date('2026-01-04T10:00').toISOString(), duration_seconds: 4500 }),
    }))
    expect(wrapper.text()).toContain('Manual entry saved.')
    expect(wrapper.text()).toContain('01:15:00')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('rejects a future manual entry before sending it', async () => {
    const fetchMock = mockServer()
    const wrapper = mount(TimeTracking, { props: { activities } })
    await flushPromises()
    await wrapper.get('.manual-button').trigger('click')
    await wrapper.get('input[name="started_at"]').setValue('2099-01-01T10:00')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('finish in the past')
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('blocks actions until a failed initial load is retried', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
    const wrapper = mount(TimeTracking, { props: { activities } })
    await flushPromises()
    expect(wrapper.get('[data-testid="timer-toggle"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Offline')
    mockServer()
    await wrapper.get('.tracking-error button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="timer-toggle"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
