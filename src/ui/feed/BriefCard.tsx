import { memo, useState, type JSX } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import type { UnifiedFeedItem } from '@/engine/feed/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

interface Props {
  initiallyExpanded?: boolean
  items: UnifiedFeedItem[]
  sourceCount: number
  agentReady: boolean
  onAskBrief: () => void
  onConfigure: () => void
  onOpenItem: (item: UnifiedFeedItem) => void
}

function BriefCardImpl({ initiallyExpanded = false, items, sourceCount, agentReady, onAskBrief, onConfigure, onOpenItem }: Props): JSX.Element | null {
  const styles = useThemedStyles(makeStyles)
  const [expanded, setExpanded] = useState(initiallyExpanded)
  if (!items.length) return null

  return (
    <View style={styles.card}>
      <PressableScale
        style={styles.summary}
        haptic={false}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} cited brief`}
        onPress={() => setExpanded((value) => !value)}
      >
        <View style={styles.mark}><Text style={styles.markText}>T</Text></View>
        <View style={styles.summaryCopy}>
          <Text style={styles.title}>Brief</Text>
          <Text style={styles.meta} numberOfLines={1}>{items.length} priorities from {sourceCount} sources</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={styles.chevron.color} />
      </PressableScale>

      {expanded ? (
        <View style={styles.details}>
          {items.map((item, index) => (
            <PressableScale key={item.id} style={styles.point} onPress={() => onOpenItem(item)} haptic={false} accessibilityRole="button" accessibilityLabel={`Open priority ${index + 1}: ${item.title}`}>
              <Text style={styles.number}>{index + 1}</Text>
              <Text style={styles.pointTitle} numberOfLines={2}>{item.title}</Text>
              <View style={[styles.scoreDot, { backgroundColor: item.evidence.score >= 72 ? styles.strong.color : styles.caution.color }]} />
              <Text style={styles.score}>{item.evidence.score}</Text>
            </PressableScale>
          ))}
          <PressableScale style={styles.action} onPress={agentReady ? onAskBrief : onConfigure} haptic="light" accessibilityRole="button" accessibilityLabel={agentReady ? 'Generate cited brief' : 'Set up AI'}>
            <Text style={styles.actionText}>{agentReady ? 'Generate cited brief' : 'Set up AI'}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  )
}

export const BriefCard = memo(BriefCardImpl)

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    borderRadius: 10,
    backgroundColor: t.surface,
    overflow: 'hidden',
  },
  summary: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  mark: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt, marginRight: 9 },
  markText: { color: t.text, fontSize: 12, fontWeight: '600' },
  summaryCopy: { flex: 1, minWidth: 0 },
  title: { color: t.text, fontSize: 14, fontWeight: '600' },
  meta: { color: t.textMuted, fontSize: 12, marginTop: 1 },
  chevron: { color: t.textMuted },
  details: { paddingHorizontal: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  point: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  number: { width: 22, color: t.textMuted, fontSize: 12, fontWeight: '600' },
  pointTitle: { flex: 1, color: t.text, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  scoreDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 8 },
  score: { width: 26, color: t.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  strong: { color: t.positive },
  caution: { color: t.warning },
  action: { minHeight: 48, marginTop: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
  actionText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
})
