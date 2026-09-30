import { useCallback, useEffect, useState, type JSX } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchStoryPage } from '@/engine/hn/api'
import { STORY_TYPES, type Story, type StoryType } from '@/engine/hn/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

function ago(seconds: number): string {
  const minutes = Math.max(1, Math.floor((Date.now() / 1000 - seconds) / 60))
  return minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`
}

export default function HnScreen(): JSX.Element {
  const t = useTheme(); const styles = useThemedStyles(makeStyles)
  const [type, setType] = useState<StoryType>('top'); const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (fresh = false) => {
    fresh ? setRefreshing(true) : setLoading(true); setError(null)
    try { setStories((await fetchStoryPage(type, 0, 50, fresh)).stories) } catch (e) { setError(e instanceof Error ? e.message : 'HN unavailable.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [type])
  useEffect(() => { void load() }, [load])
  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Hacker News" subtitle="Top, new, best, Ask, Show and Jobs" />
      <FlashList
        data={stories}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{STORY_TYPES.map((item) => <PressableScale key={item.key} style={[styles.tab, type === item.key && styles.tabActive]} onPress={() => setType(item.key)} accessibilityRole="tab" accessibilityLabel={`${item.label} Hacker News stories`} accessibilityState={{ selected: type === item.key }}><Text style={[styles.tabText, type === item.key && styles.tabTextActive]}>{item.label}</Text></PressableScale>)}</ScrollView>{loading ? <StateCard title="Loading Hacker News" loading /> : error ? <StateCard title="HN needs attention" body={error} action="Retry" onAction={() => void load()} /> : null}</View>}
        renderItem={({ item }) => <PressableScale style={styles.row} onPress={() => router.push({ pathname: '/hn/thread', params: { id: String(item.id) } })} haptic={false} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.score} points, ${item.commentCount} comments, by ${item.by}`}><View style={styles.score}><Text style={styles.scoreValue}>{item.score}</Text><Text style={styles.scoreLabel}>PTS</Text></View><View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.domain ?? 'news.ycombinator.com'} · {item.commentCount} comments · {ago(item.time)} · {item.by}</Text></View><Text style={styles.chevron}>›</Text></PressableScale>}
        refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, tabs: { minHeight: 48, paddingHorizontal: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, tab: { minHeight: 48, paddingHorizontal: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }, tabActive: { backgroundColor: t.warningSoft }, tabText: { color: t.textMuted, fontSize: 12, fontWeight: '700' }, tabTextActive: { color: t.warning },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, score: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.warningSoft, marginRight: 9 }, scoreValue: { color: t.warning, fontSize: 14, fontWeight: '600' }, scoreLabel: { color: t.warning, fontSize: 12, fontWeight: '600' }, copy: { flex: 1 }, title: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '700' }, meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }, chevron: { color: t.textMuted, fontSize: 23, marginLeft: 5 },
})
