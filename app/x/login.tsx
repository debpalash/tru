import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'
import CookieManager from '@react-native-cookies/cookies'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview'

import { claimTorWebViewProxy, claimXWebViewProxy, releaseWebViewProxy, usePrivacySnapshot } from '@/engine/privacy'
import { validateXSession, XClientError } from '@/engine/x/client'
import { clearXSession, saveXSession, useXSession } from '@/engine/x/session'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useHideTabBar } from '@/ui/navigation/useHideTabBar'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

const LOGIN_URL = 'https://x.com/i/flow/login'
type LoginRoute = 'direct' | 'connecting' | 'private' | 'blocked'
const INJECTED_JS = `
  (function () {
    function sendCookies() {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cookies', cookie: document.cookie, url: window.location.href })); } catch (e) {}
    }
    sendCookies();
    var n = 0; var timer = setInterval(function () { sendCookies(); if (++n > 20) clearInterval(timer); }, 500);
  })(); true;
`

function parseCookies(raw: string): Record<string, string> {
  const output: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (name) output[name] = decodeURIComponent(value)
  }
  return output
}

export default function XLoginScreen(): JSX.Element {
  useHideTabBar()
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const privacy = usePrivacySnapshot()
  const fallbackCsrf = useRef('')
  const completed = useRef(false)
  const [checking, setChecking] = useState(false)
  const [showLogin, setShowLogin] = useState(!session)
  const [loginRoute, setLoginRoute] = useState<LoginRoute>('connecting')
  const [message, setMessage] = useState(session ? `Connected${session.username ? ` as @${session.username}` : ''}. Verify, refresh, or disconnect below.` : 'Sign in on X below. Tru never sees your password.')
  useEffect(() => { if (session) setShowLogin(false) }, [session])

  useEffect(() => {
    const owner = {}
    let live = true
    const configure = async () => {
      if (!showLogin) {
        setLoginRoute('direct')
        return
      }
      if (privacy.torEnabled) {
        if (privacy.torStatus !== 'ON') {
          setLoginRoute(privacy.torStatus === 'STARTING' ? 'connecting' : 'blocked')
          return
        }
        setLoginRoute('connecting')
        const ok = await claimTorWebViewProxy(owner)
        if (!live) {
          if (ok) await releaseWebViewProxy(owner)
          return
        }
        setLoginRoute(ok ? 'private' : 'blocked')
        return
      }
      if (privacy.proxy.enabled) {
        if (!privacy.proxy.ready) {
          setLoginRoute(privacy.proxy.refreshing ? 'connecting' : 'blocked')
          return
        }
        setLoginRoute('connecting')
        const ok = await claimXWebViewProxy(owner)
        if (!live) {
          if (ok) await releaseWebViewProxy(owner)
          return
        }
        setLoginRoute(ok ? 'private' : 'blocked')
        return
      }
      setLoginRoute(privacy.relayEnabled ? 'blocked' : 'direct')
    }
    void configure()
    return () => {
      live = false
      void releaseWebViewProxy(owner)
    }
  }, [privacy.proxy.active?.host, privacy.proxy.active?.port, privacy.proxy.enabled, privacy.proxy.ready, privacy.proxy.refreshing, privacy.relayEnabled, privacy.torEnabled, privacy.torStatus, showLogin])

  const capture = useCallback(async () => {
    if (checking || completed.current) return
    setChecking(true)
    try {
      let authToken = ''
      let ct0 = ''
      for (let attempt = 0; attempt < 4 && (!authToken || !ct0); attempt += 1) {
        const cookies = await CookieManager.get('https://x.com', true)
        authToken = cookies.auth_token?.value ?? ''
        ct0 = cookies.ct0?.value ?? fallbackCsrf.current
        if (!authToken || !ct0) await new Promise((resolve) => setTimeout(resolve, 350))
      }
      if (!authToken || !ct0) {
        setMessage('Finish signing in to X, then tap “Use this session”. A native development build is required to read X’s secure cookie.')
        return
      }
      completed.current = true
      await saveXSession({ authToken, ct0 })
      try {
        const user = await validateXSession()
        setMessage(`Connected as @${user.username}. Opening your timeline`)
      } catch (error) {
        if (error instanceof XClientError && error.code === 'login') {
          completed.current = false
          await clearXSession()
          setMessage(error.message)
          return
        }
        setMessage('Session captured. Account details will finish syncing from the X screen.')
      }
      setTimeout(() => router.replace('/x'), 300)
    } catch (error) {
      completed.current = false
      setMessage(error instanceof Error ? error.message : 'Tru could not read the session. Try again.')
    } finally { setChecking(false) }
  }, [checking])

  const disconnect = useCallback(async () => {
    if (checking) return
    setChecking(true)
    try {
      await CookieManager.clearAll(true)
      await clearXSession()
      fallbackCsrf.current = ''
      completed.current = false
      setMessage('Disconnected. Sign in below to connect another X account.')
      setShowLogin(true)
    } catch {
      setMessage('Could not finish disconnecting. Try again before leaving this screen.')
    } finally { setChecking(false) }
  }, [checking])

  const confirmDisconnect = useCallback(() => {
    Alert.alert('Disconnect X?', 'Tru will remove the saved X session and clear cookies for its embedded browser. This also signs out websites opened inside Tru.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => void disconnect() },
    ])
  }, [disconnect])

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const origin = new URL(event.nativeEvent.url)
      if (origin.protocol !== 'https:' || !['x.com', 'twitter.com'].includes(origin.hostname)) return
      const payload = JSON.parse(event.nativeEvent.data) as { type?: string; cookie?: string }
      if (payload.type === 'cookies' && payload.cookie) fallbackCsrf.current = parseCookies(payload.cookie).ct0 ?? fallbackCsrf.current
    } catch { /* ignore untrusted page messages */ }
  }, [])

  const onNavigation = useCallback((state: WebViewNavigation) => {
    try {
      const url = new URL(state.url)
      const xHost = url.hostname === 'x.com' || url.hostname === 'twitter.com'
      if (xHost && url.pathname === '/home') void capture()
    } catch { /* malformed navigation cannot complete login */ }
  }, [capture])

  const webReady = loginRoute === 'direct' || loginRoute === 'private'
  const privateRouteLabel = privacy.torEnabled ? 'Tor' : privacy.proxy.enabled ? 'X proxy' : ''
  const routeMessage = loginRoute === 'connecting'
    ? `Connecting X sign-in through ${privateRouteLabel || 'the private route'}. Direct loading stays blocked.`
    : privacy.relayEnabled && !privacy.torEnabled && !privacy.proxy.enabled
      ? 'Account cookies never enter the public relay. Turn on embedded Tor, enable an X proxy, or turn off Relay to sign in directly.'
      : `${privateRouteLabel || 'Private'} WebView routing is unavailable. Tru blocked direct sign-in.`

  return <SafeAreaView style={styles.screen}>
    <AppHeader title="Connect X" subtitle={`${loginRoute === 'private' ? `${privateRouteLabel} · ` : ''}X-hosted sign-in · encrypted on device`} />
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{message}</Text>
      <PressableScale style={styles.primary} disabled={checking || (!session && !webReady)} onPress={() => void capture()} accessibilityRole="button" accessibilityLabel={session ? 'Verify X session' : 'Use this X session'} accessibilityState={{ busy: checking, disabled: checking || (!session && !webReady) }}>{checking ? <ActivityIndicator size="small" color={styles.primaryText.color} /> : <Text style={styles.primaryText}>{session ? 'Verify' : 'Use session'}</Text>}</PressableScale>
      {session ? <PressableScale style={styles.secondary} onPress={confirmDisconnect} accessibilityRole="button" accessibilityLabel="Disconnect X account" accessibilityHint="Asks for confirmation before removing the session"><Text style={styles.secondaryText}>Disconnect</Text></PressableScale> : null}
    </View>
    {session && !showLogin ? <View style={styles.connected}>
      <Text style={styles.connectedTitle}>Native X session connected</Text>
      <Text style={styles.connectedBody}>The X website stays closed here so unverified media cannot bypass Tru’s safety gate.</Text>
      <PressableScale style={styles.refreshLogin} onPress={() => setShowLogin(true)} accessibilityRole="button" accessibilityLabel="Refresh X sign-in"><Text style={styles.refreshLoginText}>Refresh X sign-in</Text></PressableScale>
    </View> : webReady ? <WebView
      source={{ uri: LOGIN_URL }}
      style={styles.web}
      injectedJavaScript={INJECTED_JS}
      onMessage={onMessage}
      onNavigationStateChange={onNavigation}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      incognito={false}
      originWhitelist={['https://x.com', 'https://twitter.com']}
      onShouldStartLoadWithRequest={(request) => { try { const url = new URL(request.url); return url.protocol === 'https:' && ['x.com', 'twitter.com'].includes(url.hostname) } catch { return false } }}
      startInLoadingState
    /> : <View style={styles.routeBlocked}>
      {loginRoute === 'connecting' ? <ActivityIndicator size="small" color={styles.routeGlyph.color} /> : <Text style={styles.routeGlyph}>✓</Text>}
      <Text style={styles.routeTitle}>{loginRoute === 'connecting' ? 'Preparing private sign-in' : 'Direct sign-in blocked'}</Text>
      <Text style={styles.routeBody}>{routeMessage}</Text>
    </View>}
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  notice: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.surface },
  noticeText: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18 },
  primary: { minWidth: 78, minHeight: 48, paddingHorizontal: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
  secondary: { minHeight: 48, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: t.negative, fontSize: 12, fontWeight: '700' },
  web: { flex: 1, backgroundColor: '#000' },
  connected: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  connectedTitle: { color: t.text, fontSize: 15, fontWeight: '600' },
  connectedBody: { maxWidth: 340, color: t.textMuted, fontSize: 14, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  refreshLogin: { minHeight: 48, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt, marginTop: 15 },
  refreshLoginText: { color: t.accent, fontSize: 14, fontWeight: '600' },
  routeBlocked: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  routeGlyph: { color: t.positive, fontSize: 24, lineHeight: 28, fontWeight: '600' },
  routeTitle: { color: t.text, fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 9 },
  routeBody: { maxWidth: 360, color: t.textMuted, fontSize: 14, lineHeight: 18, textAlign: 'center', marginTop: 5 },
})
