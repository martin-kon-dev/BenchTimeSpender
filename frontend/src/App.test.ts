import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { server } from './test-server'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; vi.useRealTimers(); vi.unstubAllGlobals() })
async function render() { const w = mount(App); wrappers.push(w); await flushPromises(); return w }
describe('redesigned dashboard', () => {
  it('shows scoped totals instead of history and keeps global counts while filtering', async () => {
    server(); const w = await render()
    expect(w.find('dialog').exists()).toBe(false)
    expect(w.find('.recent-entries').exists()).toBe(false)
    expect(w.findAll('.metrics dd').map(e => e.text())).toEqual(['1h', '1', '1'])
    expect(w.findAll('.card-totals dt').slice(0,3).map(e => e.text())).toEqual(['Today', 'This week', 'Overall'])
    await w.get('input[type="search"]').setValue('  FASTapi ')
    expect(w.findAll('.activity-card').filter(c => c.isVisible())).toHaveLength(1)
    await w.get('select[aria-label="Filter by category"]').setValue('uncategorized')
    expect(w.text()).toContain('No matching activities')
    expect(w.findAll('.metrics dd').map(e => e.text())).toEqual(['1h', '1', '1'])
  })
  it('retains manual drafts through collapse, filters and status changes', async () => {
    server(); const w = await render()
    await w.get('.disclosure').trigger('click')
    await w.get('.manual-form input[placeholder]').setValue('Keep this draft')
    await w.get('.disclosure').trigger('click')
    await w.get('input[type="search"]').setValue('missing')
    await w.get('.view-tabs button:nth-child(2)').trigger('click')
    await w.get('input[type="search"]').setValue('')
    await w.get('.view-tabs button:first-child').trigger('click')
    await w.get('.disclosure').trigger('click')
    expect((w.get('.manual-form input[placeholder]').element as HTMLInputElement).value).toBe('Keep this draft')
  })
  it('keeps a restored timer reachable when filtered out and does not stop it', async () => {
    const { fetch } = server({ running: true }); const w = await render()
    await w.get('input[type="search"]').setValue('missing')
    expect(w.get('.running-banner').text()).toContain('Learn Python')
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    await w.get('.running-banner button').trigger('click')
    expect(w.get('.disclosure').attributes('aria-expanded')).toBe('true')
    expect(w.get('.activity-card .delete-button').attributes('disabled')).toBeDefined()
  })
  it('confirms deletion and preserves data on a concurrent timer conflict', async () => {
    const { fetch } = server({ failDelete: true }); const w = await render()
    await w.get('.disclosure').trigger('click'); await w.get('.activity-card .delete-button').trigger('click')
    expect(w.get('dialog').text()).toContain('all its recorded time')
    await w.get('[data-testid="confirm-delete"]').trigger('click'); await flushPromises()
    expect(w.get('dialog [role="alert"]').text()).toContain('Stop and save')
    expect(w.findAll('.activity-card')).toHaveLength(2)
    expect(fetch.mock.calls.filter(([, i]) => i?.method === 'DELETE')).toHaveLength(1)
  })
  it('deletes only after confirmation and updates saved totals and counts', async () => {
    server(); const w = await render(); await w.get('.disclosure').trigger('click'); await w.get('.activity-card .delete-button').trigger('click')
    await w.get('[data-testid="confirm-delete"]').trigger('click'); await flushPromises()
    expect(w.findAll('.metrics dd').map(e => e.text())).toEqual(['0 min','0','1'])
    expect(w.find('dialog').exists()).toBe(false)
  })
  it('validates manual entries and saves a note without duplicate clicks', async () => {
    const { fetch } = server(); const w = await render(); await w.get('.disclosure').trigger('click')
    const form = w.get('.manual-form'); await form.findAll('input[type="number"]')[1]!.setValue(0)
    await form.trigger('submit'); expect(form.get('[role="alert"]').text()).toContain('1 minute')
    await form.findAll('input[type="number"]')[1]!.setValue(30)
    await form.get('input[type="datetime-local"]').setValue('2026-01-01T10:00')
    await form.get('input[placeholder]').setValue('Reviewed Python')
    await form.trigger('submit'); await form.trigger('submit'); await flushPromises()
    const writes = fetch.mock.calls.filter(([url, init]) => url === '/api/time-entries' && init?.method === 'POST')
    expect(writes).toHaveLength(1); expect(JSON.parse(writes[0]![1]!.body as string).note).toBe('Reviewed Python')
  })
})
