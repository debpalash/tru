import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'

import { setXFollow } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XUser, XUserPage } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XAvatar } from './XAvatar'

function compact(value?: number): string {
  const n = value ?? 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

function UserRow({ user }: { user: XUser }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const [following, setFollowing] = useState(Boolean(user.followedByMe))
  const [pending, setPending] = useState(false)
  const own = session?.userId === user.id || session?.username?.toLowerCase() === user.username.toLowerCase()
  const toggle = async () => {
    if (pending || own) return
    const before = following
    setFollowing(!before)
    setPending(true)
    try { await setXFollow(user.id, !before) }
    catch (error) {
      setFollowing(before)
      Alert.alert('Follow failed', error instanceof Error ? error.message : 'Try again shortly.')
    } finally { setPending(false) }
  }
  return (
    <View style={styles.row}>
      <PressableScale
        style={styles.avatarButton}
        haptic={false}
        onPress={() => router.push({ pathname: '/x/profile', params: { username: user.username } })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${user.name}'s profile`}
      >
        <XAvatar url={user.avatar} name={user.name} size={34} />
      </PressableScale>
      <PressableScale
        style={styles.copy}
        haptic={false}
        scaleTo={0.995}
        onPress={() => router.push({ pathname: '/x/profile', params: { username: user.username } })}
        accessibilityRole="button"
        accessibilityLabel={`${user.name}, @${user.username}, ${compact(user.followers)} followers${user.bio ? `. ${user.bio}` : ''}`}
      >
        <Text style={styles.name} numberOfLines={1}>{user.name}{user.verified ? '  ✓' : ''}</Text>
        <Text style={styles.handle}>@{user.username} · {compact(user.followers)} followers</Text>
        {user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}
      </PressableScale>
      {!own ? (
        <PressableScale
          style={[styles.follow, following && styles.following]}
          disabled={pending}
          onPress={() => void toggle()}
          accessibilityRole="button"
          accessibilityLabel={following ? `Unfollow ${user.name}` : `Follow ${user.name}`}
          accessibilityState={{ selected: following, disabled: pending }}
        >
          <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Following' : 'Follow'}</Text>
        </PressableScale>
      ) : null}
    </View>
  )
}

export function XUserList({ loader, header, empty = 'No people were returned.' }: { loader: (cursor?: string) => Promise<XUserPage>; header?: ReactNode; empty?: string }): JSX.Element {
  const t = useTheme()
  const session = useXSession()
  const mounted = useRef(true)
  const [users, setUsers] = useState<XUser[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { mounted.current = false }, [])
  const load = useCallback(async (refresh = false, nextCursor = '') => {
    if (!session) { setLoading(false); setUsers([]); return }
    if (nextCursor) setLoadingMore(true)
    else if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const page = await loader(nextCursor)
      if (!mounted.current) return
      setUsers((current) => {
        if (!nextCursor) return page.users
        const seen = new Set(current.map((user) => user.id))
        return [...current, ...page.users.filter((user) => !seen.has(user.id))]
      })
      setCursor(page.cursor)
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : 'X could not load people.')
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); setLoadingMore(false) }
    }
  }, [loader, session])
  useEffect(() => { void load() }, [load])

  const state = !session
    ? <StateCard title="Connect X" body="Sign in to load people." action="Connect" onAction={() => router.push('/x/login')} />
    : loading
      ? <StateCard title="Loading people" loading />
      : error && !users.length
        ? <StateCard title="X needs attention" body={error} action="Retry" onAction={() => void load()} />
        : !users.length
          ? <StateCard title="Nothing here yet" body={empty} action="Refresh" onAction={() => void load(true)} />
          : null

  return <FlashList
    data={state ? [] : users}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => <UserRow user={item} />}
    ListHeaderComponent={<View>{header}{state}</View>}
    ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.spinner} color={t.accent} /> : null}
    refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
    onEndReached={() => { if (cursor && !loadingMore) void load(false, cursor) }}
    onEndReachedThreshold={0.55}
    contentContainerStyle={{ paddingBottom: 40 }}
  />
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 9, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  avatarButton: { width: 48, minHeight: 48, marginLeft: -5, marginRight: 2, alignItems: 'center', justifyContent: 'flex-start' },
  copy: { flex: 1, minWidth: 0, paddingBottom: 2 },
  name: { color: t.text, fontSize: 14, fontWeight: '600' },
  handle: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  bio: { color: t.text, fontSize: 14, lineHeight: 18, marginTop: 3 },
  follow: { minWidth: 72, height: 48, marginLeft: 6, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.text },
  following: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  followText: { color: t.bg, fontSize: 14, fontWeight: '600' },
  followingText: { color: t.text },
  spinner: { marginVertical: 12 },
})

const styles = StyleSheet.create({ spinner: { marginVertical: 12 } })
