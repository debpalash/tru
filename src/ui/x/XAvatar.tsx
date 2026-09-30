import { memo, useEffect, useState, type JSX } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import { privacyMediaUrl, usePrivacySnapshot } from '@/engine/privacy'
import { useXMediaMode } from '@/engine/x/mediaPreference'
import { isTrustedXMediaUrl, verifyXMedia, xMediaPreviewUrl } from '@/engine/x/mediaSafety'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

type Props = {
  url?: string
  name: string
  size?: number
  safeCheck?: boolean
}

function useAllowedUrl(url: string | undefined, safeCheck: boolean): boolean {
  const mode = useXMediaMode()
  const [allowedUrl, setAllowedUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const trusted = Boolean(url && isTrustedXMediaUrl(url))
    setAllowedUrl(null)
    if (mode === 'safe' && url && isTrustedXMediaUrl(url)) {
      void verifyXMedia([{ kind: 'photo', previewUrl: url }]).then((verdict) => { if (live) setAllowedUrl(verdict === 'safe' ? url : null) })
    }
    return () => { live = false }
  }, [mode, safeCheck, url])
  return Boolean(url && allowedUrl === url)
}

export const XAvatar = memo(function XAvatar({ url, name, size = 34, safeCheck = false }: Props): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  usePrivacySnapshot()
  const mode = useXMediaMode()
  const allowed = useAllowedUrl(url, safeCheck)
  const privateUrl = url ? privacyMediaUrl(xMediaPreviewUrl(url)) : null
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [url])

  return <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}> 
    <Text style={[styles.initial, { fontSize: Math.max(9, size * 0.31) }]}>{(name.trim()[0] || '?').toUpperCase()}</Text>
    {mode !== 'hidden' && allowed && privateUrl && !failed ? <Image source={privateUrl} style={[styles.image, { borderRadius: size / 2 }]} contentFit="cover" cachePolicy="memory-disk" recyclingKey={url} transition={100} onError={() => setFailed(true)} /> : null}
  </View>
})

export const XBanner = memo(function XBanner({ url, name }: { url?: string; name: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  usePrivacySnapshot()
  const mode = useXMediaMode()
  const allowed = useAllowedUrl(url, true)
  const privateUrl = url ? privacyMediaUrl(xMediaPreviewUrl(url)) : null
  return <View style={styles.banner}>{mode !== 'hidden' && allowed && privateUrl ? <Image source={privateUrl} style={styles.image} contentFit="cover" cachePolicy="memory-disk" recyclingKey={url} transition={100} /> : <View style={styles.bannerFallback}><Text style={styles.bannerText}>{name.slice(0, 2).toUpperCase()}</Text></View>}</View>
})

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  image: { position: 'absolute', width: '100%', height: '100%' },
  initial: { color: t.textMuted, fontWeight: '600' },
  banner: { height: 68, overflow: 'hidden', backgroundColor: t.surfaceAlt },
  bannerFallback: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 16, backgroundColor: t.surfaceAlt },
  bannerText: { color: t.border, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
})
