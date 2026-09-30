import { Platform } from 'react-native'

export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  none: 0,
  xs: 4,
  sm: 12,
  md: 16,
  lg: 24,
  round: 999,
} as const

export const typeScale = {
  metadata: 12,
  label: 14,
  body: 16,
  title: 18,
  heading: 22,
  display: 28,
} as const

export const lineHeight = {
  metadata: 18,
  label: 20,
  body: 24,
  title: 24,
  heading: 28,
  display: 34,
} as const

export const hitTarget = Platform.select({ android: 48, default: 44 }) as number

export const motion = {
  instant: 0,
  fast: 120,
  standard: 200,
  slow: 280,
} as const

export const layout = {
  screenGutter: 16,
  feedGutter: 16,
  tabBarHeight: 56,
  compactHeaderHeight: 48,
} as const
