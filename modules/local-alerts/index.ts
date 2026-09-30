interface TruAlertsNative {
  requestPermission(): Promise<boolean>
  postAlert(title: string, body: string, url: string): Promise<boolean>
}

function getNative(): TruAlertsNative | null {
  try {
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core')
    return requireNativeModule('TruAlerts') as TruAlertsNative
  } catch { return null }
}

export async function requestAlertPermission(): Promise<boolean> {
  return await getNative()?.requestPermission() ?? false
}

export async function postLocalAlert(title: string, body: string, url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false
  } catch { return false }
  return await getNative()?.postAlert(title, body, url) ?? false
}
