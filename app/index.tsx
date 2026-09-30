import type { JSX } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TodayFeed } from '@/ui/feed/TodayFeed'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function HomeScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <TodayFeed />
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
  })
