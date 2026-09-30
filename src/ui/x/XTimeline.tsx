import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { ActivityIndicator, AppState, RefreshControl, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { router, useFocusEffect } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import type { XPage, XPost } from '@/engine/x/types'
import { useXSession } from '@/engine/x/session'
import { refreshTint } from '@/ui/ios/listProps'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { StateCard } from '@/ui/shell/StateCard'
import { PressableScale } from '@/ui/ios/PressableScale'

import { XPostRow } from './XPostRow'

export function XTimeline({ loader, header, empty = 'No posts were returned.', thread = false }: { loader: (cursor?: string) => Promise<XPage>; header?: ReactNode; empty?: string; thread?: boolean }): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const mounted = useRef(true)
  const focused = useRef(false)
  const listRef = useRef<FlashListRef<XPost>>(null)
  const postsRef = useRef<XPost[]>([])
  const scrollY = useRef(0)
  const checking = useRef(false)
  const backgroundedAt = useRef(0)
  const [posts, setPosts] = useState<XPost[]>([])
  const [activePostId, setActivePostId] = useState('')
  const [pendingPosts, setPendingPosts] = useState<XPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => () => { mounted.current = false }, [])
  useFocusEffect(useCallback(() => {
    focused.current = true
    return () => { focused.current = false }
  }, []))
  useEffect(() => { postsRef.current = posts }, [posts])
  const load = useCallback(async (refresh = false, nextCursor = '') => {
    if (!session) {
      setLoading(false)
      setPosts([])
      setCursor(undefined)
      setHasMore(false)
      return
    }
    const paging = Boolean(nextCursor)
    if (paging) setLoadingMore(true)
    else if (refresh) setRefreshing(true)
    else setLoading(true)
    if (paging) setPageError(null)
    else {
      setError(null)
      setPendingPosts([])
    }
    try {
      const page = await loader(nextCursor)
      if (mounted.current) {
        setPosts((current) => {
          if (!paging) return page.posts
          const seen = new Set(current.map((post) => post.id))
          return [...current, ...page.posts.filter((post) => !seen.has(post.id))]
        })
        setCursor(page.cursor)
        setHasMore(Boolean(page.cursor && page.cursor !== nextCursor))
      }
    } catch (loadError) {
      if (mounted.current) {
        const message = loadError instanceof Error ? loadError.message : 'X could not load.'
        if (paging) setPageError(message)
        else setError(message)
      }
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    }
  }, [loader, session])

  useEffect(() => { void load() }, [load])

  const checkForUpdates = useCallback(async () => {
    if (!session || checking.current || !postsRef.current.length) return
    checking.current = true
    try {
      const page = await loader('')
      if (!mounted.current || !page.posts.length || page.posts[0]?.id === postsRef.current[0]?.id) return
      if (scrollY.current < 80) {
        const incoming = new Set(page.posts.map((post) => post.id))
        setPosts((current) => [...page.posts, ...current.filter((post) => !incoming.has(post.id))])
      } else {
        setPendingPosts(page.posts)
      }
      setCursor(page.cursor)
      setHasMore(Boolean(page.cursor))
    } catch {
      // Resume checks are silent. Pull to refresh remains the explicit error path.
    } finally {
      checking.current = false
    }
  }, [loader, session])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (focused.current && backgroundedAt.current && Date.now() - backgroundedAt.current > 90_000) void checkForUpdates()
      } else {
        backgroundedAt.current = Date.now()
      }
    })
    return () => subscription.remove()
  }, [checkForUpdates])

  const applyPending = useCallback(() => {
    if (!pendingPosts.length) return
    const incoming = new Set(pendingPosts.map((post) => post.id))
    setPosts((current) => [...pendingPosts, ...current.filter((post) => !incoming.has(post.id))])
    setPendingPosts([])
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [pendingPosts])

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y
  }, [])
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 62 }).current
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<XPost>> }) => {
    const visible = viewableItems.find((token) => token.isViewable && token.item?.media?.some((item) => item.kind !== 'photo'))
      ?? viewableItems.find((token) => token.isViewable)
    setActivePostId(visible?.item?.id ?? '')
  }).current
  const renderPost = useCallback(({ item, index }: { item: XPost; index: number }) => (
    <XPostRow post={item} thread={thread} threadLast={thread && index === posts.length - 1} active={item.id === activePostId} />
  ), [activePostId, posts.length, thread])

  const state = !session
    ? <StateCard title="Connect X" body="Sign in through X’s own page. Tru stores only the two session cookies required for its compact reader." action="Connect" onAction={() => router.push('/x/login')} />
    : loading
      ? <StateCard title="Loading X" body="Fetching your account timeline" loading />
      : error
        ? <StateCard title="X needs attention" body={error} action="Retry" onAction={() => void load()} />
        : !posts.length
          ? <StateCard title="Nothing here yet" body={empty} action="Refresh" onAction={() => void load(true)} />
          : null

  const uniquePending = useMemo(() => {
    const existing = new Set(posts.map((post) => post.id))
    return pendingPosts.filter((post) => !existing.has(post.id)).length
  }, [pendingPosts, posts])
  return (
    <View style={styles.screen}>
    <FlashList
      ref={listRef}
      data={state ? [] : posts}
      keyExtractor={(item) => item.id}
      renderItem={renderPost}
      extraData={activePostId}
      ListHeaderComponent={<View>{header}{state}</View>}
      ListFooterComponent={posts.length ? <View style={styles.footer}>
        {loadingMore ? <ActivityIndicator size="small" color={t.accent} /> : null}
        {pageError ? <><Text style={styles.footerText}>{pageError}</Text><PressableScale style={styles.retryButton} onPress={() => void load(false, cursor)} accessibilityRole="button" accessibilityLabel="Retry loading more X posts"><Text style={styles.retry}>Retry</Text></PressableScale></> : null}
      </View> : null}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
      onEndReached={() => { if (hasMore && cursor && !loadingMore && !pageError) void load(false, cursor) }}
      onEndReachedThreshold={0.55}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
    />
    {pendingPosts.length ? <PressableScale style={styles.newPosts} hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }} onPress={applyPending} haptic="light" accessibilityRole="button" accessibilityLabel={uniquePending ? `Show ${uniquePending} new X posts` : 'Show updated X feed'}>
      <Ionicons name="arrow-up" size={15} color={t.onAccent} />
      <Text style={styles.newPostsText}>{uniquePending ? `${uniquePending} new post${uniquePending === 1 ? '' : 's'}` : 'Feed updated'}</Text>
    </PressableScale> : null}
    </View>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 80 },
  footer: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  footerText: { flexShrink: 1, color: t.textMuted, fontSize: 12 },
  retryButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  retry: { color: t.accent, fontSize: 14, fontWeight: '600' },
  newPosts: { position: 'absolute', top: 8, alignSelf: 'center', minHeight: 40, paddingHorizontal: 13, borderRadius: 20, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent, elevation: 3, shadowColor: t.overlay, shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  newPostsText: { color: t.onAccent, fontSize: 14, lineHeight: 20, fontWeight: '600' },
})
