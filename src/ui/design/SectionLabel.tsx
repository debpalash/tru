import type { JSX } from 'react'
import { StyleSheet } from 'react-native'

import { Text } from './Text'
import { space } from './tokens'

export function SectionLabel({ children }: { children: string }): JSX.Element {
  return <Text variant="metadata" tone="muted" weight="600" style={styles.label}>{children.toUpperCase()}</Text>
}

const styles = StyleSheet.create({
  label: { paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.sm, letterSpacing: 0.45 },
})
