import { ServiceSection } from '@/ui/settings/ServiceSection'
import { useCallback, useState, type JSX } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'

import { testProvider, type ProviderTestResult } from '@/engine/agent/client'
import { allProviders, type LlmProviderId } from '@/engine/agent/providers'
import { loadXMediaMode, setXMediaMode, useXMediaMode } from '@/engine/x/mediaPreference'
import { useLocationProfile } from '@/engine/location'
import { sourcesFor } from '@/engine/news/registry'
import {
  FIRECRAWL_DAILY_CREDIT_LIMIT,
  FIRECRAWL_MONTHLY_CREDIT_LIMIT,
  getFirecrawlUsage,
  type FirecrawlUsage,
} from '@/engine/web/firecrawl'
import { PressableScale } from '@/ui/ios/PressableScale'
import { iosScrollProps } from '@/ui/ios/listProps'
import { SegmentedControl } from '@/ui/design'
import { AppHeader } from '@/ui/shell/AppHeader'
import { PrivacySection } from '@/ui/settings/PrivacySection'
import { setThemePreference, useTheme, useThemePreference, useThemedStyles, type ThemePreference, type ThemeTokens } from '@/ui/theme'

type TestState = Partial<Record<LlmProviderId, ProviderTestResult | 'running'>>

function firecrawlStatus(usage: FirecrawlUsage | null): string {
  if (usage?.availability === 'available') return 'Live'
  if (usage?.availability !== 'unavailable') return usage?.mode === 'service' ? 'Connected' : 'Disconnected'
  if (usage.detail?.includes('network')) return 'Network blocked'
  if (usage.detail?.includes('allowance')) return 'Rate limited'
  return 'Unavailable'
}

export default function SettingsScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [privacyExpanded, setPrivacyExpanded] = useState(false)
  const [providersExpanded, setProvidersExpanded] = useState(false)
  const [providers, setProviders] = useState(allProviders())
  const [tests, setTests] = useState<TestState>({})
  const [webUsage, setWebUsage] = useState<FirecrawlUsage | null>(null)
  const xMediaMode = useXMediaMode()
  const themePreference = useThemePreference()
  const location = useLocationProfile()

  const refresh = useCallback(() => setProviders(allProviders()), [])
  useFocusEffect(useCallback(() => {
    refresh()
    void loadXMediaMode()
    void getFirecrawlUsage().then(setWebUsage)
  }, [refresh]))

  const runTest = useCallback(async (id: LlmProviderId) => {
    setTests((current) => ({ ...current, [id]: 'running' }))
    const result = await testProvider(id)
    setTests((current) => ({ ...current, [id]: result }))
  }, [])

  const configuredCount = providers.filter((provider) => provider.hasKey && !provider.disabled).length
  const webStatus = firecrawlStatus(webUsage)

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} {...iosScrollProps} keyboardShouldPersistTaps="handled">
        <ServiceSection onChange={refresh} />
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.appearanceRow}>
          <SegmentedControl
            label="App appearance"
            value={themePreference}
            options={([
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dim', label: 'Dim' },
              { value: 'dark', label: 'Dark' },
            ] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>)}
            onChange={(value) => void setThemePreference(value)}
          />
        </View>

        <Text style={styles.sectionLabel}>Local coverage</Text>
        <PressableScale style={styles.locationRow} onPress={() => router.push('/region')} accessibilityRole="button" accessibilityLabel={`Change local coverage. Current country ${location.name}`}>
          <View style={styles.locationCode}><Text style={styles.locationCodeText}>{location.code}</Text></View>
          <View style={styles.environmentCopy}>
            <Text style={styles.rowTitle}>{location.name}</Text>
            <Text style={styles.rowBody}>{sourcesFor('world').length} feeds · {location.mode === 'device' ? 'device region' : 'custom region'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
        </PressableScale>

        <Text style={styles.sectionLabel}>X media</Text>
        <View style={styles.mediaRow}>
          <View style={styles.mediaCopy}>
            <Text style={styles.rowTitle}>{xMediaMode === 'safe' ? 'Verified previews' : 'Media hidden'}</Text>
            <Text style={styles.rowBody} numberOfLines={2}>
              {xMediaMode === 'safe' ? 'Unverified media stays hidden.' : 'No images or video.'}
            </Text>
          </View>
          <View style={styles.mediaModes}>
            {(['safe', 'hidden'] as const).map((choice) => (
              <PressableScale
                key={choice}
                accessibilityRole="radio"
                accessibilityLabel={`${choice === 'safe' ? 'Safe' : 'Hide media'} X media`}
                accessibilityState={{ checked: xMediaMode === choice }}
                style={[styles.mediaMode, xMediaMode === choice && styles.mediaModeActive]}
                haptic="selection"
                onPress={() => void setXMediaMode(choice)}
              >
                <Text style={[styles.mediaModeText, xMediaMode === choice && styles.mediaModeTextActive]}>{choice === 'safe' ? 'Safe' : 'Hide media'}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <PressableScale style={styles.disclosure} onPress={() => setPrivacyExpanded(!privacyExpanded)} accessibilityRole="button" accessibilityState={{ expanded: privacyExpanded }}><Text style={styles.rowTitle}>Network & privacy</Text><Ionicons name={privacyExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={t.textMuted} /></PressableScale>
        {privacyExpanded ? <PrivacySection /> : null}

        <PressableScale style={styles.disclosure} onPress={() => setProvidersExpanded(!providersExpanded)} accessibilityRole="button" accessibilityState={{ expanded: providersExpanded }}><Text style={styles.rowTitle}>Providers · {configuredCount} connected</Text><Ionicons name={providersExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={t.textMuted} /></PressableScale>
        {providersExpanded ? <>
        <View style={styles.providerGroup}>
          {providers.map((provider) => {
            const test = tests[provider.id]
            const ready = provider.hasKey && !provider.disabled
            const tested = test && test !== 'running' ? test : null
            const status = test === 'running'
              ? 'Testing'
              : tested
                ? tested.ok ? 'Live' : 'Failed'
                : ready ? 'Configured' : provider.disabled ? 'Disabled' : 'Missing'
            return (
              <View key={provider.id} style={styles.providerRow}>
                <View style={styles.providerTop}>
                  <Text style={styles.providerMark}>{provider.label.slice(0, 2).toUpperCase()}</Text>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerName}>{provider.label}</Text>
                    <Text style={styles.providerMeta} numberOfLines={1}>{provider.model} · {provider.disabled ? 'disabled' : provider.hasKey ? 'service' : 'not connected'}</Text>
                  </View>
                  <View style={styles.providerStatus}>
                    <View style={[styles.statusDot, tested?.ok && styles.statusReady, tested && !tested.ok && styles.statusMissing, !provider.hasKey && styles.statusMissing]} />
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                  <PressableScale
                    style={[styles.testButton, (!ready || test === 'running') && styles.buttonDisabled]}
                    disabled={!ready || test === 'running'}
                    onPress={() => void runTest(provider.id)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={`Test ${provider.label}`}
                    accessibilityState={{ busy: test === 'running', disabled: !ready || test === 'running' }}
                  >
                    {test === 'running' ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={styles.testButtonText}>Test</Text>}
                  </PressableScale>
                </View>
                {test && test !== 'running' ? (
                  <View style={[styles.testResult, test.ok ? styles.testSuccess : styles.testFailure]}>
                    <Ionicons name={test.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={17} color={test.ok ? t.positive : t.negative} />
                    <Text style={[styles.testText, test.ok ? styles.testSuccessText : styles.testFailureText]} numberOfLines={2}>
                      {test.ok ? `Connected · ${test.elapsedMs}ms · ${test.detail}` : test.detail}
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>

        <Text style={styles.sectionLabel}>Web usage</Text>
        <View style={styles.webBlock}>
          <View style={styles.webHeader}>
            <View style={styles.webCopy}>
              <Text style={styles.rowTitle}>Firecrawl {webUsage?.mode === 'service' ? 'service' : 'not connected'}</Text>
              <Text style={styles.rowBody} numberOfLines={2}>{webUsage?.availability === 'unavailable' && webUsage.detail ? webUsage.detail : 'SafeSearch, verified domains, explicit actions'}</Text>
            </View>
            <View style={styles.webState}>
              <View style={[styles.statusDot, webUsage?.availability === 'available' && styles.statusReady, webUsage?.availability === 'unavailable' && styles.statusMissing]} />
              <Text style={styles.statusText}>{webStatus}</Text>
            </View>
          </View>
          <View style={styles.usageRow}>
            <View style={styles.usageMetric}>
              <Text style={styles.usageValue}>{webUsage?.dayCredits ?? 0}<Text style={styles.usageLimit}>/{FIRECRAWL_DAILY_CREDIT_LIMIT}</Text></Text>
              <Text style={styles.usageLabel}>Today</Text>
            </View>
            <View style={styles.usageMetric}>
              <Text style={styles.usageValue}>{webUsage?.monthCredits ?? 0}<Text style={styles.usageLimit}>/{FIRECRAWL_MONTHLY_CREDIT_LIMIT}</Text></Text>
              <Text style={styles.usageLabel}>This month</Text>
            </View>
            <Text style={styles.webExplanation}>Feed refreshes cost 0. Web checks cost 2 credits.</Text>
          </View>
        </View>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  disclosure: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  content: { paddingBottom: 32 },
  sectionLabel: { minHeight: 36, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4 },
  appearanceRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  locationRow: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  locationCode: { width: 34, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt },
  locationCodeText: { color: t.text, fontSize: 12, fontWeight: '600' },
  mediaRow: { minHeight: 64, paddingLeft: 12, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  mediaCopy: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 4 },
  rowTitle: { color: t.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowBody: { color: t.textMuted, fontSize: 13, lineHeight: 20, marginTop: 2 },
  mediaModes: { flexDirection: 'row', alignItems: 'stretch' },
  mediaMode: { minWidth: 68, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mediaModeActive: { borderBottomColor: t.accent },
  mediaModeText: { color: t.textMuted, fontSize: 14, fontWeight: '700' },
  mediaModeTextActive: { color: t.text },
  environmentRow: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  environmentCopy: { flex: 1 },
  providerGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  providerRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  providerTop: { minHeight: 64, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  providerMark: { width: 36, color: t.textMuted, fontSize: 12, fontWeight: '600' },
  providerCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  providerName: { color: t.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  providerMeta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  providerStatus: { minWidth: 82, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.textMuted },
  statusReady: { backgroundColor: t.positive },
  statusMissing: { backgroundColor: t.negative },
  statusText: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
  testButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  testButtonText: { color: t.accent, fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.35 },
  testResult: { minHeight: 44, marginHorizontal: 10, marginBottom: 8, paddingHorizontal: 9, flexDirection: 'row', gap: 7, alignItems: 'center', borderRadius: 7 },
  testSuccess: { backgroundColor: t.positiveSoft },
  testFailure: { backgroundColor: t.negativeSoft },
  testText: { flex: 1, fontSize: 12, lineHeight: 18 },
  testSuccessText: { color: t.positive },
  testFailureText: { color: t.negative },
  webBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  webHeader: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  webCopy: { flex: 1 },
  webState: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  usageRow: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  usageMetric: { width: 78 },
  usageValue: { color: t.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  usageLimit: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
  usageLabel: { color: t.textMuted, fontSize: 12, marginTop: 1 },
  webExplanation: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18 },
})
