// Drop-in replacement for Pressable / TouchableOpacity that shrinks slightly on
// press (iOS-style) and fires a haptic. Use for any tappable button, row, or
// chip.
//
//   <PressableScale onPress={...} style={styles.btn}>...</PressableScale>
//   <PressableScale scaleTo={0.98} haptic="light" style={({ pressed }) => ...}>
//
// Structure: the scale animation lives on a plain reanimated Animated.View
// wrapper, while an inner native Pressable carries the styling + press handling.
// Scaling the wrapper scales the whole styled box (the correct iOS look), and
// because the Pressable is untouched, object AND function styles work natively.
// reanimated's PropsFilter can't read the animated style out of a *function*
// style, so keeping the animation on a plain wrapper is what makes this reliable
// no matter what `style` shape a caller passes.

import React, { useCallback } from 'react'
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { haptics } from '../haptics'
import { pressableScaleConfig } from './motion'

type PressedState = { pressed: boolean }
type StyleFn = (state: PressedState) => StyleProp<ViewStyle>

export type PressableScaleProps = Omit<PressableProps, 'children' | 'disabled' | 'onPressIn' | 'onPressOut' | 'style'> & {
  onPress?: (e: GestureResponderEvent) => void
  onLongPress?: (e: GestureResponderEvent) => void
  onPressIn?: (e: GestureResponderEvent) => void
  onPressOut?: (e: GestureResponderEvent) => void
  /** Object style, or Pressable's function form `({ pressed }) => style`. */
  style?: StyleProp<ViewStyle> | StyleFn
  children?: React.ReactNode
  disabled?: boolean | null
  hitSlop?: PressableProps['hitSlop']
  /** Scale target on press-in. Default 0.96. */
  scaleTo?: number
  /** Haptic on press-in. Default 'selection'. Pass false to silence. */
  haptic?: 'selection' | 'light' | 'medium' | false
}

// Layout props that shape how the box participates in its parent must live on
// the outer (scaled) wrapper, otherwise a `flex:1` tab / `position:absolute` overlay
// button collapses or mis-positions once wrapped. FLEX_KEYS are COPIED to the
// wrapper but kept on the inner too (both boxes must fill). MOVE_KEYS (position/
// insets/margins) are MOVED to the wrapper and stripped from the inner (else the
// inner double-offsets). Applies to object AND function styles as a true drop-in.
const FLEX_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf'] as const
const MOVE_KEYS = [
  'position', 'top', 'right', 'bottom', 'left', 'start', 'end', 'zIndex',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
] as const

function stripMove(flat: ViewStyle | undefined): ViewStyle | undefined {
  if (!flat) return flat
  const out: ViewStyle = { ...flat }
  for (const k of MOVE_KEYS) delete (out as Record<string, unknown>)[k]
  return out
}

function fireHaptic(kind: PressableScaleProps['haptic']) {
  if (kind === 'selection') haptics.selection()
  else if (kind === 'light') haptics.impact('light')
  else if (kind === 'medium') haptics.impact('medium')
}

export function PressableScale({
  scaleTo = 0.96,
  haptic = 'selection',
  style,
  children,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1)
  const reduceMotion = useReducedMotion()
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (!disabled) {
        scale.value = reduceMotion ? 1 : withSpring(scaleTo, pressableScaleConfig)
        if (haptic) fireHaptic(haptic)
      }
      onPressIn?.(e)
    },
    [disabled, scaleTo, haptic, onPressIn, reduceMotion, scale],
  )

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = reduceMotion ? 1 : withSpring(1, pressableScaleConfig)
      onPressOut?.(e)
    },
    [onPressOut, reduceMotion, scale],
  )

  // Resolve/hoist layout+positioning onto the scaled wrapper, memoized on the
  // style ref so a StyleSheet style (the common case) flattens ONCE, not every
  // render (important when many PressableScales live in a scrolling list).
  const { wrapperLayout, innerStyle } = React.useMemo(() => {
    const baseFlat = StyleSheet.flatten(
      typeof style === 'function' ? (style as StyleFn)({ pressed: false }) : style,
    ) as ViewStyle | undefined
    let wrapper: ViewStyle | undefined
    let move = false
    if (baseFlat) {
      for (const key of FLEX_KEYS) {
        if (baseFlat[key] != null) (wrapper ||= {})[key] = baseFlat[key] as never
      }
      for (const key of MOVE_KEYS) {
        if (baseFlat[key] != null) { (wrapper ||= {})[key] = baseFlat[key] as never; move = true }
      }
    }
    const inner: StyleProp<ViewStyle> | StyleFn = !move
      ? style
      : typeof style === 'function'
        ? (state: PressedState) => stripMove(StyleSheet.flatten((style as StyleFn)(state)) as ViewStyle | undefined)
        : stripMove(StyleSheet.flatten(style) as ViewStyle | undefined)
    return { wrapperLayout: wrapper, innerStyle: inner }
  }, [style])

  return (
    <Animated.View
      style={wrapperLayout ? [wrapperLayout, animStyle] : animStyle}
      collapsable={false}
    >
      <Pressable
        {...rest}
        disabled={disabled ?? undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={innerStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

export default PressableScale
