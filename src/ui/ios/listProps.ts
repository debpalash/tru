// Spread-in prop bundles that give scroll surfaces an iOS-smooth feel. Each
// bundle only contains props VALID for its target list type, so spreading is
// always safe.
//
//   <ScrollView {...iosScrollProps} />
//   <FlatList   {...iosScrollProps} />
//   <FlashList  {...iosFlashListProps} />
//   <RefreshControl {...refreshTint(theme)} refreshing={...} onRefresh={...} />

import type { ScrollViewProps } from 'react-native'
import type { ThemeTokens } from '../theme'

/**
 * ScrollView / FlatList props for a natural iOS scroll: momentum deceleration,
 * dismiss the keyboard on drag, keep taps working while the keyboard is up, and
 * always allow the Android overscroll glow.
 */
export const iosScrollProps = {
  decelerationRate: 'normal',
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  overScrollMode: 'always',
} as const satisfies ScrollViewProps

/**
 * FlashList-safe subset. FlashList forwards ScrollView props to its internal
 * ScrollView (it only rejects `style` / `contentContainerStyle` padding), so
 * the scroll props above are safe here too, plus FlashList's native
 * `drawDistance` for extra pre-render headroom = fewer blanks while flinging.
 */
export const iosFlashListProps = {
  decelerationRate: 'normal',
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  overScrollMode: 'always',
  // Extra off-screen pre-render so flings don't flash empty cells as often.
  // FlashList recycles; this is headroom for bind/decode, not retained views.
  drawDistance: 900,
} as const

/**
 * RefreshControl color props themed to the active accent.
 *   iOS     -> tintColor (spinner)
 *   Android -> colors (spinner) + progressBackgroundColor (track)
 */
export function refreshTint(theme: ThemeTokens) {
  return {
    tintColor: theme.accent,
    colors: [theme.accent] as string[],
    progressBackgroundColor: theme.surface,
  }
}
