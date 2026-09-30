import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import Ionicons from '@expo/vector-icons/Ionicons'

import { claimTorWebViewProxy, releaseWebViewProxy, usePrivacySnapshot } from '@/engine/privacy'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

const WEB_URL = /^https?:\/\//i
type BrowserRoute = 'direct' | 'connecting' | 'tor' | 'blocked'

export default function BrowserScreen(): JSX.Element {
  const params = useLocalSearchParams<{ url?: string; title?: string }>()
  const initialUrl = Array.isArray(params.url) ? params.url[0] : params.url
  const initialTitle = Array.isArray(params.title) ? params.title[0] : params.title
  const safeUrl = WEB_URL.test(initialUrl ?? '') ? initialUrl! : ''
  const privacy = usePrivacySnapshot()
  const theme = useTheme()
  const styles = useThemedStyles(makeStyles)
  const webRef = useRef<WebView>(null)
  const [currentUrl, setCurrentUrl] = useState(safeUrl)
  const [pageTitle, setPageTitle] = useState(initialTitle ?? '')
  const [loading, setLoading] = useState(true)
  const [routeState, setRouteState] = useState<BrowserRoute>(() => privacy.torEnabled ? 'connecting' : privacy.relayEnabled ? 'blocked' : 'direct')

  const host = useMemo(() => {
    try {
      return new URL(currentUrl || safeUrl).hostname.replace(/^www\./, '')
    } catch {
      return 'Article'
    }
  }, [currentUrl, safeUrl])
  const isX = host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')
  useEffect(() => {
    const owner = {}
    let live = true
    const configure = async () => {
      if (!privacy.torEnabled) {
        setRouteState(privacy.relayEnabled ? 'blocked' : 'direct')
        return
      }
      if (privacy.torStatus !== 'ON') {
        setRouteState(privacy.torStatus === 'STARTING' ? 'connecting' : 'blocked')
        return
      }
      setRouteState('connecting')
      const routed = await claimTorWebViewProxy(owner)
      if (!live) {
        if (routed) await releaseWebViewProxy(owner)
        return
      }
      setRouteState(routed ? 'tor' : 'blocked')
    }
    void configure()
    return () => {
      live = false
      void releaseWebViewProxy(owner)
    }
  }, [privacy.relayEnabled, privacy.torEnabled, privacy.torStatus])

  const onNavigation = (nav: WebViewNavigation) => {
    if (WEB_URL.test(nav.url)) {
      setCurrentUrl(nav.url)
    }
    if (!initialTitle && nav.title) setPageTitle(nav.title)
  }

  const routeReady = routeState === 'direct' || routeState === 'tor'
  if (!safeUrl || !routeReady) {
    const invalid = !safeUrl
    const connecting = !invalid && routeState === 'connecting'
    const relayOnly = !invalid && privacy.relayEnabled && !privacy.torEnabled
    const detail = invalid
      ? 'This article link is not valid.'
      : connecting
        ? 'Connecting this browser to embedded Tor. Direct loading stays blocked.'
        : relayOnly
          ? 'The relay protects feeds and media, but cannot cover every WebView subrequest. Turn on embedded Tor or Orbot VPN.'
          : 'Private WebView routing is unavailable. Tru blocked the page instead of loading it directly.'
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <View style={styles.alertCircle}>{connecting ? <ActivityIndicator size="small" color={styles.alertGlyph.color} /> : <Ionicons name={invalid ? 'alert-outline' : 'shield-checkmark-outline'} size={20} color={styles.alertGlyph.color} />}</View>
          <Text style={styles.emptyText}>{detail}</Text>
          <PressableScale style={styles.doneButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.doneText}>Go back</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={10} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close browser">
          <Text style={styles.backGlyph}>‹</Text>
        </PressableScale>
        <View style={styles.heading}>
          <Text style={styles.pageTitle} numberOfLines={1}>{pageTitle || host}</Text>
          <Text style={styles.host} numberOfLines={1}>{routeState === 'tor' ? `Tor · ${host}` : host}</Text>
        </View>
        {routeState === 'direct' ? <PressableScale
          onPress={() => void Linking.openURL(currentUrl || safeUrl).catch(() => {})}
          hitSlop={10}
          style={styles.iconButton}
          accessibilityRole="link"
          accessibilityLabel="Open in system browser"
        >
          <Text style={styles.openGlyph}>↗</Text>
        </PressableScale> : <View style={styles.iconButton} />}
      </View>
      <View style={styles.webWrap}>
        <WebView
          ref={webRef}
          source={{ uri: safeUrl }}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={({ nativeEvent }) => {
            // WebView can keep loading ads/images long after readable content is
            // painted. Stop obscuring the article once the main page is underway.
            if (nativeEvent.progress >= 0.25) setLoading(false)
          }}
          onNavigationStateChange={onNavigation}
          onShouldStartLoadWithRequest={(request) => {
            if (WEB_URL.test(request.url)) return true
            if (routeState === 'direct') void Linking.openURL(request.url).catch(() => {})
            return false
          }}
          javaScriptEnabled
          domStorageEnabled
          incognito={!isX}
          sharedCookiesEnabled={isX}
          thirdPartyCookiesEnabled={isX}
        />
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    backGlyph: { color: t.text, fontSize: 38, lineHeight: 40, fontWeight: '300' },
    openGlyph: { color: t.text, fontSize: 27, lineHeight: 31, fontWeight: '500' },
    heading: { flex: 1, paddingHorizontal: 6 },
    pageTitle: { color: t.text, fontWeight: '700', fontSize: 14 },
    host: { color: t.textMuted, fontSize: 12, marginTop: 2 },
    webWrap: { flex: 1, backgroundColor: '#fff' },
    web: { flex: 1, backgroundColor: '#fff' },
    loading: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${t.bg}cc`,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    alertCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertGlyph: { color: t.textMuted, fontSize: 20, lineHeight: 23, fontWeight: '600' },
    emptyText: { color: t.textMuted, fontSize: 15, marginTop: 12, marginBottom: 18 },
    doneButton: { minHeight: 48, justifyContent: 'center', backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 20 },
    doneText: { color: t.onAccent, fontSize: 14, fontWeight: '700' },
  })
