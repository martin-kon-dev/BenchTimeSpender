import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

afterEach(() => vi.unstubAllGlobals())

function stubHealthRequest(healthFetch: (url: string) => unknown) {
  vi.stubGlobal('fetch', (url: string) => url === '/api/activities'
    ? Promise.resolve(new Response('[]'))
    : healthFetch(url))
}

describe('backend connection', () => {
  it('shows loading and then the API response', async () => {
    let complete!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { complete = resolve }))
    stubHealthRequest(fetchMock)
    const wrapper = mount(App)

    await wrapper.get('[data-testid=backend-check]').trigger('click')
    expect(fetchMock).toHaveBeenCalledWith('/api/health')
    expect(wrapper.get('[data-testid=backend-check]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Checking…')

    complete(new Response(JSON.stringify({ status: 'ok', message: 'BenchTimeSpender API is ready.' })))
    await flushPromises()
    expect(wrapper.text()).toContain('Backend status: ok')
    expect(wrapper.text()).toContain('BenchTimeSpender API is ready.')
    expect(wrapper.get('[data-testid=backend-check]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows an HTTP error and allows retrying', async () => {
    stubHealthRequest(vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', message: 'BenchTimeSpender API is ready.' }))))
    const wrapper = mount(App)

    await wrapper.get('[data-testid=backend-check]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('HTTP 503')

    await wrapper.get('[data-testid=backend-check]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Backend status: ok')
    wrapper.unmount()
  })

  it('shows a network error', async () => {
    stubHealthRequest(vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const wrapper = mount(App)

    await wrapper.get('[data-testid=backend-check]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Failed to fetch')
    expect(wrapper.get('[data-testid=backend-check]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
