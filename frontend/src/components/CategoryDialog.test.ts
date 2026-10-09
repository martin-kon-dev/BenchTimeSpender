import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import CategoryDialog from './CategoryDialog.vue'
const categories = [{ id: 1, name: 'Work', color: '#8b5cf6', version: 1, activity_count: 3 }, { id: 2, name: 'Learning', color: '#f97316', version: 2, activity_count: 1 }]
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; vi.unstubAllGlobals() })
function render() { const w = mount(CategoryDialog, { props: { categories } }); wrappers.push(w); return w }
it('requires explicit reassignment and sends the reviewed version and count', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch)
  const w = render(); await w.get('[aria-label="Delete category: Work"]').trigger('click')
  expect(w.get('.delete-confirmation').text()).toContain('3 activities'); expect(w.get('.delete-confirmation .delete-button').attributes('disabled')).toBeDefined()
  await w.get('.delete-confirmation select').setValue('uncategorized'); await w.get('.delete-confirmation .delete-button').trigger('click'); await flushPromises()
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ reassign_to: null, expected_version: 1, expected_activity_count: 3 }); expect(w.emitted('changed')).toHaveLength(1)
})
it('keeps the delete confirmation and data when the server rejects stale counts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Activity count changed. Reload.' }), { status: 409 })))
  const w = render(); await w.get('[aria-label="Delete category: Work"]').trigger('click'); await w.get('.delete-confirmation select').setValue('2'); await w.get('.delete-confirmation .delete-button').trigger('click'); await flushPromises()
  expect(w.text()).toContain('Activity count changed'); expect(w.find('.delete-confirmation').exists()).toBe(true); expect(w.emitted('changed')).toBeUndefined()
})
it('rejects duplicate names and warns before switching away from a dirty editor', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const w = render()
  await w.get('.category-form input').setValue(' work '); await w.get('.category-form').trigger('submit')
  expect(w.text()).toContain('already exists'); expect(fetch).not.toHaveBeenCalled()
  await w.get('[aria-label="Edit category: Learning"]').trigger('click'); expect(w.get('.discard-warning').text()).toContain('Discard')
  await w.get('.discard-warning button').trigger('click'); expect((w.get('.category-form input').element as HTMLInputElement).value).toBe(' work ')
  await w.get('dialog').trigger('cancel'); expect(w.text()).toContain('Discard your unsaved changes?')
})
