import { useCallback, useState, type JSX } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { loadSavedFeedItems, type SavedFeedRecord } from '@/engine/feed/saved'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function LibraryScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [items, setItems] = useState<SavedFeedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      setItems(await loadSavedFeedItems())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Library" subtitle="Saved stories" />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<StateCard title={loading ? 'Loading library' : 'Nothing saved yet'} body={loading ? undefined : 'Save stories from Today to read them here.'} loading={loading} action={loading ? undefined : "Browse stories"} onAction={() => router.replace('/')} />}
        renderItem={({ item }) => (
          <PressableScale
            style={styles.row}
            onPress={() => router.push({ pathname: '/reader', params: { id: item.id } })}
            haptic={false}
            accessibilityRole="button"
            accessibilityLabel={`Open saved story: ${item.title}`}
          >
            <View style={styles.badge}><Text style={styles.badgeText}>{item.sourceShort.slice(0, 4)}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.meta}>{item.sourceName} · {item.evidenceScore}% {item.evidenceLabel.toLowerCase()} · {item.offlineText ? 'offline' : 'summary saved'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </PressableScale>
        )}
        refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
        contentContainerStyle={{ paddingBottom: 45 }}
      />
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({ screen: { flex: 1, backgroundColor: t.bg }, row: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, badge: { width: 40, height: 40, borderRadius: 10, marginRight: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt }, badgeText: { color: t.accent, fontSize: 12, fontWeight: '600' }, copy: { flex: 1 }, title: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600' }, meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }, chevron: { color: t.textMuted, fontSize: 23 } })
