import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

afterEach(() => vi.unstubAllGlobals())

const activity = {
  id: 1, title: 'Learn Python', category: 'Learning', description: 'Practice FastAPI',
  completion_percentage: 65,
}

describe('saved activities', () => {
  it('loads saved activities and calculates activity counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      activity, { ...activity, id: 2, title: 'Portfolio', completion_percentage: 100 },
    ]))))
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Loading activities…')
    await flushPromises()
    expect(wrapper.text()).toContain('Learn Python')
    expect(wrapper.text()).toContain('Practice FastAPI')
    expect(wrapper.findAll('[role="progressbar"]')[0]?.attributes('aria-valuenow')).toBe('65')
    expect(wrapper.findAll('.metrics dd').map(item => item.text())).toEqual(['—', '1', '1'])
    wrapper.unmount()
  })

  it('creates an activity and displays the saved response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response(JSON.stringify(activity), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('No activities yet')
    await wrapper.findAll('button').find(button => button.text() === 'New activity')!.trigger('click')
    await wrapper.get('input[name="title"]').setValue('Learn Python')
    await wrapper.get('textarea[name="description"]').setValue('Practice FastAPI')
    await wrapper.get('input[name="completion"]').setValue(65)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Learn Python', category: 'Learning', description: 'Practice FastAPI', completion_percentage: 65 }),
    })
    expect(wrapper.text()).toContain('Learn Python')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('preserves form values after a save failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response('', { status: 503 })))
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'New activity')!.trigger('click')
    await wrapper.get('input[name="title"]').setValue('Learn Python')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('HTTP 503')
    expect((wrapper.get('input[name="title"]').element as HTMLInputElement).value).toBe('Learn Python')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('retries a failed load instead of showing an empty database', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify([activity]))))
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Failed to fetch')
    expect(wrapper.text()).not.toContain('No activities yet')
    await wrapper.findAll('button').find(button => button.text() === 'Retry loading')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Learn Python')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
