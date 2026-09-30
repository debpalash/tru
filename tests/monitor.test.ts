import { expect, test } from 'bun:test'
import { failNextStorageWrite } from './storage'
import { addMonitor, loadMonitors, removeMonitor, toggleMonitor } from '../src/engine/monitor/store'

test('failed monitor writes preserve the last saved state and can be retried', async () => {
  const before = await loadMonitors()
  failNextStorageWrite('tru.monitors.v1')
  await expect(addMonitor('Storage rollback fixture')).rejects.toThrow('Storage unavailable')
  expect(await loadMonitors()).toEqual(before)

  const saved = await addMonitor('Storage rollback fixture')
  const monitor = saved.find((item) => item.query === 'Storage rollback fixture')!
  expect(monitor.enabled).toBe(true)
  failNextStorageWrite('tru.monitors.v1')
  await expect(toggleMonitor(monitor.id)).rejects.toThrow('Storage unavailable')
  expect((await loadMonitors()).find((item) => item.id === monitor.id)?.enabled).toBe(true)
  await removeMonitor(monitor.id)
})
