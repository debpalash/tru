import type { ComponentProps, JSX } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import { PressableScale, type PressableScaleProps } from '../ios/PressableScale'
import { useTheme } from '../theme'
import { hitTarget, radius } from './tokens'

type IconName = ComponentProps<typeof Ionicons>['name']

export type IconButtonProps = Omit<PressableScaleProps, 'children' | 'style'> & {
  icon: IconName
  label: string
  selected?: boolean
  destructive?: boolean
  style?: StyleProp<ViewStyle>
}

export function IconButton({ icon, label, selected = false, destructive = false, style, accessibilityState, ...props }: IconButtonProps): JSX.Element {
  const theme = useTheme()
  const color = destructive ? theme.negative : selected ? theme.accent : theme.textMuted
  return (
    <PressableScale
      {...props}
      style={[styles.button, selected && { backgroundColor: theme.accentSoft }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, ...accessibilityState }}
    >
      <Ionicons name={icon} size={20} color={color} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: { width: hitTarget, height: hitTarget, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
})
