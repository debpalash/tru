import { useCallback, useState, type JSX } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchXHome, type XHomeFeed } from '@/engine/x/client'
import { useXMediaMode } from '@/engine/x/mediaPreference'
import { useXSession } from '@/engine/x/session'
import { IconButton } from '@/ui/design'
import { PressableScale } from '@/ui/ios/PressableScale'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'

export default function XScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const mediaMode = useXMediaMode()
  const [feed, setFeed] = useState<XHomeFeed>('following')
  const loader = useCallback((cursor = '') => fetchXHome(cursor, feed), [feed])
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <AppHeader
        back={false}
        title="X"
        subtitle={session?.username ? `@${session.username} · ${mediaMode === 'safe' ? 'Safe media' : 'Hide media media'}` : 'Connect your account feed'}
        right={session ? (
          <View style={styles.headerActions}>
            <IconButton icon="search-outline" label="Search X" onPress={() => router.push('/x/search')} haptic={false} />
            <IconButton icon="person-circle-outline" label="X account" onPress={() => router.push('/x/login')} haptic={false} />
          </View>
        ) : (
          <PressableScale style={styles.connect} onPress={() => router.push('/x/login')} accessibilityRole="button" accessibilityLabel="Connect X"><Text style={styles.connectText}>Connect</Text></PressableScale>
        )}
      />
      <View style={styles.feedTabs} accessibilityRole="tablist">
        {([
          { value: 'for-you', label: 'For you' },
          { value: 'following', label: 'Following' },
        ] as const).map((item) => <PressableScale
          key={item.value}
          style={[styles.feedTab, feed === item.value && styles.feedTabActive]}
          onPress={() => setFeed(item.value)}
          haptic="selection"
          accessibilityRole="tab"
          accessibilityLabel={`${item.label} X feed`}
          accessibilityState={{ selected: feed === item.value }}
        ><Text style={[styles.feedTabText, feed === item.value && styles.feedTabTextActive]}>{item.label}</Text></PressableScale>)}
      </View>
      <XTimeline key={feed} loader={loader} empty={feed === 'following' ? 'Accounts you follow have not posted yet.' : 'X did not return recommendations for this account.'} />
      {session ? (
        <PressableScale style={styles.compose} onPress={() => router.push('/x/compose')} haptic="medium" accessibilityRole="button" accessibilityLabel="Compose X post">
          <Ionicons name="add" size={28} color={styles.composeGlyph.color} />
        </PressableScale>
      ) : null}
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  connect: { minHeight: 48, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  connectText: { color: t.accent, fontSize: 14, fontWeight: '600' },
  feedTabs: { height: 48, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  feedTab: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  feedTabActive: { borderBottomColor: t.accent },
  feedTabText: { color: t.textMuted, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  feedTabTextActive: { color: t.text, fontWeight: '600' },
  compose: { position: 'absolute', right: 16, bottom: 16, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent, elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  composeGlyph: { color: t.onAccent },
})
