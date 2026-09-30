import { useCallback, useState, type JSX } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { searchX, searchXUsers } from '@/engine/x/client'
import type { XPage, XUserPage } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'
import { XUserList } from '@/ui/x/XUserList'

type SearchMode = 'Latest' | 'Top' | 'People' | 'Photos' | 'Videos'

export default function XSearchScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const { q = '' } = useLocalSearchParams<{ q?: string }>()
  const [input, setInput] = useState(q)
  const [query, setQuery] = useState(q)
  const [mode, setMode] = useState<SearchMode>('Latest')
  const postLoader = useCallback((cursor = ''): Promise<XPage> => query ? searchX(query, cursor, mode === 'People' ? 'Latest' : mode) : Promise.resolve({ posts: [] }), [mode, query])
  const userLoader = useCallback((cursor = ''): Promise<XUserPage> => query ? searchXUsers(query, cursor) : Promise.resolve({ users: [] }), [query])
  const submit = () => setQuery(input.trim())
  const header = <>
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={t.textMuted} />
      <TextInput value={input} onChangeText={setInput} onSubmitEditing={submit} style={styles.input} placeholder="Posts or people" placeholderTextColor={t.textMuted} returnKeyType="search" autoCapitalize="none" accessibilityLabel="Search X posts or people" />
      <PressableScale style={styles.button} onPress={submit} accessibilityRole="button" accessibilityLabel="Search X"><Ionicons name="arrow-forward" size={17} color={styles.buttonText.color} /></PressableScale>
    </View>
    <View style={styles.tabs}>{(['Latest', 'Top', 'People', 'Photos', 'Videos'] as const).map((item) => <PressableScale key={item} accessibilityRole="tab" accessibilityLabel={`${item} X search results`} accessibilityState={{ selected: mode === item }} style={[styles.tab, mode === item && styles.tabActive]} onPress={() => setMode(item)}><Text style={[styles.tabText, mode === item && styles.tabTextActive]}>{item}</Text></PressableScale>)}</View>
  </>
  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="X search" subtitle="Posts, people and operators" />
      {mode === 'People'
        ? <XUserList loader={userLoader} empty={query ? 'No matching people were returned.' : 'Enter a name or handle.'} header={header} />
        : <XTimeline loader={postLoader} empty={query ? 'No matching posts were returned.' : 'Enter a topic, handle, or X search operator.'} header={header} />}
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  search: { height: 52, flexDirection: 'row', paddingHorizontal: 10, gap: 8, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  input: { flex: 1, minWidth: 0, height: 48, color: t.text, fontSize: 14 },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: t.accent },
  buttonText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  tab: { flex: 1, minHeight: 48, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.accent },
  tabText: { color: t.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: t.text },
})
