import { Linking } from 'react-native'
import { router } from 'expo-router'

const WEB_SCHEME = /^https?:\/\//i

/** Keep articles inside Tru; hand non-web schemes back to Android/iOS. */
export function openLink(url: string | null | undefined, title?: string): void {
  const target = (url ?? '').trim()
  if (!target) return
  if (!WEB_SCHEME.test(target)) {
    void Linking.openURL(target).catch(() => {})
    return
  }
  router.push({ pathname: '/browser', params: { url: target, ...(title ? { title } : {}) } })
}
