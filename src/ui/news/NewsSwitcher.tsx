// Two-axis switcher for the News feed, modeled on HnFeed's segmented chip
// switcher: a category row (All · Tech · Dev · World) and, below it, a source
// row (All + each source in the active category) to pin one source or read the
// merged river. Default = "All / river".

import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useThemedStyles, type ThemeTokens } from '../theme'
import { haptics } from '../haptics'
import { PressableScale } from '@/ui/ios/PressableScale'
import { iosScrollProps } from '@/ui/ios/listProps'
import { CATEGORY_LABELS, type NewsCategory } from '../../engine/news/types'
import { activeCategories, sourcesFor } from '../../engine/news/registry'
import { useLocationProfile } from '../../engine/location'

import type { JSX } from "react";

interface Props {
  category: NewsCategory
  sourceId: string | null
  onCategory: (c: NewsCategory) => void
  onSource: (id: string | null) => void
  topInset: number
}

export function NewsSwitcher({
  category,
  sourceId,
  onCategory,
  onSource,
  topInset,
}: Props): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  useLocationProfile()
  const categories = activeCategories()
  const sources = sourcesFor(category)

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        {...iosScrollProps}
      >
        {categories.map((c) => {
          const active = c === category
          return (
            <PressableScale
              key={c}
              onPress={() => {
                if (c === category) return
                haptics.selection()
                onCategory(c)
              }}
              style={[styles.chip, active && styles.chipActive]}
              hitSlop={4}
              haptic={false}
              accessibilityRole="tab"
              accessibilityLabel={`${CATEGORY_LABELS[c]} news category`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {CATEGORY_LABELS[c]}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subStrip}
        {...iosScrollProps}
      >
        <PressableScale
          onPress={() => {
            if (sourceId === null) return
            haptics.selection()
            onSource(null)
          }}
          style={[styles.pill, sourceId === null && styles.pillActive]}
          hitSlop={4}
          haptic={false}
          accessibilityRole="tab"
          accessibilityLabel="All news sources"
          accessibilityState={{ selected: sourceId === null }}
        >
          <Text style={[styles.pillText, sourceId === null && styles.pillTextActive]}>All</Text>
        </PressableScale>

        {sources.map((s) => {
          const active = s.id === sourceId
          return (
            <PressableScale
              key={s.id}
              onPress={() => {
                if (s.id === sourceId) return
                haptics.selection()
                onSource(s.id)
              }}
              style={[styles.pill, active && { backgroundColor: s.color }]}
              hitSlop={4}
              haptic={false}
              accessibilityRole="tab"
              accessibilityLabel={`${s.name} news source`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.name}</Text>
            </PressableScale>
          )
        })}
      </ScrollView>
    </View>
  )
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      backgroundColor: t.bg,
    },
    strip: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    subStrip: {
      paddingHorizontal: 12,
      paddingTop: 2,
      paddingBottom: 8,
      gap: 6,
    },
    chip: {
      minHeight: 48,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 9999,
      backgroundColor: t.surface,
    },
    chipActive: {
      backgroundColor: t.accent,
    },
    chipText: {
      color: t.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    chipTextActive: {
      color: t.onAccent,
    },
    pill: {
      minHeight: 48,
      paddingHorizontal: 11,
      justifyContent: 'center',
      borderRadius: 9999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      backgroundColor: 'transparent',
    },
    pillActive: {
      backgroundColor: t.accent,
      borderColor: 'transparent',
    },
    pillText: {
      color: t.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    pillTextActive: {
      color: t.onAccent,
    },
  })
