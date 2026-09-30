// iOS-tuned motion primitives. Spring configs are plain objects usable directly
// as the config arg to reanimated's `withSpring(toValue, CONFIG)`. Entrance /
// layout presets are pre-configured reanimated animation builders you pass to a
// reanimated `Animated.*` component's `entering` / `layout` props.
//
// Reanimated IS wired in this app (react-native-reanimated/plugin is last in
// babel.config.js), so the presets below are the real builders. Each builder is
// still constructed behind a guard: on any API mismatch it degrades to
// `undefined`, which reanimated treats as "no animation", so importers using
// `entering={fadeIn}` / `layout={layoutTransition}` can never break.

import type { WithSpringConfig } from 'react-native-reanimated'
import { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated'

/** True when the real reanimated builders are available (they are, here). */
export const REANIMATED_AVAILABLE = true

/**
 * Snappy default spring for the everyday iOS feel (small, quick settle with a
 * touch of life). Use for most value transitions: `withSpring(to, SPRING)`.
 */
export const SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 1,
} as const satisfies WithSpringConfig

/**
 * Gentler, slower spring for larger / softer movements (sheets, big reveals)
 * where the snappy default would feel abrupt.
 */
export const SOFT_SPRING = {
  damping: 20,
  stiffness: 120,
  mass: 1,
} as const satisfies WithSpringConfig

/**
 * Very fast, near-critically-damped spring for press-scale feedback. Tuned so
 * the shrink/return reads as instant with only a hair of overshoot on release.
 * Consumed by PressableScale.
 */
export const pressableScaleConfig = {
  damping: 24,
  stiffness: 380,
  mass: 0.5,
} as const satisfies WithSpringConfig

// Build a preset behind a guard so a builder-API mismatch degrades to undefined
// (a valid `entering`/`layout` value) instead of throwing at import time.
function preset<T>(build: () => T): T | undefined {
  try {
    return build()
  } catch {
    return undefined
  }
}

/** Fade a list item / element in (~200ms). Pass to `entering`. */
export const fadeIn = preset(() => FadeIn.duration(200))

/** Fade + slide up for list-item entrance (~220ms). Pass to `entering`. */
export const fadeInDown = preset(() => FadeInDown.duration(220))

/** Smooth layout/reorder transition (~200ms). Pass to `layout`. */
export const layoutTransition = preset(() => LinearTransition.duration(200))
