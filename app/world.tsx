import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchNews } from '@/engine/news/feed'
import type { NewsItem } from '@/engine/news/types'
import { buildWorldSignals } from '@/engine/world/intelligence'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { openLink } from '@/ui/openLink'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

type Tab = 'events' | 'entities' | 'dossiers' | 'forecast'
const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'events', label: 'Events' },
  { key: 'entities', label: 'Entities' },
  { key: 'dossiers', label: 'Dossiers' },
  { key: 'forecast', label: 'Forecast' },
]

export default function WorldScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const params = useLocalSearchParams<{ tab?: Tab }>()
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.key === params.tab) ? params.tab! : 'events')
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (fresh = false) => {
    fresh ? setRefreshing(true) : setLoading(true)
    try {
      setItems(await fetchNews('world', null, fresh))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (TABS.some((item) => item.key === params.tab)) setTab(params.tab!) }, [params.tab])
  const signals = useMemo(() => buildWorldSignals(items), [items])
  const entityRows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const signal of signals) {
      for (const entity of signal.entities) counts.set(entity, (counts.get(entity) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 30)
  }, [signals])

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="World" subtitle={`${items.length} reports`} />
      <ScrollView
        refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.tabs}>
          {TABS.map((item) => (
            <PressableScale
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} world view`}
              accessibilityState={{ selected: tab === item.key }}
            >
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </PressableScale>
          ))}
        </View>

        {loading && !items.length ? <StateCard title="Loading reports" loading /> : null}
        {!loading && !(tab === 'entities' ? entityRows.length : signals.length) ? <StateCard title={tab === 'entities' && signals.length ? 'No topics found' : 'No reports available'} body="Refresh to check for updates." action="Refresh" onAction={() => void load(true)} /> : null}

        {tab === 'entities' ? (
          <View style={styles.rows}>
            {entityRows.map(([name, count]) => (
              <PressableScale
                key={name}
                style={styles.entity}
                onPress={() => router.push({ pathname: '/research', params: { q: name } } as never)}
                accessibilityRole="button"
                accessibilityLabel={`Research ${name}`}
              >
                <Ionicons name="at-outline" size={18} color={t.textMuted} />
                <Text style={styles.entityName}>{name}</Text>
                <Text style={styles.entityMeta}>{count} signal{count === 1 ? '' : 's'}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
              </PressableScale>
            ))}
          </View>
        ) : (
          <View style={styles.rows}>
            {signals.map((signal) => {
              const tierColor = signal.tier === 'Critical' ? t.negative : signal.tier === 'Elevated' ? t.warning : t.accent
              return (
                <View key={signal.id} style={styles.signal}>
                  <View style={styles.signalTop}>
                    <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
                    <Text style={[styles.tier, { color: tierColor }]}>{signal.tier}</Text>
                    <Text style={styles.region}>{signal.region}</Text>
                    <Text style={styles.momentum}>{tab === 'forecast' ? `${signal.momentum}% momentum` : `${signal.reports.length} publisher${signal.reports.length === 1 ? '' : 's'}`}</Text>
                  </View>
                  <Text style={styles.signalTitle}>{signal.title}</Text>
                  {tab === 'dossiers' ? (
                    <Text style={styles.analysis}>{signal.entities.join(', ') || 'No topics identified'} · Based on headlines</Text>
                  ) : tab === 'forecast' ? (
                    <Text style={styles.analysis}>Headline trend based on recency and coverage; not a probability.</Text>
                  ) : null}
                  <View style={styles.links}>
                    {signal.reports.slice(0, 3).map((report) => (
                      <PressableScale key={report.id} style={styles.link} onPress={() => openLink(report.mobileUrl ?? report.url, report.title)} accessibilityRole="link" accessibilityLabel={`Open ${report.sourceId} report`}>
                        <Ionicons name="link-outline" size={13} color={t.textMuted} />
                        <Text style={styles.linkText}>{report.sourceId}</Text>
                      </PressableScale>
                    ))}
                    <PressableScale style={styles.research} onPress={() => router.push({ pathname: '/research', params: { q: signal.title } } as never)} accessibilityRole="button" accessibilityLabel="Research this signal">
                      <Text style={styles.researchText}>Research</Text>
                      <Ionicons name="arrow-forward" size={13} color={t.accent} />
                    </PressableScale>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingBottom: 32 },
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.accent },
  tabText: { color: t.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: t.text },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  signal: { paddingHorizontal: 16, paddingTop: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  signalTop: { minHeight: 20, flexDirection: 'row', gap: 5, alignItems: 'center' },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tier: { fontSize: 12, fontWeight: '600' },
  region: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
  momentum: { color: t.textMuted, fontSize: 12, marginLeft: 'auto' },
  signalTitle: { color: t.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 4 },
  analysis: { color: t.textMuted, fontSize: 14, lineHeight: 18, marginTop: 5 },
  links: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  link: { minHeight: 48, paddingHorizontal: 5, flexDirection: 'row', gap: 3, alignItems: 'center' },
  linkText: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
  research: { minHeight: 48, marginLeft: 'auto', paddingHorizontal: 5, flexDirection: 'row', gap: 4, alignItems: 'center' },
  researchText: { color: t.accent, fontSize: 12, fontWeight: '600' },
  entity: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  entityName: { flex: 1, color: t.text, fontSize: 12, fontWeight: '600' },
  entityMeta: { color: t.textMuted, fontSize: 12 },
})
