import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

const activity = { id: 1, title: 'Python', category: 'Learning', description: '', completion_percentage: 50 }
const entry = { id: 1, activity_id: 1, started_at: Math.floor(Date.now() / 1000) - 4000, duration_seconds: 3600, source: 'manual' }
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers.length = 0; vi.unstubAllGlobals() })

function mockServer(deleteStatus = 204, running = false) {
  let deleted = false
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/activities') return new Response(JSON.stringify(deleted ? [] : [activity]))
    if (url === '/api/timer') return new Response(JSON.stringify(running ? { id: 'timer-1', activity_id: 1, started_at: entry.started_at } : null))
    if (url === '/api/time-entries') return new Response(JSON.stringify(deleted ? [] : [entry]))
    if (url === '/api/activities/1' && options?.method === 'DELETE') {
      if (deleteStatus === 204) { deleted = true; return new Response(null, { status: 204 }) }
      return new Response(JSON.stringify({ detail: 'Stop and save the timer before deleting this activity.' }), { status: deleteStatus })
    }
    throw Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function render() {
  const wrapper = mount(App)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('focus dashboard', () => {
  it('keeps forms and recent entries closed initially', async () => {
    mockServer()
    const wrapper = await render()
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect((wrapper.get('.recent-entries').element as HTMLDetailsElement).open).toBe(false)
    expect(wrapper.find('[data-testid="backend-check"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="timer-toggle"]').text()).toBe('Start timer')
  })

  it('cancels without deleting, then removes the activity, time, counts, and picker options', async () => {
    const fetchMock = mockServer()
    const wrapper = await render()
    await wrapper.get('.activity-card .delete-button').trigger('click')
    expect(wrapper.get('dialog').text()).toContain('all its recorded time')
    await wrapper.get('dialog .connection-button').trigger('click')
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
    expect(wrapper.find('.activity-card').exists()).toBe(true)
    await wrapper.get('.activity-card .delete-button').trigger('click')
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/activities/1', { method: 'DELETE' })
    expect(wrapper.find('.activity-card').exists()).toBe(false)
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('.recent-entries').exists()).toBe(false)
    expect(wrapper.findAll('.metrics dd').map(item => item.text())).toEqual(['0.0h', '0', '0'])
    expect(wrapper.get('[data-testid="timer-toggle"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').text()).toContain('Create an activity first')
  })

  it('preserves data and shows the API error when another tab starts a timer', async () => {
    mockServer(409)
    const wrapper = await render()
    await wrapper.get('.activity-card .delete-button').trigger('click')
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.activity-card').exists()).toBe(true)
    expect(wrapper.get('dialog [role="alert"]').text()).toContain('Stop and save')
    expect(wrapper.get('[data-testid="confirm-delete"]').attributes('disabled')).toBeUndefined()
  })

  it('disables delete for the activity with a restored timer', async () => {
    mockServer(204, true)
    const wrapper = await render()
    expect(wrapper.get('.activity-card .delete-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="timer-toggle"]').text()).toBe('Stop & save')
  })
})
