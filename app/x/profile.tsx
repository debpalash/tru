import { useCallback, useEffect, useState, type JSX } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchXUser, fetchXUserPosts, setXFollow } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XPage, XUser } from '@/engine/x/types'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'
import { PressableScale } from '@/ui/ios/PressableScale'
import { XAvatar, XBanner } from '@/ui/x/XAvatar'

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes'

function compact(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

export default function XProfileScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const { username = '' } = useLocalSearchParams<{ username?: string }>()
  const [user, setUser] = useState<XUser | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [following, setFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [profileReload, setProfileReload] = useState(0)
  useEffect(() => {
    let live = true
    if (!username) return
    setProfileError(null)
    setUser(null)
    void fetchXUser(username).then((next) => { if (live) { setUser(next); setFollowing(Boolean(next.followedByMe)) } }).catch((error) => { if (live) setProfileError(error instanceof Error ? error.message : 'Profile unavailable.') })
    return () => { live = false }
  }, [profileReload, username])
  const loader = useCallback((cursor = ''): Promise<XPage> => user ? fetchXUserPosts(user.id, cursor, tab, user.username) : Promise.resolve({ posts: [] }), [tab, user])
  const own = Boolean(user && (session?.userId === user.id || session?.username?.toLowerCase() === user.username.toLowerCase()))
  const toggleFollow = async () => {
    if (!user || followPending || own) return
    const before = following
    setFollowing(!before); setFollowPending(true)
    try { await setXFollow(user.id, !before) }
    catch (error) { setFollowing(before); Alert.alert('Follow failed', error instanceof Error ? error.message : 'Try again shortly.') }
    finally { setFollowPending(false) }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title={user?.name ?? `@${username}`} subtitle="X profile" />
      {!user ? <StateCard title={profileError ? 'Profile unavailable' : 'Loading profile'} body={profileError ?? undefined} loading={!profileError} action={profileError ? 'Retry' : undefined} onAction={profileError ? () => setProfileReload((value) => value + 1) : undefined} /> : <XTimeline loader={loader} empty="No posts were returned for this profile." header={(
        <View style={styles.profile}>
          <XBanner url={user.banner} name={user.name} />
          <View style={styles.profileInfo}><View style={styles.avatar}><XAvatar url={user.avatar} name={user.name} size={44} safeCheck /></View>
          <View style={styles.profileCopy}><View style={styles.nameRow}><Text style={styles.name}>{user.name}</Text>{user.verified ? <Ionicons name="checkmark-circle" size={14} color={styles.verified.color} /> : null}</View><Text style={styles.handle}>@{user.username}</Text></View>
          {!own ? <PressableScale style={[styles.follow, following && styles.following]} disabled={followPending} onPress={() => void toggleFollow()} accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${user.name}` : `Follow ${user.name}`} accessibilityState={{ selected: following, disabled: followPending }}><Text style={[styles.followText, following && styles.followingText]}>{following ? 'Following' : 'Follow'}</Text></PressableScale> : null}
          <View style={styles.statsRow}><PressableScale style={styles.statAction} onPress={() => router.push({ pathname: '/x/connections', params: { userId: user.id, username: user.username, kind: 'following' } })} accessibilityRole="button" accessibilityLabel={`${compact(user.following)} accounts followed by ${user.name}`}><Text style={styles.stats}><Text style={styles.strong}>{compact(user.following)}</Text> following</Text></PressableScale><PressableScale style={styles.statAction} onPress={() => router.push({ pathname: '/x/connections', params: { userId: user.id, username: user.username, kind: 'followers' } })} accessibilityRole="button" accessibilityLabel={`${compact(user.followers)} followers of ${user.name}`}><Text style={styles.stats}><Text style={styles.strong}>{compact(user.followers)}</Text> followers</Text></PressableScale><PressableScale style={styles.analytics} onPress={() => router.push({ pathname: '/x/analytics', params: { username: user.username } })} accessibilityRole="button" accessibilityLabel={`Open analytics for ${user.name}`}><Ionicons name="bar-chart-outline" size={14} color={styles.analyticsText.color} /><Text style={styles.analyticsText}>Analytics</Text></PressableScale></View>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>
          <View style={styles.tabs}>{(['posts', 'replies', 'media', 'likes'] as const).map((item) => <PressableScale key={item} accessibilityRole="tab" accessibilityLabel={`${user.name}'s ${item}`} accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item[0].toUpperCase() + item.slice(1)}</Text></PressableScale>)}</View>
        </View>
      )} />}
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  profile: { paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  profileInfo: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 5 },
  avatar: { position: 'absolute', left: 10, top: -27, padding: 2, borderRadius: 16, backgroundColor: t.bg },
  profileCopy: { minHeight: 36, paddingLeft: 53 },
  nameRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  name: { color: t.text, fontSize: 14, fontWeight: '600' }, verified: { color: t.accent },
  handle: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  follow: { position: 'absolute', right: 7, top: 3, minWidth: 76, height: 48, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.text },
  following: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  followText: { color: t.bg, fontSize: 14, fontWeight: '600' }, followingText: { color: t.text },
  statsRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  statAction: { minHeight: 48, paddingRight: 9, justifyContent: 'center' },
  stats: { color: t.textMuted, fontSize: 12 },
  strong: { color: t.text, fontWeight: '600' },
  bio: { color: t.text, fontSize: 14, lineHeight: 18, marginTop: 5 },
  analytics: { minHeight: 48, marginLeft: 'auto', paddingHorizontal: 6, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }, analyticsText: { color: t.accent, fontSize: 12, fontWeight: '600' },
  tabs: { height: 48, flexDirection: 'row', marginTop: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.accent },
  tabText: { color: t.textMuted, fontSize: 12, fontWeight: '700' }, tabTextActive: { color: t.text },
})
