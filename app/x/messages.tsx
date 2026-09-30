import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchXDmInbox, fetchXUserById } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XDmConversation, XUser } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XAvatar } from '@/ui/x/XAvatar'

function ago(time: number): string {
  const delta = Math.max(0, Date.now() - time)
  if (delta < 60_000) return 'now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`
  return `${Math.floor(delta / 86_400_000)}d`
}

export default function XMessagesScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const live = useRef(true)
  const [items, setItems] = useState<XDmConversation[]>([])
  const [users, setUsers] = useState<Record<string, XUser>>({})
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => { live.current = false }, [])

  const load = useCallback(async (next = '', refresh = false) => {
    if (!session) { setLoading(false); return }
    if (next) setMore(true); else if (refresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const page = await fetchXDmInbox(next)
      if (!live.current) return
      setItems((current) => next ? [...new Map([...current, ...page.conversations].map((item) => [item.id, item])).values()] : page.conversations)
      setCursor(page.cursor)
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : 'X messages could not load.') }
    finally { if (live.current) { setLoading(false); setRefreshing(false); setMore(false) } }
  }, [session])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let active = true
    const ids = [...new Set(items.flatMap((item) => item.participantIds).filter((id) => id !== session?.userId && !users[id]))].slice(0, 30)
    if (!ids.length) return
    void Promise.all(ids.map(async (id) => { try { return [id, await fetchXUserById(id)] as const } catch { return null } })).then((resolved) => {
      if (!active) return
      setUsers((current) => ({ ...current, ...Object.fromEntries(resolved.filter((item): item is readonly [string, XUser] => Boolean(item))) }))
    })
    return () => { active = false }
  }, [items, session?.userId, users])

  const state = !session ? <StateCard title="Connect X" body="Sign in to load your messages." action="Connect" onAction={() => router.push('/x/login')} />
    : loading ? <StateCard title="Loading messages" loading />
      : error && !items.length ? <StateCard title="Messages need attention" body={error} action="Retry" onAction={() => void load()} />
        : !items.length ? <StateCard title="No messages" body="No X conversations were returned for this account." action="Refresh" onAction={() => void load('', true)} /> : null

  return <SafeAreaView style={styles.screen}>
    <AppHeader title="Messages" subtitle="X inbox" right={<PressableScale style={styles.web} onPress={() => router.push('/browser?url=https%3A%2F%2Fx.com%2Fmessages%2Fcompose&title=New%20X%20message')} accessibilityRole="button" accessibilityLabel="Start message on X"><Ionicons name="create-outline" size={18} color={styles.webText.color} /></PressableScale>} />
    <FlatList
      data={state ? [] : items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={state}
      ListFooterComponent={more ? <ActivityIndicator style={styles.spinner} color={t.accent} /> : null}
      refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load('', true)} {...refreshTint(t)} />}
      onEndReached={() => { if (cursor && !more) void load(cursor) }}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => {
        const otherId = item.participantIds.find((id) => id !== session?.userId) || item.participantIds.at(-1) || ''
        const user = users[otherId]
        const name = user?.name || (item.participantIds.length > 2 ? `Group · ${item.participantIds.length}` : 'X conversation')
        return <PressableScale style={[styles.row, item.unread && styles.rowUnread]} haptic={false} onPress={() => router.push({ pathname: '/x/dm/[id]', params: { id: item.id, name, username: user?.username || '' } })} accessibilityRole="button" accessibilityLabel={`${item.unread ? 'Unread conversation' : 'Conversation'} with ${name}. ${item.lastText || 'Media or activity'}, ${ago(item.createdAt)} ago`}>
          <XAvatar url={user?.avatar} name={name} size={34} />
          <View style={styles.copy}><View style={styles.byline}><Text style={[styles.name, item.unread && styles.nameUnread]} numberOfLines={1}>{name}</Text><Text style={styles.time}>{ago(item.createdAt)}</Text></View><Text style={[styles.preview, item.unread && styles.previewUnread]} numberOfLines={1}>{item.lastText || 'Media or activity'}</Text></View>
          {item.unread ? <View style={styles.unread} /> : null}
        </PressableScale>
      }}
    />
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  web: { minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, webText: { color: t.accent },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  rowUnread: { borderLeftWidth: 2, borderLeftColor: t.accent }, copy: { flex: 1, minWidth: 0 }, byline: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, color: t.text, fontSize: 14, fontWeight: '700' }, nameUnread: { color: t.text, fontWeight: '600' }, time: { color: t.textMuted, fontSize: 12 },
  preview: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }, previewUnread: { color: t.text }, unread: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.accent }, spinner: { marginVertical: 12 },
})
