import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXHome } from '@/engine/x/client'
import type { XPost } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XPostRow } from '@/ui/x/XPostRow'

type WindowHours = 6 | 24 | 72

export default function XCatchupScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [hours, setHours] = useState<WindowHours>(24)
  const [posts, setPosts] = useState<XPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const first = await fetchXHome()
      let combined = first.posts
      if (first.cursor) {
        const second = await fetchXHome(first.cursor)
        combined = [...first.posts, ...second.posts.filter((post) => !first.posts.some((old) => old.id === post.id))]
      }
      setPosts(combined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'X catch-up unavailable.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const report = useMemo(() => {
    const cutoff = Date.now() - hours * 3_600_000
    const recent = posts.filter((post) => post.createdAt >= cutoff)
    const ranked = [...recent].sort((a, b) => (b.likes + b.reposts * 2 + b.replies) - (a.likes + a.reposts * 2 + a.replies))
    const authors = new Map<string, { name: string; username: string; count: number; signal: number }>()
    for (const post of recent) {
      const current = authors.get(post.user.id) ?? { name: post.user.name, username: post.user.username, count: 0, signal: 0 }
      current.count += 1; current.signal += post.likes + post.reposts * 2 + post.replies
      authors.set(post.user.id, current)
    }
    return { recent, ranked, authors: [...authors.values()].sort((a, b) => b.signal - a.signal).slice(0, 5) }
  }, [hours, posts])

  return <SafeAreaView style={styles.screen}><AppHeader title="X catch-up" subtitle="Dense account timeline briefing" />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}>
      <View style={styles.windows}>{([6, 24, 72] as const).map((value) => <PressableScale key={value} style={[styles.window, hours === value && styles.windowActive]} onPress={() => setHours(value)} accessibilityRole="tab" accessibilityLabel={`${value === 72 ? '3 day' : `${value} hour`} catch-up window`} accessibilityState={{ selected: hours === value }}><Text style={[styles.windowText, hours === value && styles.windowTextActive]}>{value === 72 ? '3 days' : `${value} hours`}</Text></PressableScale>)}</View>
      {loading ? <StateCard title="Building catch-up" body="Reading the latest account timeline" loading /> : error ? <StateCard title="Catch-up needs attention" body={error} action="Retry" onAction={() => void load()} /> : <>
        <View style={styles.summary}><View><Text style={styles.summaryValue}>{report.recent.length}</Text><Text style={styles.summaryLabel}>Posts</Text></View><View style={styles.divider} /><View><Text style={styles.summaryValue}>{report.authors.length}</Text><Text style={styles.summaryLabel}>Top voices</Text></View><Text style={styles.summaryCopy}>Ranked by visible replies, reposts and likes.</Text></View>
        <Text style={styles.section}>Voices to scan</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.authors}>{report.authors.map((author) => <View key={author.username} style={styles.author}><Text style={styles.authorName} numberOfLines={1}>{author.name}</Text><Text style={styles.authorHandle}>@{author.username}</Text><Text style={styles.authorMeta}>{author.count} posts · {author.signal} signal</Text></View>)}</ScrollView>
        <Text style={styles.section}>High-signal posts</Text>
        {report.ranked.slice(0, 15).map((post) => <XPostRow key={post.id} post={post} />)}
        {!report.recent.length ? <StateCard title="Quiet window" body={`No loaded Following posts landed in the last ${hours} hours.`} /> : null}
      </>}
    </ScrollView>
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, content: { paddingBottom: 40 }, windows: { height: 48, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  window: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, windowActive: { borderBottomColor: t.accent }, windowText: { color: t.textMuted, fontSize: 12, fontWeight: '700' }, windowTextActive: { color: t.text },
  summary: { minHeight: 64, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, summaryValue: { color: t.text, fontSize: 17, fontWeight: '600' }, summaryLabel: { color: t.textMuted, fontSize: 12 }, divider: { width: 1, height: 29, marginHorizontal: 12, backgroundColor: t.border }, summaryCopy: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18, marginLeft: 12 },
  section: { color: t.text, fontSize: 14, fontWeight: '600', marginHorizontal: 9, marginTop: 10, marginBottom: 6 }, authors: { paddingHorizontal: 7, gap: 5 }, author: { width: 144, minHeight: 72, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 8, backgroundColor: t.surface }, authorName: { color: t.text, fontSize: 14, fontWeight: '600' }, authorHandle: { color: t.textMuted, fontSize: 12, marginTop: 1 }, authorMeta: { color: t.textMuted, fontSize: 12, marginTop: 5 },
})
