import { expect, test } from 'bun:test'
import { failNextStorageWrite } from './storage'
import { addMonitor, loadMonitors, monitorMatches, removeMonitor, toggleMonitor } from '../src/engine/monitor/store'

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

test('saved topic monitors match whole words and respect all terms and disabled rules', async () => {
  const saved = await addMonitor('AI research')
  const monitor = saved.find((item) => item.query === 'AI research')!
  try {
    expect(monitorMatches('New AI-powered research tools', [monitor])).toEqual([monitor])
    expect(monitorMatches('Chair research reaches Hawaii', [monitor])).toEqual([])
    expect(monitorMatches('New AI tools', [monitor])).toEqual([])
    const disabled = (await toggleMonitor(monitor.id)).find((item) => item.id === monitor.id)!
    expect(monitorMatches('AI research', [disabled])).toEqual([])
    expect(monitorMatches('CAFÉ opens downtown', [{ ...monitor, query: 'café' }])).toHaveLength(1)
    expect(monitorMatches('New C++ research', [{ ...monitor, query: 'C++' }])).toHaveLength(1)
    expect(monitorMatches('Any headline', [{ ...monitor, query: '  ' }])).toEqual([])
  } finally { await removeMonitor(monitor.id) }
})
