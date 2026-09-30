import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXUser, fetchXUserPosts } from '@/engine/x/client'
import type { XPost, XUser } from '@/engine/x/types'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XPostRow } from '@/ui/x/XPostRow'

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K`
  return String(Math.round(value))
}

export default function XAnalyticsScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const { username = '' } = useLocalSearchParams<{ username?: string }>()
  const [user, setUser] = useState<XUser | null>(null)
  const [posts, setPosts] = useState<XPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const account = await fetchXUser(username)
      const collected: XPost[] = []
      let cursor = ''
      for (let page = 0; page < 3; page += 1) {
        const result = await fetchXUserPosts(account.id, cursor, 'posts', account.username)
        collected.push(...result.posts.filter((post) => !collected.some((old) => old.id === post.id)))
        if (!result.cursor) break
        cursor = result.cursor
      }
      setUser(account); setPosts(collected)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Analytics unavailable.') }
    finally { setLoading(false) }
  }, [username])
  useEffect(() => { void load() }, [load])

  const report = useMemo(() => {
    const count = posts.length
    const totals = posts.reduce((sum, post) => ({ views: sum.views + post.views, likes: sum.likes + post.likes, replies: sum.replies + post.replies, reposts: sum.reposts + post.reposts }), { views: 0, likes: 0, replies: 0, reposts: 0 })
    const engagement = totals.likes + totals.replies + totals.reposts
    const ranked = [...posts].sort((a, b) => (b.likes + b.reposts * 2 + b.replies * 1.5) - (a.likes + a.reposts * 2 + a.replies * 1.5))
    const hours = Array.from({ length: 24 }, () => 0)
    for (const post of posts) hours[new Date(post.createdAt).getHours()] += 1
    const bestHour = hours.indexOf(Math.max(...hours))
    const spanDays = count > 1 ? Math.max(1, (posts[0].createdAt - posts.at(-1)!.createdAt) / 86_400_000) : 1
    return { count, totals, engagement, ranked, bestHour, postsPerDay: count / spanDays }
  }, [posts])

  return <SafeAreaView style={styles.screen}><AppHeader title="X analytics" subtitle={user ? `@${user.username} · last ${report.count} posts` : `@${username}`} />
    {loading ? <StateCard title="Calculating analytics" body="Reading recent X posts" loading /> : error ? <StateCard title="Analytics need attention" body={error} action="Retry" onAction={() => void load()} /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.metrics}>
        <Metric label="Avg views" value={compact(report.count ? report.totals.views / report.count : 0)} />
        <Metric label="Engagements" value={compact(report.engagement)} />
        <Metric label="Posts per day" value={report.postsPerDay.toFixed(1)} />
        <Metric label="Active hour" value={`${String(report.bestHour).padStart(2, '0')}:00`} />
      </View>
      <View style={styles.signal}><Text style={styles.signalLabel}>Signal</Text><Text style={styles.signalText}>{report.count ? `${compact(report.totals.likes)} likes · ${compact(report.totals.reposts)} reposts · ${compact(report.totals.replies)} replies across the sampled posts.` : 'No recent posts to analyze.'}</Text></View>
      <Text style={styles.section}>Top posts</Text>
      {report.ranked.slice(0, 5).map((post) => <XPostRow key={post.id} post={post} />)}
      {!report.ranked.length ? <StateCard title="No posts" body="This account returned no recent posts." /> : null}
    </ScrollView>}
  </SafeAreaView>
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, content: { paddingBottom: 40 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, metric: { width: '50%', minHeight: 54, padding: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  metricValue: { color: t.text, fontSize: 17, fontWeight: '600' }, metricLabel: { color: t.textMuted, fontSize: 12, marginTop: 3 },
  signal: { minHeight: 54, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, signalLabel: { width: 58, color: t.accent, fontSize: 12, fontWeight: '600' }, signalText: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18 },
  section: { color: t.text, fontSize: 14, fontWeight: '600', marginTop: 11, marginBottom: 3, marginHorizontal: 9 },
})
