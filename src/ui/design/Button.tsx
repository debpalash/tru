import type { ComponentProps, JSX, ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import { PressableScale, type PressableScaleProps } from '../ios/PressableScale'
import { useTheme } from '../theme'
import { Text } from './Text'
import { hitTarget, radius, space } from './tokens'

type IconName = ComponentProps<typeof Ionicons>['name']
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = Omit<PressableScaleProps, 'children' | 'style'> & {
  label: string
  variant?: Variant
  icon?: IconName
  trailing?: ReactNode
  compact?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({ label, variant = 'secondary', icon, trailing, compact = false, disabled, style, accessibilityLabel = label, ...props }: ButtonProps): JSX.Element {
  const theme = useTheme()
  const backgroundColor = variant === 'primary' ? theme.accent
    : variant === 'danger' ? theme.negativeSoft
      : variant === 'secondary' ? theme.surfaceAlt
        : 'transparent'
  const tone = variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'negative' : variant === 'ghost' ? 'accent' : 'default'
  const iconColor = variant === 'primary' ? theme.onAccent : variant === 'danger' ? theme.negative : variant === 'ghost' ? theme.accent : theme.text
  return (
    <PressableScale
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), ...props.accessibilityState }}
      style={[styles.base, compact && styles.compact, { backgroundColor }, disabled && styles.disabled, style]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={iconColor} /> : null}
      <Text variant="label" tone={tone} weight="600">{label}</Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: hitTarget, paddingHorizontal: space.lg, borderRadius: radius.round, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: hitTarget, paddingHorizontal: space.sm },
  disabled: { opacity: 0.42 },
  trailing: { marginLeft: 'auto' },
})
