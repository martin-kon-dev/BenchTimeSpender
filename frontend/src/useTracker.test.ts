import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { useTracker, type Tracker } from './useTracker'
import { server } from './test-server'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length=0; vi.useRealTimers(); vi.unstubAllGlobals() })
async function setup() {
  let tracker!: Tracker
  const w = mount(defineComponent({ setup() { tracker = useTracker(); return () => null } })); wrappers.push(w); await flushPromises(); return tracker
}
it('restores elapsed time from timestamps even when the clock jumps past background ticks', async () => {
  vi.useFakeTimers({ toFake:['Date','setInterval','clearInterval'] }); vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))
  server({running:true}); const tracker = await setup(); const start = tracker.state.timer!.started_at
  vi.setSystemTime(new Date('2026-10-09T12:10:00Z')); vi.advanceTimersByTime(1000)
  expect(Math.floor(tracker.state.now/1000)-start).toBe(721)
  document.dispatchEvent(new Event('visibilitychange')); await flushPromises()
  expect(tracker.state.timer!.started_at).toBe(start)
})
it('blocks a second stop while a request is in flight and reconciles saved entries', async () => {
  const { fetch } = server({running:true}); const tracker = await setup()
  const first = tracker.stop(); const second = tracker.stop(); await Promise.all([first,second])
  expect(fetch.mock.calls.filter(([url])=>url.endsWith('/stop'))).toHaveLength(1)
  expect(tracker.state.timer).toBeNull(); expect(tracker.state.entries).toHaveLength(2)
})
