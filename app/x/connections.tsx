import { useCallback, type JSX } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXConnections } from '@/engine/x/client'
import type { XUserPage } from '@/engine/x/types'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme } from '@/ui/theme'
import { XUserList } from '@/ui/x/XUserList'

export default function XConnectionsScreen(): JSX.Element {
  const t = useTheme()
  const { userId = '', username = '', kind = 'following' } = useLocalSearchParams<{ userId?: string; username?: string; kind?: string }>()
  const mode = kind === 'followers' ? 'followers' : 'following'
  const loader = useCallback((cursor = ''): Promise<XUserPage> => userId ? fetchXConnections(userId, mode, cursor) : Promise.resolve({ users: [] }), [mode, userId])
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
    <AppHeader title={mode === 'followers' ? 'Followers' : 'Following'} subtitle={`@${username}`} />
    <XUserList loader={loader} empty={`No general-audience ${mode} accounts were returned.`} />
  </SafeAreaView>
}
