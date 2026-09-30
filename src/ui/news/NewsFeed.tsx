import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useFocusEffect } from 'expo-router'

import { useTheme, useThemedStyles, type ThemeTokens } from '../theme'
import { haptics } from '../haptics'
import { PressableScale } from '@/ui/ios/PressableScale'
import { iosFlashListProps, refreshTint } from '@/ui/ios/listProps'
import { NewsRow } from './NewsRow'
import { NewsSwitcher } from './NewsSwitcher'
import { fetchNews } from '../../engine/news/feed'
import { setNewsLatest, markNewsSeen } from '../../engine/news/seen'
import type { NewsCategory, NewsItem } from '../../engine/news/types'
import { openLink } from '../openLink'
import { useLocationProfile } from '../../engine/location'
import { usePrivacySnapshot } from '../../engine/privacy'

interface Props {
  /** Top padding so content clears the home feed's absolute header. */
  topInset: number
}

// Quiet foreground refresh cadence while the News tab is focused (§3.2). Slow
// enough to be gentle on battery/data; hot-lists move on the order of minutes.
const LIVE_REFRESH_MS = 180_000

function selKey(category: NewsCategory, sourceId: string | null): string {
  return `${category}:${sourceId ?? '*'}`
}

/**
 * News feed: a category + source chip switcher over a FlashList of hot-list
 * rows, with pull-to-refresh and a gentle foreground live refresh. Modeled on
 * HnFeed; rendered by app/index.tsx in place of the tweet list when the News tab
 * is active. Aggregation/merge/dedup live in src/engine/news/*; this component
 * only orchestrates fetch → render and reports the latest ids to the badge store.
 */
export function NewsFeed({ topInset }: Props): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const location = useLocationProfile()
  const privacy = usePrivacySnapshot()
  const privateRouteKey = privacy.torEnabled ? `tor:${privacy.torStatus}` : privacy.relayEnabled ? 'relay' : 'direct'

  const [category, setCategory] = useState<NewsCategory>('all')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-selection cache so switching category/source restores instantly.
  const cache = useRef<Record<string, NewsItem[]>>({})
  const selRef = useRef(selKey('all', null))
  const mounted = useRef(true)
  // Guards the very first load so the initial useFocusEffect run doesn't race
  // a separate mount effect into fetching twice.
  const hasFetchedRef = useRef(false)
  const loadedCountry = useRef('')
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    async (cat: NewsCategory, src: string | null, mode: 'initial' | 'refresh') => {
      const key = selKey(cat, src)
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const list = await fetchNews(cat, src, mode === 'refresh')
        if (!mounted.current || selRef.current !== key) return
        setItems(list)
        loadedCountry.current = location.code
        cache.current[key] = list
        // Reading the tab clears the unseen badge; report + mark seen (§4.4).
        setNewsLatest(list.map((i) => i.id))
        markNewsSeen()
      } catch (e) {
        if (!mounted.current || selRef.current !== key) return
        setError(e instanceof Error ? e.message : 'Failed to load news.')
      } finally {
        if (!mounted.current || selRef.current !== key) return
        setLoading(false)
        setRefreshing(false)
      }
    },
    [location.code, privateRouteKey]
  )

  const applySelection = useCallback(
    (cat: NewsCategory, src: string | null) => {
      const key = selKey(cat, src)
      selRef.current = key
      setCategory(cat)
      setSourceId(src)
      setError(null)
      const cached = cache.current[key]
      if (cached && cached.length) {
        setItems(cached)
        setLoading(false)
        setRefreshing(false)
        setNewsLatest(cached.map((i) => i.id))
        markNewsSeen()
      } else {
        setItems([])
        setLoading(true)
        load(cat, src, 'initial')
      }
    },
    [load]
  )

  const onCategory = useCallback(
    (cat: NewsCategory) => {
      // Changing category resets the pinned source back to the river.
      applySelection(cat, null)
    },
    [applySelection]
  )

  const onSource = useCallback(
    (src: string | null) => {
      applySelection(category, src)
    },
    [applySelection, category]
  )

  const openItem = useCallback((item: NewsItem) => {
    openLink(item.mobileUrl ?? item.url, item.title)
    // TODO(P2): route to an in-app reader with router.push('/news/read?u=' + url),
    // rendering extracted ArticleContent with a "Key points" LLM summary.
  }, [])

  // Initial load + gentle foreground live refresh while the tab is focused
  // (self-rescheduling). The `hasFetchedRef` guard means the very first focus
  // does the initial fetch here (instead of a separate mount effect racing
  // this one), then every focus schedules the periodic refresh.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      let timer: ReturnType<typeof setTimeout>
      const tick = async () => {
        try {
          const list = await fetchNews(category, sourceId, true)
          if (!cancelled && mounted.current && selRef.current === selKey(category, sourceId)) {
            setItems(list)
            cache.current[selKey(category, sourceId)] = list
            setNewsLatest(list.map((i) => i.id))
            markNewsSeen()
          }
        } catch {
          /* non-fatal */
        }
        if (!cancelled) timer = setTimeout(tick, LIVE_REFRESH_MS)
      }
      if (!hasFetchedRef.current || loadedCountry.current !== location.code) {
        hasFetchedRef.current = true
        load(category, sourceId, 'initial')
      }
      timer = setTimeout(tick, LIVE_REFRESH_MS)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [category, location.code, privateRouteKey, sourceId, load])
  )

  const renderItem = useCallback(
    ({ item, index }: { item: NewsItem; index: number }) => (
      <NewsRow item={item} rank={index + 1} onOpen={openItem} />
    ),
    [openItem]
  )

  return (
    <View style={styles.container}>
      <NewsSwitcher
        category={category}
        sourceId={sourceId}
        onCategory={onCategory}
        onSource={onSource}
        topInset={topInset}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.text} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorBody}>{error}</Text>
          <PressableScale style={styles.retry} onPress={() => load(category, sourceId, 'initial')} accessibilityRole="button" accessibilityLabel="Retry loading news">
            <Text style={styles.retryText}>Retry</Text>
          </PressableScale>
        </View>
      ) : (
        <FlashList
          {...iosFlashListProps}
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={selKey(category, sourceId)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                haptics.light()
                load(category, sourceId, 'refresh')
              }}
              {...refreshTint(t)}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.errorBody}>No stories right now.</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

function keyExtractor(item: NewsItem): string {
  return item.id
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    errorBody: {
      color: t.textMuted,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 16,
    },
    retry: {
      backgroundColor: t.text,
      paddingHorizontal: 22,
      paddingVertical: 9,
      borderRadius: 9999,
    },
    retryText: {
      color: t.bg,
      fontWeight: '700',
      fontSize: 14,
    },
  })
