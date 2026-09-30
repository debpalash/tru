// One river row: rank number, title (2 lines), an optional description, and a
// meta line with a colored source badge, the hotness/score, and relative time.
// Tapping the row opens the article in the IN-APP browser via
// ui/openLink. The reader mode that was once filed as P2/P3 already exists.
// it lives in app/browser.tsx, which is what this now routes to.

import { memo, useCallback, type JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native'

import { useThemedStyles, type ThemeTokens } from '../theme'
import { haptics } from '../haptics'
import { PressableScale } from '@/ui/ios/PressableScale'
import { timeAgoMs } from './newsFormat'
import { getSource } from '../../engine/news/registry'
import type { NewsItem } from '../../engine/news/types'

interface Props {
  item: NewsItem
  rank: number
  onOpen: (item: NewsItem) => void
}

function NewsRowImpl({ item, rank, onOpen }: Props): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const source = getSource(item.sourceId)
  const badgeColor = source?.color ?? '#888'
  const badgeLabel = source?.short ?? item.sourceId

  const open = useCallback(() => {
    haptics.selection()
    onOpen(item)
  }, [item, onOpen])

  const time = timeAgoMs(item.time)

  return (
    <PressableScale
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={open}
      haptic={false}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${badgeLabel}${item.info ? `, ${item.info}` : ''}${time ? `, ${time} ago` : ''}`}
    >
      <Text style={styles.rank}>{rank}</Text>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.hover ? (
          <Text style={styles.desc} numberOfLines={1}>
            {item.hover}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View
            style={[styles.badge, { backgroundColor: `${badgeColor}22`, borderColor: `${badgeColor}66` }]}
          >
            <Text style={[styles.badgeText, { color: badgeColor }]} numberOfLines={1}>
              {badgeLabel}
            </Text>
          </View>

          {item.info ? <Text style={styles.info}>{item.info}</Text> : null}
          {time ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{time}</Text>
            </>
          ) : null}
        </View>
      </View>
    </PressableScale>
  )
}

// Perf: by-id/field comparator so rows recycled by FlashList don't re-render
// unless their own displayed fields (or rank/onOpen) actually changed.
export const NewsRow = memo(
  NewsRowImpl,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.title === next.item.title &&
    prev.item.hover === next.item.hover &&
    prev.item.info === next.item.info &&
    prev.item.time === next.item.time &&
    prev.item.sourceId === next.item.sourceId &&
    prev.rank === next.rank &&
    prev.onOpen === next.onOpen
)

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      backgroundColor: t.bg,
    },
    rowPressed: {
      backgroundColor: t.surface,
    },
    rank: {
      width: 26,
      color: t.textMuted,
      fontSize: 14,
      fontWeight: '700',
      paddingTop: 1,
    },
    body: {
      flex: 1,
    },
    title: {
      color: t.text,
      fontSize: 15.5,
      fontWeight: '600',
      lineHeight: 20,
    },
    desc: {
      color: t.textMuted,
      fontSize: 14,
      marginTop: 3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: StyleSheet.hairlineWidth,
      marginRight: 8,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    info: {
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    meta: {
      color: t.textMuted,
      fontSize: 14,
    },
    dot: {
      color: t.textMuted,
      fontSize: 14,
      marginHorizontal: 5,
    },
  })
