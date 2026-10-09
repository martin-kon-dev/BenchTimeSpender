import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App.vue'
import { server } from './test-server'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; vi.unstubAllGlobals() })
async function render() { const w = mount(App); wrappers.push(w); await flushPromises(); return w }
it('creates an activity and displays the saved response', async () => {
  server({ empty: true }); const w = await render(); expect(w.text()).toContain('Your next focus starts here')
  await w.get('.page-heading button').trigger('click'); await w.get('dialog input').setValue('Learn Python'); await w.get('dialog form').trigger('submit'); await flushPromises()
  expect(w.get('.activity-copy').text()).toContain('Learn Python'); expect(w.find('dialog').exists()).toBe(false)
})
it('keeps form values after a failed save and warns before discarding them', async () => {
  server({ failSave: true }); const w = await render(); await w.get('.page-heading button').trigger('click'); await w.get('dialog input').setValue('Unsaved title'); await w.get('dialog form').trigger('submit'); await flushPromises()
  expect(w.get('dialog [role="alert"]').text()).toContain('Please retry')
  expect((w.get('dialog input').element as HTMLInputElement).value).toBe('Unsaved title')
  await w.get('dialog').trigger('cancel'); expect(w.get('.discard-warning').text()).toContain('Discard your unsaved changes?')
  await w.get('.discard-warning button').trigger('click'); expect((w.get('dialog input').element as HTMLInputElement).value).toBe('Unsaved title')
})
it('retries a failed load without claiming the database is empty', async () => {
  const mock = server({ failLoad: true }); const w = await render(); expect(w.text()).toContain('Load failed'); expect(w.text()).not.toContain('Your next focus starts here')
  mock.options.failLoad = false; await w.get('.empty-state button').trigger('click'); await flushPromises(); expect(w.get('.activity-copy').text()).toContain('Learn Python')
})
it('completes and reopens an activity through the status views', async () => {
  server(); const w = await render(); await w.get('.disclosure').trigger('click'); await w.findAll('.card-actions button')[1]!.trigger('click'); await flushPromises()
  expect(w.findAll('.metrics dd')[1]!.text()).toBe('0'); await w.get('.view-tabs button:nth-child(2)').trigger('click')
  expect(w.findAll('.activity-card').filter(c => c.isVisible())).toHaveLength(2)
  await w.findAll('.card-actions button')[1]!.trigger('click'); await flushPromises(); expect(w.findAll('.metrics dd')[1]!.text()).toBe('1')
})
