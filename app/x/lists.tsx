import { useCallback, useEffect, useState, type JSX } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchXLists } from '@/engine/x/client'
import type { XList } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function XListsScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const [lists, setLists] = useState<XList[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try { setLists(await fetchXLists()) } catch (e) { setError(e instanceof Error ? e.message : 'Lists unavailable.') }
  }, [])
  useEffect(() => { void load() }, [load])
  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="X lists" subtitle="Owned, joined and pinned lists" />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <StateCard title="Lists need attention" body={error} action="Retry" onAction={() => void load()} /> : null}
        {!error && !lists.length ? <StateCard title="No lists or communities" body="Create, join or pin one on X, then refresh this account view." action="Open X lists" onAction={() => router.push('/browser?url=https%3A%2F%2Fx.com%2Fi%2Flists&title=X%20lists')} /> : null}
        {lists.map((list) => <PressableScale key={list.id} style={styles.row} onPress={() => router.push({ pathname: '/x/list', params: { id: list.id, name: list.name, kind: list.kind } })} accessibilityRole="button" accessibilityLabel={list.name}><View style={styles.mark}><Ionicons name={list.kind === 'community' ? 'people-outline' : 'list-outline'} size={18} color={styles.markText.color} /></View><View style={styles.copy}><Text style={styles.title}>{list.name}</Text>{list.description ? <Text style={styles.body} numberOfLines={2}>{list.description}</Text> : null}<Text style={styles.meta}>{list.members ? `${list.members} members` : list.kind === 'community' ? 'X community' : 'X list'}{list.owner ? ` · @${list.owner}` : ''}</Text></View><Ionicons name="chevron-forward" size={16} color={styles.chevron.color} /></PressableScale>)}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, content: { paddingBottom: 35 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, backgroundColor: t.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  mark: { width: 42, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: 5 }, markText: { color: t.textMuted },
  copy: { flex: 1 }, title: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600' }, body: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 }, meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 }, chevron: { color: t.textMuted },
})
