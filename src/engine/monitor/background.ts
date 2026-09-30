import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { postLocalAlert, requestAlertPermission } from '../../../modules/local-alerts'

import { fetchNews } from '../news/feed'
import { isGeneralAudienceNews } from '../news/safety'
import { initializeLocationProfile } from '../location'
import { initializeBackgroundPrivacy } from '../privacy'
import { loadMonitors, monitorMatches } from './store'

export const MONITOR_TASK = 'tru-monitor-refresh-v1'
const SEEN_KEY = 'tru.monitor.seen.v1'

async function runMonitorRefresh(): Promise<number> {
  const monitors = (await loadMonitors()).filter((monitor) => monitor.enabled)
  if (!monitors.length) return 0
  await Promise.all([initializeLocationProfile(), initializeBackgroundPrivacy()])
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store')
  const raw = await SecureStore.getItemAsync(SEEN_KEY); const seen = new Set<string>(raw ? JSON.parse(raw) as string[] : [])
  const items = (await fetchNews('all', null, true)).filter(isGeneralAudienceNews)
  const matches = items.filter((item) => !seen.has(item.id) && monitorMatches(item.title, monitors).length)
  for (const item of matches.slice(0, 3)) {
    const matched = monitorMatches(item.title, monitors)[0]
    await postLocalAlert(`Tru · ${matched.query}`, item.title, item.mobileUrl ?? item.url)
  }
  const next = [...new Set([...items.slice(0, 100).map((item) => item.id), ...seen])].slice(0, 500)
  await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(next))
  return matches.length
}

if (!TaskManager.isTaskDefined(MONITOR_TASK)) {
  TaskManager.defineTask(MONITOR_TASK, async () => {
    try { return (await runMonitorRefresh()) ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData }
    catch { return BackgroundFetch.BackgroundFetchResult.Failed }
  })
}

export async function enableMonitorBackground(): Promise<{ enabled: boolean; detail: string }> {
  if (!await requestAlertPermission()) return { enabled: false, detail: 'Local notification permission was not granted.' }
  const registered = await TaskManager.isTaskRegisteredAsync(MONITOR_TASK)
  if (!registered) await BackgroundFetch.registerTaskAsync(MONITOR_TASK, { minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true })
  return { enabled: true, detail: 'Background checks are registered. Android controls the exact delivery interval.' }
}

export async function monitorBackgroundEnabled(): Promise<boolean> { return TaskManager.isTaskRegisteredAsync(MONITOR_TASK) }
export async function disableMonitorBackground(): Promise<void> { if (await TaskManager.isTaskRegisteredAsync(MONITOR_TASK)) await BackgroundFetch.unregisterTaskAsync(MONITOR_TASK) }
export async function checkMonitorsNow(): Promise<number> { return runMonitorRefresh() }
