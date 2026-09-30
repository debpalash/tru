import { memo, useCallback, useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import type { EvidenceLink, UnifiedFeedItem, WebVerificationState } from '@/engine/feed/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { timeAgoMs } from '@/ui/news/newsFormat'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XMediaPreview } from '@/ui/x/XMediaPreview'

interface Props {
  item: UnifiedFeedItem
  saved: boolean
  explain: boolean
  onOpen: (item: UnifiedFeedItem) => void
  onAsk: (item: UnifiedFeedItem) => void
  onToggleSaved: (id: string) => void
  onOpenEvidence: (link: EvidenceLink) => void
  verification?: WebVerificationState
  onVerify: (item: UnifiedFeedItem) => void
}

function UnifiedFeedRowImpl({ item, saved, explain, onOpen, onAsk, onToggleSaved, onOpenEvidence, verification, onVerify }: Props): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [detailsOpen, setDetailsOpen] = useState(false)
  useEffect(() => setDetailsOpen(false), [item.id])
  const expanded = explain || detailsOpen
  const open = useCallback(() => onOpen(item), [item, onOpen])
  const checking = verification?.kind === 'loading'

  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <PressableScale style={styles.story} onPress={open} haptic={false} scaleTo={0.995} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
          <View style={styles.byline}>
            <Text style={styles.publisher} numberOfLines={1}>{item.sourceName}</Text>
            {item.time ? <Text style={styles.time}>· {timeAgoMs(item.time)}</Text> : null}
            {saved ? <Ionicons name="bookmark" size={12} color={t.textMuted} /> : null}
          </View>
          <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        </PressableScale>
        <PressableScale style={styles.more} onPress={() => setDetailsOpen((value) => !value)} haptic={false} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${item.title}`}>
          <Ionicons name={expanded ? 'chevron-up' : 'ellipsis-horizontal'} size={18} color={t.textMuted} />
        </PressableScale>
      </View>

      {expanded ? (
        <View style={styles.details}>
          {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
          {item.xPost ? <XMediaPreview media={item.xPost.media} postUrl={item.url || `https://x.com/${item.xPost.user.username}/status/${item.xPost.id}`} sensitive={item.xPost.sensitive} compact /> : null}
          <View style={styles.actions}>
            <PressableScale style={styles.action} onPress={() => onToggleSaved(item.id)} accessibilityRole="button" accessibilityState={{ selected: saved }} accessibilityLabel={saved ? 'Remove from library' : 'Save to library'}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={t.text} /><Text style={styles.actionText}>{saved ? 'Saved' : 'Save'}</Text>
            </PressableScale>
            <PressableScale style={styles.action} onPress={() => onAsk(item)} accessibilityRole="button" accessibilityLabel={`Ask about ${item.title}`}>
              <Ionicons name="chatbubble-outline" size={16} color={t.text} /><Text style={styles.actionText}>Ask</Text>
            </PressableScale>
            <PressableScale style={[styles.action, checking && styles.disabled]} onPress={() => onVerify(item)} disabled={checking} accessibilityRole="button" accessibilityState={{ busy: checking, disabled: checking }} accessibilityLabel="Check other sources">
              {checking ? <ActivityIndicator size="small" color={t.text} /> : <Ionicons name="search-outline" size={16} color={t.text} />}<Text style={styles.actionText}>{checking ? 'Checking' : 'Check sources'}</Text>
            </PressableScale>
          </View>
          <Text style={styles.evidence}>{item.evidence.label} · {item.evidence.score}/100</Text>
          <Text style={styles.detailText}>{item.evidence.explanation}</Text>
          <Text style={styles.caveat}>Based on sources and headline support.</Text>
          {verification?.kind === 'done' ? <Text style={styles.detailText}>{verification.matched ? `${verification.matched} additional match${verification.matched === 1 ? '' : 'es'}` : 'No additional matches'} · {verification.credits} credits</Text> : null}
          {verification?.kind === 'error' ? <Text style={styles.error} accessibilityRole="alert">{verification.message}</Text> : null}
          {item.evidence.links.map((link) => (
            <PressableScale key={link.id} style={styles.evidenceLink} onPress={() => onOpenEvidence(link)} haptic={false} accessibilityRole="link" accessibilityLabel={`Open source: ${link.publisher}`}>
              <View style={styles.evidenceCopy}><Text style={styles.evidencePublisher}>{link.publisher}</Text><Text style={styles.detailText} numberOfLines={1}>{link.title}</Text></View>
              <Ionicons name="open-outline" size={15} color={t.textMuted} />
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export const UnifiedFeedRow = memo(UnifiedFeedRowImpl)

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  main: { flexDirection: 'row', alignItems: 'flex-start' },
  story: { flex: 1, minWidth: 0, minHeight: 48 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  publisher: { flexShrink: 1, color: t.textMuted, fontSize: 12, lineHeight: 18 },
  time: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  title: { color: t.text, fontSize: 16, lineHeight: 23, fontWeight: '600', letterSpacing: -0.15 },
  more: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginRight: -12 },
  details: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: t.surface },
  summary: { color: t.text, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  action: { minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: t.text, fontSize: 13, fontWeight: '600' },
  evidence: { color: t.text, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  detailText: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  caveat: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  error: { color: t.negative, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  disabled: { opacity: 0.5 },
  evidenceLink: { minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  evidenceCopy: { flex: 1, minWidth: 0 },
  evidencePublisher: { color: t.text, fontSize: 13, fontWeight: '600' },
})
