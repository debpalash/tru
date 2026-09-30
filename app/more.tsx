import type { ComponentProps, JSX } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { PressableScale } from '@/ui/ios/PressableScale'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

type IconName = ComponentProps<typeof Ionicons>['name']
type WorkspaceItem = { icon?: IconName; mark?: string; title: string; body: string; href: string }

const groups: ReadonlyArray<{ label: string; items: readonly WorkspaceItem[] }> = [
  { label: 'Explore', items: [
    { mark: 'X', title: 'X', body: 'Following, search, profiles and threads', href: '/x' },
    { icon: 'earth-outline', title: 'World', body: 'World news and topics', href: '/world' },
        { icon: 'logo-hackernews', title: 'Hacker News', body: 'Stories and discussions', href: '/hn' },
  ] },
  { label: 'Workspace', items: [
    { icon: 'bookmark-outline', title: 'Library', body: 'Saved stories and evidence', href: '/library' },
    { icon: 'notifications-outline', title: 'Monitors', body: 'Topic rules and local alerts', href: '/monitors' },
    { icon: 'play-circle-outline', title: 'Media', body: 'General-audience reporting', href: '/media' },
    { icon: 'radio-outline', title: 'Sources', body: 'Feeds and verified domains', href: '/sources' },
  ] },
  { label: 'Account', items: [
    { icon: 'shield-checkmark-outline', title: 'Privacy & data', body: 'Data use and storage', href: '/privacy' },
    { icon: 'create-outline', title: 'New X post', body: 'Compose for the connected account', href: '/x/compose' },
    { icon: 'mail-outline', title: 'X messages', body: 'Authenticated inbox', href: '/x/messages' },
    { icon: 'at-outline', title: 'X alerts', body: 'Mentions and engagement', href: '/x/notifications' },
    { icon: 'settings-outline', title: 'Settings', body: 'Appearance, AI and privacy', href: '/settings' },
  ] },
]

export default function MoreScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <AppHeader back={false} title="Tru" subtitle="Find the facts. Keep your privacy." />
      <ScrollView contentContainerStyle={styles.content}>
        {groups.map((group) => (
          <View key={group.label}>
            <Text style={styles.section}>{group.label}</Text>
            <View style={styles.group}>
              {group.items.map((item) => (
                <PressableScale
                  key={item.title}
                  style={styles.row}
                  onPress={() => router.push(item.href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <View style={styles.icon}>
                    {item.icon
                      ? <Ionicons name={item.icon} size={18} color={styles.iconText.color} />
                      : <Text style={styles.iconText}>{item.mark}</Text>}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.body} numberOfLines={1}>{item.body}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={styles.chevron.color} />
                </PressableScale>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingBottom: 28 },
  section: { minHeight: 32, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4 },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  icon: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  iconText: { color: t.textMuted, fontSize: 15, fontWeight: '600' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: t.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  body: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  chevron: { color: t.textMuted },
})
