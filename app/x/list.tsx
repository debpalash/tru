import { useCallback, useState, type JSX } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXListMembers, fetchXListPosts } from '@/engine/x/client'
import type { XPage, XUserPage } from '@/engine/x/types'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'
import { XUserList } from '@/ui/x/XUserList'
import { PressableScale } from '@/ui/ios/PressableScale'

export default function XListScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const { id = '', name = 'X list', kind = 'list' } = useLocalSearchParams<{ id?: string; name?: string; kind?: string }>()
  const listKind = kind === 'community' ? 'community' : 'list'
  const [tab, setTab] = useState<'posts' | 'members'>('posts')
  const loader = useCallback((cursor = ''): Promise<XPage> => id ? fetchXListPosts(id, listKind, cursor) : Promise.resolve({ posts: [] }), [id, listKind])
  const memberLoader = useCallback((cursor = ''): Promise<XUserPage> => id && listKind === 'list' ? fetchXListMembers(id, cursor) : Promise.resolve({ users: [] }), [id, listKind])
  const tabs = listKind === 'list' ? <View style={styles.tabs}>{(['posts', 'members'] as const).map((item) => <PressableScale key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)} accessibilityRole="tab" accessibilityLabel={`${name} ${item}`} accessibilityState={{ selected: tab === item }}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item[0].toUpperCase() + item.slice(1)}</Text></PressableScale>)}</View> : null
  return <SafeAreaView style={styles.screen}>
    <AppHeader title={name} subtitle={listKind === 'community' ? 'X community timeline' : 'X list timeline'} />
    {tab === 'members' && listKind === 'list'
      ? <XUserList loader={memberLoader} header={tabs} empty="No members were returned." />
      : <XTimeline loader={loader} header={tabs} empty="No posts were returned from this timeline." />}
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  tabs: { minHeight: 48, flexDirection: 'row', padding: 3, margin: 8, borderRadius: 10, backgroundColor: t.surface },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: t.surfaceAlt },
  tabText: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: t.accent },
})
