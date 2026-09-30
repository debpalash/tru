import { useCallback, useEffect, useRef, useState, type ComponentProps, type JSX } from 'react'
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchXActivity, fetchXMentions } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XActivity, XPage } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'
import { XAvatar } from '@/ui/x/XAvatar'

type Mode = 'activity' | 'mentions'

type IconName = ComponentProps<typeof Ionicons>['name']
const icons: Record<XActivity['kind'], IconName> = { like: 'heart-outline', repost: 'repeat-outline', reply: 'chatbubble-outline', mention: 'at-outline', follow: 'person-add-outline', quote: 'chatbox-ellipses-outline', other: 'ellipse-outline' }

export default function XNotificationsScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const live = useRef(true)
  const [mode, setMode] = useState<Mode>('activity')
  const [items, setItems] = useState<XActivity[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => { live.current = false }, [])

  const load = useCallback(async (refresh = false, nextCursor = '') => {
    if (!session) { setLoading(false); return }
    if (nextCursor) setLoadingMore(true)
    else if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const page = await fetchXActivity(nextCursor)
      if (!live.current) return
      setItems((current) => nextCursor ? [...current, ...page.activities.filter((item) => !current.some((old) => old.id === item.id))] : page.activities)
      setCursor(page.cursor)
    } catch (loadError) {
      if (live.current) setError(loadError instanceof Error ? loadError.message : 'X activity could not load.')
    } finally {
      if (live.current) { setLoading(false); setRefreshing(false); setLoadingMore(false) }
    }
  }, [session])
  useEffect(() => { if (mode === 'activity') void load() }, [load, mode])
  const mentionsLoader = useCallback((next = ''): Promise<XPage> => fetchXMentions(next), [])
  const tabs = <View style={styles.tabs}>{(['activity', 'mentions'] as const).map((item) => <PressableScale key={item} accessibilityRole="tab" accessibilityLabel={`X ${item}`} accessibilityState={{ selected: mode === item }} style={[styles.tab, mode === item && styles.tabActive]} onPress={() => setMode(item)}><Text style={[styles.tabText, mode === item && styles.tabTextActive]}>{item[0].toUpperCase() + item.slice(1)}</Text></PressableScale>)}</View>

  return <SafeAreaView style={styles.screen}>
    <AppHeader title="Notifications" subtitle="X activity and mentions" />
    {mode === 'mentions' ? <XTimeline loader={mentionsLoader} header={tabs} empty="No mentions were returned." /> : <FlashList
      data={!session || loading || (error && !items.length) ? [] : items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<View>{tabs}{!session ? <StateCard title="Connect X" body="Sign in to load notifications." action="Connect" onAction={() => router.push('/x/login')} /> : loading ? <StateCard title="Loading activity" loading /> : error && !items.length ? <StateCard title="Activity needs attention" body={error} action="Retry" onAction={() => void load()} /> : !items.length ? <StateCard title="No activity yet" body="Pull to refresh or check again later." /> : null}</View>}
      renderItem={({ item }) => <PressableScale style={styles.row} haptic={false} disabled={!item.post && !item.actors[0]} onPress={() => item.post ? router.push({ pathname: '/x/status', params: { id: item.post.id } }) : item.actors[0] ? router.push({ pathname: '/x/profile', params: { username: item.actors[0].username } }) : undefined} accessibilityRole="button" accessibilityLabel={`${item.message}${item.post?.text ? `. ${item.post.text}` : ''}`} accessibilityState={{ disabled: !item.post && !item.actors[0] }}>
        <View style={styles.glyph}><Ionicons name={icons[item.kind]} size={18} color={styles.glyphText.color} /></View>
        {item.actors[0] ? <View style={styles.avatar}><XAvatar url={item.actors[0].avatar} name={item.actors[0].name} size={29} /></View> : null}
        <View style={styles.copy}><Text style={styles.message}>{item.message}</Text>{item.post ? <Text style={styles.preview} numberOfLines={2}>{item.post.text}</Text> : null}</View><Ionicons name="chevron-forward" size={16} color={t.textMuted} />
      </PressableScale>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.spinner} color={t.accent} /> : error && items.length ? <StateCard title="Could not load more" body={error} action="Retry" onAction={() => void load(false, cursor)} /> : null}
      refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
      onEndReached={() => { if (cursor && !loadingMore) void load(false, cursor) }}
      onEndReachedThreshold={0.55}
      contentContainerStyle={{ paddingBottom: 40 }}
    />}
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  tab: { flex: 1, minHeight: 48, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.accent }, tabText: { color: t.textMuted, fontSize: 12, fontWeight: '700' }, tabTextActive: { color: t.text },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  glyph: { width: 32, alignItems: 'center' }, glyphText: { color: t.accent },
  avatar: { marginRight: 7 },
  copy: { flex: 1 }, message: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '700' }, preview: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }, chevron: { color: t.textMuted, fontSize: 22 }, spinner: { marginVertical: 12 },
})
