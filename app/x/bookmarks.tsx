import { useCallback, type JSX } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXBookmarks } from '@/engine/x/client'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme } from '@/ui/theme'
import { XTimeline } from '@/ui/x/XTimeline'

export default function XBookmarksScreen(): JSX.Element {
  const t = useTheme()
  const loader = useCallback((cursor = '') => fetchXBookmarks(cursor), [])
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}><AppHeader title="X bookmarks" subtitle="Private authenticated collection" /><XTimeline loader={loader} empty="No general-audience bookmarks were returned." /></SafeAreaView>
}
