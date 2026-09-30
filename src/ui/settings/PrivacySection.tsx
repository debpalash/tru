import { useCallback, useState, type JSX } from 'react'
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import {
  getRelayUrl,
  isOrbotInstalled,
  measureTorLatency,
  openOrbot,
  refreshProxyPool,
  rotateProxy,
  setProxyEnabled,
  setRelayEnabled,
  setRelayUrl,
  setTorEnabled,
  testRelay,
  usePrivacySnapshot,
} from '@/engine/privacy'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

function statusLabel(status: string): string {
  if (status === 'ON') return 'Connected'
  if (status === 'STARTING') return 'Connecting'
  if (status === 'STOPPING') return 'Stopping'
  return 'Off'
}

export function PrivacySection(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const privacy = usePrivacySnapshot()
  const [relayDraft, setRelayDraft] = useState(getRelayUrl())
  const [relayResult, setRelayResult] = useState('')
  const [testingRelay, setTestingRelay] = useState(false)
  const [torPing, setTorPing] = useState<number | null>(null)
  const [testingTor, setTestingTor] = useState(false)

  const toggleTor = useCallback(async (next: boolean) => {
    setTorPing(null)
    await setTorEnabled(next)
  }, [])
  const commitRelay = useCallback(async (): Promise<boolean> => {
    const valid = await setRelayUrl(relayDraft)
    if (!valid && relayDraft.trim()) setRelayResult('Use a valid HTTPS Worker URL.')
    return valid
  }, [relayDraft])
  const toggleRelay = useCallback(async (next: boolean) => {
    if (next && !await commitRelay()) return
    await setRelayEnabled(next)
  }, [commitRelay])
  const runRelayTest = useCallback(async () => {
    if (!await commitRelay()) return
    setTestingRelay(true)
    setRelayResult('')
    const result = await testRelay(relayDraft)
    setRelayResult(`${result.detail}${result.ms ? ` · ${result.ms}ms` : ''}`)
    setTestingRelay(false)
  }, [commitRelay, relayDraft])
  const runTorTest = useCallback(async () => {
    setTestingTor(true)
    const latency = await measureTorLatency()
    setTorPing(latency >= 0 ? latency : null)
    setTestingTor(false)
  }, [])

  const proxy = privacy.proxy
  const torConnected = privacy.torStatus === 'ON'
  return <>
    <Text style={styles.sectionLabel}>Private network</Text>
    <View style={styles.notice}>
      <Ionicons name="shield-checkmark-outline" size={18} color={t.positive} />
      <Text style={styles.noticeText}>Private routes fail closed. Tru never retries them over a direct connection.</Text>
    </View>

    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Embedded Tor</Text>
          <Text style={styles.body}>Protects APIs, search, feeds, AI requests, and in-app WebViews. Images and video stay blocked while embedded Tor is on.</Text>
          <Text style={[styles.meta, torConnected && styles.live]}>{statusLabel(privacy.torStatus)}{torPing != null ? ` · ${torPing}ms` : ''}</Text>
        </View>
        <Switch value={privacy.torEnabled} disabled={!privacy.torAvailable} onValueChange={(next) => void toggleTor(next)} accessibilityLabel="Route Tru API traffic through embedded Tor" trackColor={{ false: t.border, true: t.accent }} thumbColor="#fff" />
      </View>
      <View style={styles.actions}>
        <PressableScale style={styles.action} disabled={!torConnected || testingTor} onPress={() => void runTorTest()} accessibilityRole="button" accessibilityLabel="Test Tor connection">
          {testingTor ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={styles.actionText}>Test Tor</Text>}
        </PressableScale>
        <PressableScale style={styles.action} onPress={() => void openOrbot()} accessibilityRole="button" accessibilityLabel="Open Orbot for private media and browser traffic">
          <Text style={styles.actionText}>{isOrbotInstalled() ? 'Open Orbot' : 'Get Orbot'}</Text>
        </PressableScale>
      </View>
    </View>

    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Private relay</Text>
          <Text style={styles.body}>Routes public feeds, downloads, and media through your HTTPS Worker. Keys, cookies, and account actions never enter it; WebViews use Tor or Orbot.</Text>
        </View>
        <Switch value={privacy.relayEnabled} disabled={!relayDraft.trim()} onValueChange={(next) => void toggleRelay(next)} accessibilityLabel="Route public feeds and media through private relay" trackColor={{ false: t.border, true: t.accent }} thumbColor="#fff" />
      </View>
      <TextInput
        value={relayDraft}
        onChangeText={setRelayDraft}
        onBlur={() => void commitRelay()}
        placeholder="https://your-worker.workers.dev"
        placeholderTextColor={t.textSubtle}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="Private relay HTTPS Worker URL"
      />
      <View style={styles.actions}>
        <PressableScale style={styles.action} disabled={testingRelay || !relayDraft.trim()} onPress={() => void runRelayTest()} accessibilityRole="button" accessibilityLabel="Test private relay">
          {testingRelay ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={styles.actionText}>Test relay</Text>}
        </PressableScale>
        {relayResult ? <Text style={styles.result} numberOfLines={2}>{relayResult}</Text> : null}
      </View>
    </View>

    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>X proxy pool</Text>
          <Text style={styles.body}>Uses TLS through rotating public CONNECT proxies for X feeds and sign-in. Native media blocks direct access unless Relay or Orbot covers it.</Text>
          <Text style={[styles.meta, proxy.ready && styles.live]}>{proxy.refreshing ? `Checking exits · ${proxy.checked}` : proxy.ready ? `${proxy.total} working · ${proxy.active?.host}:${proxy.active?.port}` : proxy.error || 'Off'}</Text>
        </View>
        <Switch value={proxy.enabled} disabled={!proxy.available} onValueChange={(next) => void setProxyEnabled(next)} accessibilityLabel="Route X API traffic through proxy pool" trackColor={{ false: t.border, true: t.accent }} thumbColor="#fff" />
      </View>
      {proxy.enabled ? <View style={styles.actions}>
        <PressableScale style={styles.action} disabled={proxy.refreshing} onPress={() => void refreshProxyPool()} accessibilityRole="button" accessibilityLabel="Refresh X proxy pool"><Text style={styles.actionText}>Refresh</Text></PressableScale>
        <PressableScale style={styles.action} disabled={proxy.total < 2} onPress={rotateProxy} accessibilityRole="button" accessibilityLabel="Rotate X proxy exit"><Text style={styles.actionText}>Rotate</Text></PressableScale>
      </View> : null}
    </View>
  </>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  sectionLabel: { minHeight: 36, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 7, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4 },
  notice: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.positiveSoft },
  noticeText: { flex: 1, color: t.positive, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  group: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  row: { minHeight: 76, paddingLeft: 12, paddingRight: 10, paddingVertical: 9, flexDirection: 'row', gap: 8, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: t.text, fontSize: 14, lineHeight: 24, fontWeight: '600' },
  body: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  meta: { color: t.textSubtle, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '700' },
  live: { color: t.positive },
  input: { minHeight: 48, marginHorizontal: 12, marginBottom: 4, paddingHorizontal: 10, color: t.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 8, backgroundColor: t.surfaceAlt },
  actions: { minHeight: 48, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' },
  action: { minWidth: 88, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: t.accent, fontSize: 14, fontWeight: '600' },
  result: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18, paddingRight: 6 },
})
