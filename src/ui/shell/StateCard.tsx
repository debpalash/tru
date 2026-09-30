import type { JSX } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Button, Text, radius, space } from '../design'
import { useTheme, useThemedStyles, type ThemeTokens } from '../theme'

export function StateCard({ title, body, action, onAction, loading = false }: { title: string; body?: string; action?: string; onAction?: () => void; loading?: boolean }): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  return (
    <View style={styles.card}>
      {loading ? <ActivityIndicator size="small" color={t.accent} /> : null}
      <View style={styles.copy}>
        <Text variant="label" weight="600">{title}</Text>
        {body ? <Text variant="metadata" tone="muted" style={styles.body}>{body}</Text> : null}
      </View>
      {action && onAction ? <Button compact variant="primary" label={action} onPress={onAction} /> : null}
    </View>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  card: { marginHorizontal: space.lg, marginVertical: space.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: radius.md, backgroundColor: t.surface },
  copy: { flex: 1, minWidth: 0 },
  body: { marginTop: space.xs },
})
