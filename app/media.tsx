import { useCallback, useEffect, useState, type ComponentProps, type JSX } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { fetchNews } from '@/engine/news/feed'
import { getSource } from '@/engine/news/registry'
import type { NewsItem } from '@/engine/news/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { openLink } from '@/ui/openLink'
import { StateCard } from '@/ui/shell/StateCard'
import { refreshTint } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

type IconName = ComponentProps<typeof Ionicons>['name']
const desks: ReadonlyArray<{ icon: IconName; name: string; body: string; url: string }> = [
  { icon: 'mic-outline', name: 'NPR Podcasts', body: 'News, science, culture and analysis', url: 'https://www.npr.org/podcasts-and-shows/' },
  { icon: 'videocam-outline', name: 'BBC Video', body: 'Verified video reporting', url: 'https://www.bbc.com/video' },
  { icon: 'images-outline', name: 'Reuters Video', body: 'Global visual reporting', url: 'https://www.reuters.com/video/' },
  { icon: 'bulb-outline', name: 'TED', body: 'Ideas, talks and explainers', url: 'https://www.ted.com/talks' },
  { icon: 'planet-outline', name: 'NASA+', body: 'Science missions and live programs', url: 'https://plus.nasa.gov/' },
  { icon: 'tv-outline', name: 'PBS', body: 'Public affairs and documentaries', url: 'https://www.pbs.org/video/' },
]
const MEDIA_HINT = /\b(?:video|podcast|watch|listen|interview|documentary|photos?|visual|explainer)\b/i

export default function MediaScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [stories, setStories] = useState<NewsItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const load = useCallback(async (fresh = false) => {
    setLoading(true)
    setError(false)
    try {
      const items = await fetchNews('all', null, fresh)
      setStories(items.filter((item) => getSource(item.sourceId)?.evidenceRole === 'editorial' && MEDIA_HINT.test(`${item.title} ${item.hover ?? ''}`)).slice(0, 20))
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Media" subtitle="Audio and video" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && stories.length > 0} onRefresh={() => void load(true)} {...refreshTint(t)} />}>
        <Text style={styles.section}>Publishers</Text>
        <View style={styles.group}>
          {desks.map((desk) => (
            <PressableScale key={desk.name} style={styles.desk} onPress={() => openLink(desk.url, desk.name)} accessibilityRole="link" accessibilityLabel={desk.name}>
              <Ionicons name={desk.icon} size={18} color={t.textMuted} />
              <View style={styles.deskCopy}><Text style={styles.deskName}>{desk.name}</Text><Text style={styles.deskBody} numberOfLines={1}>{desk.body}</Text></View>
              <Ionicons name="open-outline" size={16} color={t.textMuted} />
            </PressableScale>
          ))}
        </View>

        <Text style={styles.section}>Related stories{stories.length ? ` · ${stories.length}` : ''}</Text>
        <View style={styles.group}>
          {stories.map((story) => {
            const source = getSource(story.sourceId)
            return (
              <PressableScale key={story.id} style={styles.story} onPress={() => openLink(story.mobileUrl ?? story.url, story.title)} accessibilityRole="link" accessibilityLabel={`${story.title}, ${source?.name ?? story.sourceId}`}>
                <Ionicons name="play-circle-outline" size={20} color={t.textMuted} />
                <View style={styles.storyCopy}>
                  <Text style={styles.storyTitle} numberOfLines={2}>{story.title}</Text>
                  <Text style={styles.storyMeta}>{source?.name ?? story.sourceId} · publisher link</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={t.textMuted} />
              </PressableScale>
            )
          })}
          {!stories.length ? <StateCard title={loading ? 'Loading stories' : error ? 'Couldn’t load stories' : 'No media stories yet'} body={loading ? undefined : 'Browse a publisher above or check again.'} loading={loading} action={loading ? undefined : 'Refresh'} onAction={() => void load(true)} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingBottom: 32 },
  section: { minHeight: 34, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  desk: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  deskCopy: { flex: 1, minWidth: 0 },
  deskName: { color: t.text, fontSize: 14, fontWeight: '600' },
  deskBody: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  story: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', gap: 9, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  storyCopy: { flex: 1, minWidth: 0 },
  storyTitle: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  storyMeta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  empty: { color: t.textMuted, fontSize: 14, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 16 },
})
