import type { JSX, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import { Text } from '../design/Text'
import { hitTarget, space } from '../design/tokens'
import { PressableScale } from '../ios/PressableScale'
import { useThemedStyles, type ThemeTokens } from '../theme'

export function AppHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  return (
    <View style={styles.header}>
      {back ? (
        <PressableScale style={styles.back} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/') }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={styles.backGlyph.color} />
        </PressableScale>
      ) : <View style={styles.rootInset} />}
      <View style={styles.copy}>
        <Text variant="title" weight="600" style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="metadata" tone="muted" style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0, borderBottomColor: t.border, backgroundColor: t.bg },
  back: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  rootInset: { width: 16 },
  backGlyph: { color: t.text },
  copy: { flex: 1, minWidth: 0 },
  title: { letterSpacing: -0.25 },
  subtitle: { marginTop: 2 },
  right: { minWidth: hitTarget, alignItems: 'center', justifyContent: 'center', paddingRight: space.xs },
})
