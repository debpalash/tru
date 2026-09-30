import { forwardRef, type ComponentRef } from 'react'
import { StyleSheet, Text as NativeText, type TextProps as NativeTextProps, type TextStyle } from 'react-native'

import { useTheme } from '../theme'
import { lineHeight, typeScale } from './tokens'

export type TextVariant = keyof typeof typeScale
export type TextTone = 'default' | 'muted' | 'subtle' | 'accent' | 'positive' | 'warning' | 'negative' | 'onAccent'

export type TextProps = NativeTextProps & {
  variant?: TextVariant
  tone?: TextTone
  weight?: TextStyle['fontWeight']
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text(
  { variant = 'body', tone = 'default', weight, style, ...props },
  ref,
) {
  const theme = useTheme()
  const color = tone === 'muted' ? theme.textMuted
    : tone === 'subtle' ? theme.textSubtle
      : tone === 'accent' ? theme.accent
        : tone === 'positive' ? theme.positive
          : tone === 'warning' ? theme.warning
            : tone === 'negative' ? theme.negative
              : tone === 'onAccent' ? theme.onAccent
                : theme.text
  return <NativeText ref={ref} {...props} allowFontScaling style={[styles[variant], { color }, weight ? { fontWeight: weight } : null, style]} />
})

const styles = StyleSheet.create({
  metadata: { fontSize: typeScale.metadata, lineHeight: lineHeight.metadata },
  label: { fontSize: typeScale.label, lineHeight: lineHeight.label },
  body: { fontSize: typeScale.body, lineHeight: lineHeight.body },
  title: { fontSize: typeScale.title, lineHeight: lineHeight.title, letterSpacing: -0.15 },
  heading: { fontSize: typeScale.heading, lineHeight: lineHeight.heading, letterSpacing: -0.3 },
  display: { fontSize: typeScale.display, lineHeight: lineHeight.display, letterSpacing: -0.5 },
})
