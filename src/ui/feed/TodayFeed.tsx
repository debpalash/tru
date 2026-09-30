import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { router, useFocusEffect } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import {
  askFeedAgent,
  citedSourceNumbers,
  presentAgentText,
  type FeedAgentAnswer,
} from '@/engine/agent/feedAgent'
import {
  allProviders,
  llmConfigured,
} from '@/engine/agent/providers'
import { loadSavedFeedIds, toggleSavedFeedItem } from '@/engine/feed/saved'
import {
  buildTodayFeed,
  collapseCorroboratedFeed,
  filterTodayFeed,
  pickBriefItems,
  rankSmartFeed,
} from '@/engine/feed/today'
import { headlineSimilarity } from '@/engine/feed/evidence'
import {
  UNIFIED_FILTERS,
  type EvidenceLink,
  type UnifiedFeedItem,
  type UnifiedFilter,
  type WebVerificationState,
} from '@/engine/feed/types'
import { fetchNews } from '@/engine/news/feed'
import { useLocationProfile } from '@/engine/location'
import { usePrivacySnapshot } from '@/engine/privacy'
import { getTrustedPublisher, sourcesFor } from '@/engine/news/registry'
import type { NewsItem } from '@/engine/news/types'
import { loadMonitors, prioritizeMonitored, type Monitor } from '@/engine/monitor/store'
import { fetchXHome } from '@/engine/x/client'
import { xPostToNews } from '@/engine/x/feed'
import { setXMediaMode, useXMediaMode } from '@/engine/x/mediaPreference'
import { useXSession } from '@/engine/x/session'
import {
  FirecrawlError,
  researchTrustedWeb,
  searchTrustedWeb,
  trustedWebResultToNewsItem,
} from '@/engine/web/firecrawl'
import { haptics } from '@/ui/haptics'
import { PressableScale } from '@/ui/ios/PressableScale'
import { refreshTint } from '@/ui/ios/listProps'
import { openLink } from '@/ui/openLink'
import { Wordmark } from '@/ui/brand/Wordmark'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

import { BriefCard } from './BriefCard'
import { UnifiedFeedRow } from './UnifiedFeedRow'

const LIVE_REFRESH_MS = 180_000

type FeedMode = 'smart' | 'latest'
type AgentState =
  | { kind: 'idle' }
  | { kind: 'loading'; question: string }
  | { kind: 'unconfigured'; question: string }
  | { kind: 'error'; question: string; message: string }
  | { kind: 'answer'; question: string; result: FeedAgentAnswer }

function dateLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
}

function compactProviderLabel(label: string): string {
  if (label === 'Google AI (Gemini)') return 'Gemini'
  if (label === 'NVIDIA NIM') return 'NVIDIA'
  return label
}

export function TodayFeed(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const inputRef = useRef<TextInput>(null)
  const listRef = useRef<FlashListRef<UnifiedFeedItem>>(null)
  const mounted = useRef(true)
  const agentAbort = useRef<AbortController | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [webEvidence, setWebEvidence] = useState<NewsItem[]>([])
  const [verification, setVerification] = useState<Record<string, WebVerificationState>>({})
  const [filter, setFilter] = useState<UnifiedFilter>('all')
  const [mode, setMode] = useState<FeedMode>('smart')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showBrief, setShowBrief] = useState(false)
  const [agentState, setAgentState] = useState<AgentState>({ kind: 'idle' })
  const [configuredCount, setConfiguredCount] = useState(0)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const xSession = useXSession()
  const xMediaMode = useXMediaMode()
  const location = useLocationProfile()
  const privacy = usePrivacySnapshot()
  const privateRouteKey = privacy.torEnabled ? `tor:${privacy.torStatus}` : privacy.proxy.enabled ? `proxy:${privacy.proxy.ready}` : privacy.relayEnabled ? 'relay' : 'direct'
  const loadedCountry = useRef('')

  const refreshProviderState = useCallback(() => {
    setConfiguredCount(allProviders().filter((provider) => provider.hasKey && !provider.disabled).length)
  }, [])

  useEffect(() => {
    mounted.current = true
    refreshProviderState()
    void loadSavedFeedIds().then((ids) => {
      if (mounted.current) setSavedIds(ids)
    })
    void loadMonitors().then((items) => { if (mounted.current) setMonitors(items) })
    return () => {
      mounted.current = false
      agentAbort.current?.abort()
    }
  }, [refreshProviderState])

  const load = useCallback(async (fresh: boolean) => {
    if (fresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [newsResult, xResult] = await Promise.allSettled([
        fetchNews('all', null, fresh),
        xSession ? fetchXHome() : Promise.resolve({ posts: [] }),
      ])
      if (newsResult.status === 'rejected') throw newsResult.reason
      const xItems = xResult.status === 'fulfilled' ? xResult.value.posts.map(xPostToNews) : []
      if (mounted.current) {
        loadedCountry.current = location.code
        setNews([...newsResult.value, ...xItems])
      }
    } catch (loadError) {
      if (mounted.current) {
        setError(loadError instanceof Error ? loadError.message : 'Could not refresh the feed.')
      }
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [location.code, privateRouteKey, xSession])

  useFocusEffect(
    useCallback(() => {
      refreshProviderState()
      void loadMonitors().then((items) => { if (mounted.current) setMonitors(items) })
      if (!news.length || loadedCountry.current !== location.code) void load(false)
      const timer = setInterval(() => void load(true), LIVE_REFRESH_MS)
      return () => clearInterval(timer)
    }, [load, location.code, news.length, privateRouteKey, refreshProviderState]),
  )

  const unified = useMemo(() => buildTodayFeed(news, [...news, ...webEvidence]), [news, webEvidence])
  const briefItems = useMemo(() => pickBriefItems(unified), [unified])
  const visibleItems = useMemo(() => {
    const filtered = filterTodayFeed(unified, filter)
    if (mode === 'smart') {
      return prioritizeMonitored(collapseCorroboratedFeed(rankSmartFeed(filtered)), monitors)
    }
    return [...filtered].sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
  }, [filter, mode, monitors, unified])

  const submitAgent = useCallback(async (override?: string) => {
    const question = (override ?? query).trim()
    if (!question) return
    setQuery('')
    haptics.light()
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    if (!llmConfigured()) {
      setAgentState({ kind: 'unconfigured', question })
      return
    }
    if (!news.length) {
      setAgentState({ kind: 'error', question, message: 'The source context is still loading. Try again in a moment.' })
      return
    }
    agentAbort.current?.abort()
    const controller = new AbortController()
    agentAbort.current = controller
    setAgentState({ kind: 'loading', question })
    try {
      let sourceContext = news
      let webGrounding: NonNullable<FeedAgentAnswer['webGrounding']> = {
        status: 'feed-only',
        sourceCount: 0,
        credits: 0,
      }
      try {
        const web = await researchTrustedWeb(question, controller.signal)
        const seenUrls = new Set<string>()
        sourceContext = [...web.items, ...news].filter((item) => {
          const url = item.mobileUrl ?? item.url
          if (seenUrls.has(url)) return false
          seenUrls.add(url)
          return true
        })
        webGrounding = {
          status: web.items.length ? 'live' : 'feed-only',
          sourceCount: web.items.length,
          credits: web.credits,
          detail: web.items.length ? undefined : 'No matching pinned publisher pages were found.',
        }
      } catch (webError) {
        if (controller.signal.aborted) return
        webGrounding = {
          status: 'feed-only',
          sourceCount: 0,
          credits: 0,
          detail: webError instanceof FirecrawlError ? webError.message : 'Live web grounding was unavailable.',
        }
      }
      const result = await askFeedAgent(question, sourceContext, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      if (!result) {
        setAgentState({ kind: 'error', question, message: 'Every configured provider failed. Test them in Settings.' })
      } else {
        setAgentState({ kind: 'answer', question, result: { ...result, webGrounding } })
      }
    } catch (agentError) {
      if (!mounted.current || controller.signal.aborted) return
      setAgentState({
        kind: 'error',
        question,
        message: agentError instanceof Error ? agentError.message : 'The agent could not complete this request.',
      })
    }
  }, [news, query])

  const openItem = useCallback((item: UnifiedFeedItem) => {
    if (item.kind === 'x') {
      router.push({ pathname: '/x/status', params: { id: item.id.replace(/^x:/, '') } })
    } else if (item.kind === 'hn') {
      const id = item.id.match(/(\d+)$/)?.[1]
      if (id) router.push({ pathname: '/hn/thread', params: { id } })
      else if (item.url) openLink(item.url, item.title)
    } else if (item.url) openLink(item.url, item.title)
  }, [])

  const openEvidence = useCallback((link: EvidenceLink) => {
    openLink(link.url, `${link.publisher} evidence`)
  }, [])

  const askAboutItem = useCallback((item: UnifiedFeedItem) => {
    void submitAgent(`Explain why this matters and what is still uncertain: ${item.title}`)
  }, [submitAgent])

  const verifyHeadline = useCallback(async (item: UnifiedFeedItem) => {
    if (verification[item.id]?.kind === 'loading') return
    setVerification((current) => ({ ...current, [item.id]: { kind: 'loading' } }))
    try {
      const search = await searchTrustedWeb(item.title, { limit: 8, recency: 'week' })
      const matches = search.results
        .map((result) => trustedWebResultToNewsItem(result))
        .filter((candidate) =>
          candidate.sourceId !== item.sourceId &&
          headlineSimilarity(item.title, candidate.title) >= 0.66,
        )
      if (!mounted.current) return
      if (matches.length) {
        setWebEvidence((current) => {
          const byId = new Map(current.map((candidate) => [candidate.id, candidate]))
          for (const match of matches) byId.set(match.id, match)
          return [...byId.values()]
        })
      }
      setVerification((current) => ({
        ...current,
        [item.id]: { kind: 'done', matched: matches.length, credits: search.credits },
      }))
    } catch (verifyError) {
      if (!mounted.current) return
      setVerification((current) => ({
        ...current,
        [item.id]: {
          kind: 'error',
          message: verifyError instanceof Error ? verifyError.message : 'The live web check could not run.',
        },
      }))
    }
  }, [verification])

  const toggleSaved = useCallback((id: string) => {
    const item = unified.find((candidate) => candidate.id === id)
    if (!item) return
    void toggleSavedFeedItem(item).then((next) => {
      if (mounted.current) setSavedIds(next)
    })
  }, [unified])

  const selectFilter = useCallback((next: UnifiedFilter) => {
    haptics.selection()
    setFilter(next)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: UnifiedFeedItem }) => (
      <UnifiedFeedRow
        item={item}
        saved={savedIds.has(item.id)}
        explain={false}
        onOpen={openItem}
        onAsk={askAboutItem}
        onToggleSaved={toggleSaved}
        onOpenEvidence={openEvidence}
        verification={verification[item.id]}
        onVerify={verifyHeadline}
      />
    ),
    [askAboutItem, openEvidence, openItem, savedIds, toggleSaved, verification, verifyHeadline],
  )

  const emptyCopy = useMemo(() => {
    if (loading) return null
    if (error) return { title: 'The feed could not refresh', body: error, action: 'Retry' }
    if (filter === 'x') return xSession
      ? { title: 'No X posts returned', body: 'Pull down to retry, or open the complete authenticated X surface.', action: 'Open X' }
      : { title: 'Connect X', body: 'Sign in through X’s own page to add your Following timeline to this unified feed.', action: 'Connect X' }
    if (filter === 'research') return { title: 'No research result yet', body: 'Ask Tru a question above. Answers will use the loaded sources and show citations.', action: configuredCount ? 'Ask Tru' : 'Connect AI' }
    if (filter === 'media') return { title: 'Your safe media stream is next', body: 'Only approved general-audience sources will enter this surface.', action: 'Back to Today' }
    return { title: 'No updates right now', body: 'Pull down to check every source again.', action: 'Refresh' }
  }, [configuredCount, error, filter, loading, xSession])

  const sourceCount = useMemo(() => new Set(news.map((item) => item.sourceId)).size, [news])
  const curatedSourceCount = sourcesFor('all').length

  const listHeader = useMemo(
    () => (
      <View>
        <AgentResultCard
          state={agentState}
          onClose={() => setAgentState({ kind: 'idle' })}
          onConfigure={() => router.push('/settings')}
          onOpenSource={(item) => openLink(item.mobileUrl ?? item.url, item.title)}
        />
        {filter === 'all' && showBrief ? (
          <BriefCard
            initiallyExpanded
            items={briefItems}
            sourceCount={sourceCount || curatedSourceCount}
            agentReady={configuredCount > 0}
            onAskBrief={() => void submitAgent('Give me a concise briefing of the most important changes in these sources. Separate facts from inference.')}
            onConfigure={() => router.push('/settings')}
            onOpenItem={openItem}
          />
        ) : null}
        {filter === 'x' ? <View style={styles.xControl}><View style={styles.xControlCopy}><Text style={styles.xControlLabel}>Media</Text><Text style={styles.xControlStatus}>{xMediaMode === 'safe' ? 'Verified previews' : 'Media hidden'}</Text></View>{(['safe', 'hidden'] as const).map((choice) => <PressableScale key={choice} accessibilityRole="radio" accessibilityLabel={`${choice === 'safe' ? 'Safe' : 'Hide media'} X media`} accessibilityState={{ checked: xMediaMode === choice }} style={[styles.xChoice, xMediaMode === choice && (choice === 'safe' ? styles.xChoiceSafe : styles.xChoiceRaw)]} onPress={() => void setXMediaMode(choice)}><Text style={[styles.xChoiceText, xMediaMode === choice && styles.xChoiceTextActive]}>{choice === 'safe' ? 'Safe' : 'Hide media'}</Text></PressableScale>)}<PressableScale style={styles.xHub} accessibilityRole="button" accessibilityLabel="Open X hub" onPress={() => router.push('/x')}><Text style={styles.xHubText}>Hub</Text></PressableScale></View> : null}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionMeta}>{location.name}</Text>
          <PressableScale style={styles.rankButton} onPress={() => setMode((current) => current === 'smart' ? 'latest' : 'smart')} accessibilityRole="button" accessibilityLabel={`Sort by ${mode === 'smart' ? 'latest' : 'priority'}`}>
            <Text style={styles.rankText}>{mode === 'smart' ? 'For you' : 'Latest'}</Text><Ionicons name="swap-vertical-outline" size={13} color={t.textMuted} />
          </PressableScale>
        </View>
      </View>
    ),
    [agentState, briefItems, configuredCount, curatedSourceCount, filter, location.name, openItem, sourceCount, styles, submitAgent, visibleItems.length, xMediaMode, showBrief, mode, t.textMuted],
  )

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.topRow}>
          <View style={styles.topCopy}>
            <Wordmark width={78} />
            <Text style={styles.date}>Today · {dateLabel()}</Text>
          </View>
          <PressableScale style={styles.avatar} hitSlop={7} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Open settings">
            <Ionicons name="options-outline" size={22} color={t.text} />
          </PressableScale>
        </View>

          <View style={styles.commandWrap}>
            <Ionicons name="search" size={17} color={t.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void submitAgent()}
              placeholder="Ask about the news"
              placeholderTextColor={t.textMuted}
              returnKeyType="send"
              autoCapitalize="sentences"
              autoCorrect
              hitSlop={{ top: 5, bottom: 5 }}
              style={styles.commandInput}
              accessibilityLabel="Ask about today’s news"
            />
            <PressableScale
              hitSlop={8}
              style={query.trim() ? styles.runButton : styles.commandShortcut}
              onPress={() => { if (query.trim()) void submitAgent(); else { selectFilter('all'); setShowBrief((value) => !value) } }}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={query.trim() ? 'Ask question' : showBrief ? 'Hide brief' : 'Show brief'}
              accessibilityState={query.trim() ? undefined : { expanded: showBrief }}
            >
              {query.trim()
                ? <Ionicons name="arrow-up" size={16} color={t.onAccent} />
                : <Text style={styles.commandShortcutText}>Brief</Text>}
            </PressableScale>
          </View>

        <View style={styles.controlRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
            {UNIFIED_FILTERS.map((item) => (
              <PressableScale key={item.key} accessibilityRole="tab" accessibilityLabel={`${item.label} feed`} accessibilityState={{ selected: filter === item.key }} style={[styles.filter, filter === item.key && styles.filterActive]} onPress={() => selectFilter(item.key)} haptic={false}>
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.key === 'all' ? 'All' : item.label}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </View>

      <FlashList
        ref={listRef}
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ disabled: true }}
        refreshControl={<RefreshControl enabled={!loading} refreshing={refreshing && !loading} onRefresh={() => void load(true)} {...refreshTint(t)} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}><ActivityIndicator color={t.accent} /><Text style={styles.emptyBody}>Loading stories…</Text></View>
          ) : emptyCopy ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
              <PressableScale
                style={styles.emptyAction}
                accessibilityRole="button"
                accessibilityLabel={emptyCopy.action}
                onPress={() => {
                  if (emptyCopy.action === 'Retry' || emptyCopy.action === 'Refresh') void load(true)
                  else if (emptyCopy.action === 'Connect AI') router.push('/settings')
                  else if (emptyCopy.action === 'Open X') router.push('/x')
                  else if (emptyCopy.action === 'Connect X') router.push('/x/login')
                  else if (emptyCopy.action === 'Back to Today') selectFilter('all')
                  else if (emptyCopy.action === 'Ask Tru') inputRef.current?.focus()
                }}
              >
                <Text style={styles.emptyActionText}>{emptyCopy.action}</Text>
              </PressableScale>
            </View>
          ) : null
        }
      />

    </View>
  )
}

function AgentResultCard({
  state,
  onClose,
  onConfigure,
  onOpenSource,
}: {
  state: AgentState
  onClose: () => void
  onConfigure: () => void
  onOpenSource: (item: NewsItem) => void
}): JSX.Element | null {
  const styles = useThemedStyles(makeStyles)
  const [expanded, setExpanded] = useState(false)
  const presentation = useMemo(
    () => state.kind === 'answer' ? presentAgentText(state.result.text) : null,
    [state],
  )
  const citations = useMemo(() => {
    if (state.kind !== 'answer') return []
    const items: { number: number; source: NewsItem; short: string }[] = []
    for (const number of citedSourceNumbers(state.result.text)) {
      const source = state.result.sources[number - 1]
      if (!source) continue
      const short = getTrustedPublisher(source.sourceId)?.short
        ?? source.sourceId.slice(0, 3).toUpperCase()
      items.push({ number, source, short })
    }
    return items
  }, [state])
  const hasExpandableAnswer = presentation
    ? presentation.highlights.length > 3 || (!presentation.highlights.length && presentation.prose.length > 360)
    : false

  useEffect(() => setExpanded(false), [state.kind, state.kind === 'answer' ? state.result.text : null])
  if (state.kind === 'idle') return null

  return (
    <View style={styles.agentCard}>
      <View style={styles.agentCardHeader}>
        <View style={styles.agentCardCopy}>
          <Text style={styles.agentCardTitle}>{state.kind === 'loading' ? 'Tru is checking' : state.kind === 'answer' ? 'Tru finding' : state.kind === 'unconfigured' ? 'AI not configured' : 'Could not finish'}</Text>
          <Text style={styles.agentCardQuestion} numberOfLines={1}>{state.question}</Text>
        </View>
        <PressableScale style={styles.closeButton} onPress={onClose} haptic={false} accessibilityRole="button" accessibilityLabel="Close finding">
          <Ionicons name="close" size={19} color={styles.closeText.color} />
        </PressableScale>
      </View>

      {state.kind === 'loading' ? (
        <View style={styles.agentLoading}><ActivityIndicator size="small" color={styles.agentLoadingText.color} /><Text style={styles.agentLoadingText}>Searching trusted sources and checking claims</Text></View>
      ) : state.kind === 'unconfigured' ? (
        <View>
          <Text style={styles.agentBody}>Connect a Tru service in Settings to ask questions about your sources.</Text>
          <PressableScale style={styles.agentPrimary} onPress={onConfigure} accessibilityRole="button" accessibilityLabel="Open provider status"><Text style={styles.agentPrimaryText}>AI connection</Text></PressableScale>
        </View>
      ) : state.kind === 'error' ? (
        <View>
          <Text style={styles.agentBody}>{state.message}</Text>
          <PressableScale style={styles.agentPrimary} onPress={onConfigure} accessibilityRole="button" accessibilityLabel="Open provider status"><Text style={styles.agentPrimaryText}>AI connection</Text></PressableScale>
        </View>
      ) : (
        <View>
          <View style={styles.agentAnswerPanel}>
            <Text style={styles.agentSectionLabel}>{presentation?.heading ?? 'Key findings'}</Text>
            {presentation?.highlights.length ? (
              (expanded ? presentation.highlights : presentation.highlights.slice(0, 3)).map((highlight, index) => (
                <View key={`${index}:${highlight}`} style={styles.agentInsight}>
                  <View style={styles.agentInsightDot} />
                  <Text style={styles.agentInsightText}>{highlight}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.agentAnswer} numberOfLines={expanded ? undefined : 6}>{presentation?.prose || state.result.text}</Text>
            )}
          </View>

          {state.result.webGrounding?.detail ? (
            <Text style={styles.agentWebNote} numberOfLines={2}>{state.result.webGrounding.detail}</Text>
          ) : null}

          <View style={styles.agentFooter}>
            <View style={styles.agentSources}>
              {citations.slice(0, expanded ? citations.length : 3).map(({ number, source, short }) => (
                <PressableScale key={`${number}:${source.id}`} style={styles.agentSource} onPress={() => onOpenSource(source)} haptic={false} accessibilityRole="link" accessibilityLabel={`Open citation ${number}: ${source.title}`}>
                  <Ionicons name="link-outline" size={13} color={styles.agentSourceNumber.color} />
                  <Text style={styles.agentSourceName}>[{number}] {short}</Text>
                </PressableScale>
              ))}
              {!expanded && citations.length > 3 ? <Text style={styles.agentSourceMore}>+{citations.length - 3}</Text> : null}
            </View>
            <View style={styles.agentFooterMeta}>
              <Text style={styles.agentProvider} numberOfLines={1}>
                {state.result.webGrounding?.status === 'live' ? `${state.result.webGrounding.sourceCount} web` : 'Feed'} · {compactProviderLabel(state.result.providerLabel)} · {(state.result.elapsedMs / 1000).toFixed(1)}s
              </Text>
              {hasExpandableAnswer ? (
                <PressableScale style={styles.expandButton} onPress={() => setExpanded((value) => !value)} haptic={false} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={expanded ? 'Collapse finding' : 'Expand finding'}>
                  <Text style={styles.expandText}>{expanded ? 'Show less' : 'Show all'}</Text>
                </PressableScale>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const makeStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, width: '100%', maxWidth: 760, alignSelf: 'center' },
    top: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
    topRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
    topCopy: { flex: 1 },
    screenTitle: { color: t.text, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
    date: { color: t.textMuted, fontSize: 12, lineHeight: 14 },
    avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: t.accent, fontSize: 14, fontWeight: '600' },
    commandWrap: { marginHorizontal: 16, marginBottom: 8, minHeight: 52, minWidth: 0, paddingLeft: 9, paddingRight: 3, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 16, backgroundColor: t.surface },
    commandInput: { flex: 1, minWidth: 0, minHeight: 48, color: t.text, fontSize: 14, paddingHorizontal: 7, paddingVertical: 0 },
    runButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
    commandShortcut: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt },
    commandShortcutText: { color: t.text, fontSize: 14, fontWeight: '600' },
    controlRow: { height: 48, flexDirection: 'row', alignItems: 'stretch' },
    rankButton: { minHeight: 48, paddingLeft: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    rankText: { color: t.textMuted, fontSize: 12 },
    controlDivider: { width: StyleSheet.hairlineWidth, height: 18, alignSelf: 'center', backgroundColor: t.border },
    filterScroll: { flex: 1 },
    filters: { minHeight: 48, paddingHorizontal: 8, gap: 2 },
    filter: { minHeight: 48, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    filterActive: { borderBottomColor: t.accent },
    filterText: { color: t.textMuted, fontSize: 13 },
    filterTextActive: { color: t.text, fontWeight: '600' },
    listContent: { paddingBottom: 16 },
    sectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    sectionTitle: { color: t.text, fontSize: 14, fontWeight: '600' },
    sectionMeta: { color: t.textMuted, fontSize: 12 },
    xControl: { minHeight: 48, paddingLeft: 10, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
    xControlCopy: { flex: 1, justifyContent: 'center' }, xControlLabel: { color: t.text, fontSize: 14, fontWeight: '600' }, xControlStatus: { color: t.textMuted, fontSize: 12, marginTop: 1 },
    xChoice: { minWidth: 66, minHeight: 48, paddingHorizontal: 7, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center', justifyContent: 'center' }, xChoiceSafe: { borderBottomColor: t.positive }, xChoiceRaw: { borderBottomColor: t.warning }, xChoiceText: { color: t.textMuted, fontSize: 12, fontWeight: '700' }, xChoiceTextActive: { color: t.text },
    xHub: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, xHubText: { color: t.accent, fontSize: 12, fontWeight: '600' },
    empty: { alignItems: 'center', paddingVertical: 50 },
    emptyCard: { margin: 12, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 17, backgroundColor: t.surface },
    emptyTitle: { color: t.text, fontSize: 17, fontWeight: '600' },
    emptyBody: { color: t.textMuted, fontSize: 14, lineHeight: 18, marginTop: 7 },
    emptyAction: { alignSelf: 'flex-start', minHeight: 48, marginTop: 14, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
    emptyActionText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
    agentCard: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 24, backgroundColor: t.surface },
    agentCardHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
    agentCardCopy: { flex: 1, minWidth: 0 },
    agentCardTitle: { color: t.text, fontSize: 14, fontWeight: '600' },
    agentCardQuestion: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
    closeButton: { width: 48, height: 48, marginRight: -7, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: t.textMuted },
    agentLoading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    agentLoadingText: { color: t.textMuted, fontSize: 12, marginLeft: 8 },
    agentBody: { color: t.textMuted, fontSize: 14, lineHeight: 18, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    agentAnswerPanel: { paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    agentSectionLabel: { color: t.text, fontSize: 12, fontWeight: '600' },
    agentInsight: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 7 },
    agentInsightDot: { width: 4, height: 4, borderRadius: 2, marginTop: 6, marginRight: 8, backgroundColor: t.accent },
    agentInsightText: { flex: 1, color: t.text, fontSize: 14, lineHeight: 18 },
    agentAnswer: { color: t.text, fontSize: 14, lineHeight: 18, marginTop: 7 },
    agentWebNote: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7 },
    agentPrimary: { alignSelf: 'flex-start', minHeight: 48, marginTop: 10, paddingHorizontal: 13, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
    agentPrimaryText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
    agentFooter: { minHeight: 48, marginTop: 8, paddingTop: 1, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    agentSources: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
    agentSource: { minHeight: 48, marginRight: 2, paddingHorizontal: 3, flexDirection: 'row', gap: 3, alignItems: 'center' },
    agentSourceNumber: { color: t.accent },
    agentSourceName: { color: t.text, fontSize: 12, fontWeight: '700' },
    agentSourceMore: { color: t.textMuted, fontSize: 12, marginLeft: 1 },
    agentFooterMeta: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
    agentProvider: { maxWidth: 96, color: t.textMuted, fontSize: 12 },
    expandButton: { minHeight: 48, marginLeft: 2, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
    expandText: { color: t.accent, fontSize: 12, fontWeight: '600' },
  })
