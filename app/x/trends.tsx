import { useCallback, useEffect, useState, type JSX } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXTrends } from '@/engine/x/client'
import type { XTrend } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

function compact(value?: number): string {
  if (!value) return 'Trending now'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M posts`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K posts`
  return `${value} posts`
}

export default function XTrendsScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [trends, setTrends] = useState<XTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try { setTrends(await fetchXTrends()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Trends could not load.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return <SafeAreaView style={styles.screen}>
    <AppHeader title="X trends" subtitle="Worldwide · tap to search natively" />
    <ScrollView refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />} contentContainerStyle={styles.content}>
      {loading && !trends.length ? <StateCard title="Loading trends" loading /> : null}
      {error && !trends.length ? <StateCard title="Native trends unavailable" body={error} action="Open X Explore" onAction={() => router.push('/browser?url=https%3A%2F%2Fx.com%2Fexplore&title=X%20Explore')} /> : null}
      {!loading && !error && !trends.length ? <StateCard title="No trends returned" body="X’s legacy trend endpoint can vary by account. Explore remains available on X." action="Open Explore" onAction={() => router.push('/browser?url=https%3A%2F%2Fx.com%2Fexplore&title=X%20Explore')} /> : null}
      {trends.map((trend, index) => <PressableScale key={`${trend.name}:${index}`} style={styles.row} haptic={false} onPress={() => router.push({ pathname: '/x/search', params: { q: trend.name } })} accessibilityRole="button" accessibilityLabel={`Search X for ${trend.name}. ${compact(trend.volume)}`}><Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.copy}><Text style={styles.name}>{trend.name}</Text><Text style={styles.meta}>{compact(trend.volume)}</Text></View><Text style={styles.chevron}>›</Text></PressableScale>)}
    </ScrollView>
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, content: { paddingBottom: 40 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  rank: { width: 38, color: t.accent, fontSize: 12, fontWeight: '600' }, copy: { flex: 1 }, name: { color: t.text, fontSize: 14, fontWeight: '600' }, meta: { color: t.textMuted, fontSize: 12, marginTop: 2 }, chevron: { color: t.textMuted, fontSize: 22 },
})
