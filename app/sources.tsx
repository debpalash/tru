import type { JSX } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { NEWS_SOURCES, sourceCoverageLabel, sourcesFor, TRUSTED_PUBLISHERS } from '@/engine/news/registry'
import { useLocationProfile } from '@/engine/location'
import { PressableScale } from '@/ui/ios/PressableScale'
import { openLink } from '@/ui/openLink'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function SourcesScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const location = useLocationProfile()
  const evidenceOnly = TRUSTED_PUBLISHERS.filter((publisher) => !NEWS_SOURCES.some((source) => source.id === publisher.id))
  const nearby = sourcesFor('all')
  const nearbyIds = new Set(nearby.map((source) => source.id))
  const otherRegions = NEWS_SOURCES.filter((source) => !nearbyIds.has(source.id))

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Sources" subtitle={`${NEWS_SOURCES.length} sources · ${location.name}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={18} color={t.textMuted} />
          <Text style={styles.noteText}>Citations link to listed publishers. Independent reports strengthen a story’s evidence.</Text>
        </View>

        <Text style={styles.section}>In your mix · {nearby.length}</Text>
        <View style={styles.group}>
          {nearby.map((source) => (
            <PressableScale
              key={source.id}
              style={styles.row}
              onPress={() => source.homeUrl && openLink(source.homeUrl, source.name)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${source.name}`}
            >
              <Text style={[styles.mark, { color: source.color }]}>{source.short.slice(0, 3)}</Text>
              <View style={styles.copy}>
                <Text style={styles.name}>{source.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{sourceCoverageLabel(source)} · {source.trustedHosts[0]}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={t.textMuted} />
            </PressableScale>
          ))}
        </View>

        <Text style={styles.section}>Available elsewhere · {otherRegions.length}</Text>
        <View style={styles.group}>
          {otherRegions.map((source) => (
            <PressableScale key={source.id} style={styles.row} onPress={() => source.homeUrl && openLink(source.homeUrl, source.name)} accessibilityRole="link" accessibilityLabel={`Open ${source.name}`}>
              <Text style={[styles.mark, { color: source.color }]}>{source.short.slice(0, 3)}</Text>
              <View style={styles.copy}><Text style={styles.name}>{source.name}</Text><Text style={styles.meta} numberOfLines={1}>{sourceCoverageLabel(source)} · {source.trustedHosts[0]}</Text></View>
              <Ionicons name="open-outline" size={16} color={t.textMuted} />
            </PressableScale>
          ))}
        </View>

        <Text style={styles.section}>Verification only</Text>
        <View style={styles.group}>
          {evidenceOnly.map((source) => (
            <View key={source.id} style={styles.smallRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={t.textMuted} />
              <View style={styles.copy}>
                <Text style={styles.smallName}>{source.name}</Text>
                <Text style={styles.smallMeta} numberOfLines={1}>{source.evidenceRole} · {source.trustedHosts[0]}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingBottom: 32 },
  note: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', gap: 9, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  noteText: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18 },
  section: { minHeight: 34, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  mark: { width: 42, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: t.text, fontSize: 14, fontWeight: '600' },
  meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  smallRow: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', gap: 9, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  smallName: { color: t.text, fontSize: 14, fontWeight: '600' },
  smallMeta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
})
