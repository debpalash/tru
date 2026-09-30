import type { JSX } from 'react'
import { Stack } from 'expo-router'

import { useTheme } from '@/ui/theme'

export default function XLayout(): JSX.Element {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: 'slide_from_right',
        animationDuration: 190,
      }}
    />
  )
}
