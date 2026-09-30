import type { ComponentProps, JSX, ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import { PressableScale } from '../ios/PressableScale'
import { useTheme } from '../theme'
import { Text } from './Text'
import { hitTarget, radius, space } from './tokens'

type IconName = ComponentProps<typeof Ionicons>['name']

export function ListRow({ title, detail, icon, mark, trailing, onPress, label = title, style }: { title: string; detail?: string; icon?: IconName; mark?: string; trailing?: ReactNode; onPress?: () => void; label?: string; style?: StyleProp<ViewStyle> }): JSX.Element {
  const theme = useTheme()
  const content = (
    <>
      {icon || mark ? (
        <View style={[styles.leading, { backgroundColor: theme.surfaceAlt }]}>
          {icon ? <Ionicons name={icon} size={19} color={theme.textMuted} /> : <Text variant="label" weight="900">{mark}</Text>}
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text variant="body" weight="700" numberOfLines={1}>{title}</Text>
        {detail ? <Text variant="metadata" tone="muted" numberOfLines={2} style={styles.detail}>{detail}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} /> : null)}
    </>
  )

  if (!onPress) return <View style={[styles.row, { borderBottomColor: theme.border }, style]}>{content}</View>
  return (
    <PressableScale style={[styles.row, { borderBottomColor: theme.border }, style]} onPress={onPress} haptic="light" accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  leading: { width: hitTarget - 10, height: hitTarget - 10, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  detail: { marginTop: 2 },
})
