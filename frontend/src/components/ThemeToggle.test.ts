import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  localStorage.clear()
  document.documentElement.style.colorScheme = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function render(dark = false) {
  const media = new EventTarget()
  vi.stubGlobal('matchMedia', () => Object.assign(media, { matches: dark }))
  const wrapper = mount(ThemeToggle)
  wrappers.push(wrapper)
  return { wrapper, media }
}

describe('theme selection', () => {
  it('follows system changes until the user chooses, then remembers the override across remounts', async () => {
    const { wrapper, media } = render(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true')
    media.dispatchEvent(Object.assign(new Event('change'), { matches: false }))
    await wrapper.vm.$nextTick()
    expect(document.documentElement.style.colorScheme).toBe('light')
    await wrapper.get('button').trigger('click')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('benchtime-theme')).toBe('dark')
    media.dispatchEvent(Object.assign(new Event('change'), { matches: false }))
    await wrapper.vm.$nextTick()
    expect(document.documentElement.style.colorScheme).toBe('dark')
    wrapper.unmount()
    const restored = render(false).wrapper
    expect(restored.text()).toBe('Dark')
    await restored.get('button').trigger('click')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('benchtime-theme')).toBe('light')
  })

  it('ignores an invalid saved value', () => {
    localStorage.setItem('benchtime-theme', 'invalid')
    expect(render(false).wrapper.text()).toBe('Light')
  })

  it('switches themes even if storage access is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('Blocked') })
    const { wrapper } = render(true)
    await wrapper.get('button').trigger('click')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
