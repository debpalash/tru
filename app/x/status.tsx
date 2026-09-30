import { useCallback, type JSX } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXThread } from '@/engine/x/client'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'

export default function XStatusScreen(): JSX.Element {
  const t = useTheme()
  const { id = '' } = useLocalSearchParams<{ id?: string }>()
  const loader = useCallback((cursor = '') => fetchXThread(id, cursor), [id])
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}><AppHeader title="Thread" subtitle="Post and replies" /><XTimeline loader={loader} empty="This thread is unavailable or did not contain general-audience posts." thread /></SafeAreaView>
}
