import * as Haptics from 'expo-haptics'

/**
 * Thin, fire-and-forget haptics. Never throws because some devices/emulators lack a
 * vibrator, so every call swallows errors and callers don't await.
 */
export const haptics = {
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  },
  heavy: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
  },
  /**
   * Physical "tap"/collision feedback. `impact('light'|'medium'|'heavy')`.
   * Unknown values fall back to medium. Fire-and-forget; never throws.
   */
  impact: (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    } as const
    Haptics.impactAsync(map[style] ?? Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  },
  selection: () => {
    Haptics.selectionAsync().catch(() => {})
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
}
