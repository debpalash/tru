import type { JSX } from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '../ios/PressableScale'
import { useTheme } from '../theme'
import { Text } from './Text'
import { hitTarget, radius, space } from './tokens'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  accessibilityLabel?: string
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly SegmentOption<T>[]; onChange: (value: T) => void }): JSX.Element {
  const theme = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <PressableScale
            key={option.value}
            style={[styles.option, selected && { backgroundColor: theme.elevated, borderColor: theme.borderStrong }]}
            onPress={() => onChange(option.value)}
            haptic="selection"
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
          >
            <Text variant="label" tone={selected ? 'default' : 'muted'} weight={selected ? '800' : '600'}>{option.label}</Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { minHeight: hitTarget, padding: 4, borderRadius: radius.round, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 2 },
  option: { flex: 1, minHeight: hitTarget, paddingHorizontal: space.sm, borderRadius: radius.round, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
})
