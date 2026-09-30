import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import { serviceHasWeb, useServiceConnected } from '@/engine/service/connection'
import { Button } from '@/ui/design/Button'
import { askFeedAgent, presentAgentText, type FeedAgentAnswer } from '@/engine/agent/feedAgent'
import { fetchNews } from '@/engine/news/feed'
import { getSource } from '@/engine/news/registry'
import type { NewsItem } from '@/engine/news/types'
import { researchTrustedWeb } from '@/engine/web/firecrawl'
import { PressableScale } from '@/ui/ios/PressableScale'
import { openLink } from '@/ui/openLink'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

const STARTERS = [
  { icon: 'git-compare-outline' as const, label: 'Compare coverage', prompt: 'Where do Reuters and AP differ on [topic]?' },
  { icon: 'checkmark-done-outline' as const, label: 'Check a claim', prompt: 'Verify [claim] against two independent reports.' },
  { icon: 'reader-outline' as const, label: 'Build a brief', prompt: 'Brief me on [event], separating confirmed facts from open questions.' },
]

export default function ResearchScreen(): JSX.Element {
  const connected = useServiceConnected()
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const abort = useRef<AbortController | null>(null)
  const inputRef = useRef<TextInput>(null)
  const params = useLocalSearchParams<{ q?: string }>()
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<FeedAgentAnswer | null>(null)
  const [sources, setSources] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState(0)
  const [groundingNote, setGroundingNote] = useState('')
  const presentation = useMemo(() => answer ? presentAgentText(answer.text) : null, [answer])

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (typeof params.q === 'string') {
      abort.current?.abort()
      setLoading(false)
      setQuery(params.q)
      setAnswer(null)
      setSources([])
      setError(null)
    }
  }, [params.q])

  const run = useCallback(async () => {
    const question = query.trim()
    if (!question || loading) return
    if (!connected) { router.push({ pathname: '/settings', params: { connect: '1' } }); return }
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError(null)
    setAnswer(null)
    setSources([])
    setCredits(0)
    setGroundingNote('')
    try {
      let context: NewsItem[] = []
      let note = ''
      let usedCredits = 0
      if (serviceHasWeb()) {
        try {
          const web = await researchTrustedWeb(question, controller.signal)
          context = web.items
          usedCredits = web.credits
          if (!context.length) note = 'No web matches; using current feed headlines.'
        } catch {
          if (controller.signal.aborted) return
          note = 'Web research unavailable; using current feed headlines.'
        }
      } else note = 'Based on current feed headlines; web research is not connected.'
      if (!context.length) {
        context = (await fetchNews('all', null)).filter((item) => getSource(item.sourceId)?.evidenceRole === 'editorial')
        const terms = question.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
        const relevance = (item: NewsItem) => terms.reduce((n, word) => n + Number(`${item.title} ${item.hover ?? ''}`.toLowerCase().includes(word)), 0)
        context.sort((a, b) => relevance(b) - relevance(a))
      }
      if (controller.signal.aborted) return
      if (!context.length) throw new Error('No sources available. Refresh Today and try again.')
      setGroundingNote(note)
      setCredits(usedCredits)
      const result = await askFeedAgent(question, context, controller.signal)
      if (!result) throw new Error('Research is unavailable. Check your AI connection in Settings and try again.')
      if (controller.signal.aborted) return
      setSources(result.sources)
      setAnswer(result)
    } catch (runError) {
      if (!controller.signal.aborted) setError(runError instanceof Error ? runError.message : 'Research failed.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [connected, loading, query])

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <AppHeader back={false} title="Ask" subtitle="Answers with sources" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.command}>
          <Ionicons name="search-outline" size={18} color={t.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void run()}
            placeholder="Ask about the news"
            placeholderTextColor={t.textMuted}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Research question"
          />
          <PressableScale
            style={[styles.run, (!query.trim() || loading) && styles.disabled]}
            disabled={!query.trim() || loading}
            onPress={() => void run()}
            accessibilityRole="button"
            accessibilityLabel="Run research"
            accessibilityState={{ busy: loading, disabled: !query.trim() || loading }}
          >
            {loading ? <ActivityIndicator size="small" color={t.onAccent} /> : <Ionicons name="arrow-up" size={17} color={t.onAccent} />}
          </PressableScale>
        </View>
        {!connected ? <View style={styles.connect}><Text style={styles.connectionLabel}>AI not connected</Text><Button label="Connect" variant="ghost" onPress={() => router.push({ pathname: '/settings', params: { connect: '1' } })} /></View> : null}

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={17} color={t.negative} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Couldn’t finish research</Text>
              <Text style={styles.errorBody}>{error}</Text>
            </View>
          </View>
        ) : null}

        {!loading && !answer && !error && !sources.length ? (
          <View style={styles.starters}>
            <Text style={styles.section}>Try asking</Text>
            {STARTERS.map((item) => (
              <PressableScale
                key={item.label}
                style={styles.starter}
                haptic={false}
                onPress={() => { setQuery(item.prompt); inputRef.current?.focus() }}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${item.prompt}`}
              >
                <View style={styles.starterIcon}><Ionicons name={item.icon} size={17} color={t.accent} /></View>
                <View style={styles.starterCopy}>
                  <Text style={styles.starterLabel}>{item.label}</Text>
                </View>
                <Ionicons name="arrow-forward" size={15} color={t.textMuted} />
              </PressableScale>
            ))}
          </View>
        ) : null}

        {answer && presentation ? (
          <View style={styles.answer}>
            <View style={styles.answerTop}>
              <Text style={styles.answerLabel}>{presentation.heading}</Text>
              <Text style={styles.answerMeta}>{answer.providerLabel} · {(answer.elapsedMs / 1000).toFixed(1)}s · {credits} credits</Text>
            </View>
            {groundingNote ? <Text style={styles.groundingNote}>{groundingNote}</Text> : null}
            {presentation.highlights.length ? presentation.highlights.map((line, index) => (
              <View key={`${index}:${line}`} style={styles.bullet}>
                <View style={styles.dot} />
                <Text style={styles.answerText}>{line}</Text>
              </View>
            )) : <Text style={styles.answerText}>{presentation.prose}</Text>}
          </View>
        ) : null}

        {sources.length ? (
          <>
            <Text style={styles.section}>Verified sources · {sources.length}</Text>
            <View style={styles.sourceGroup}>
              {sources.map((source, index) => (
                <PressableScale
                  key={source.id}
                  style={styles.source}
                  onPress={() => openLink(source.url, source.title)}
                  accessibilityRole="link"
                  accessibilityLabel={`Source ${index + 1}: ${source.title}`}
                >
                  <Text style={styles.sourceNo}>[{index + 1}]</Text>
                  <View style={styles.sourceCopy}>
                    <Text style={styles.sourceTitle} numberOfLines={2}>{source.title}</Text>
                    <Text style={styles.sourceMeta}>{source.sourceId}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={t.textMuted} />
                </PressableScale>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  connectionLabel: { color: t.textMuted, fontSize: 13 },
  connect: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  command: { marginHorizontal: 16, minHeight: 56, borderRadius: 16, backgroundColor: t.surface, paddingHorizontal: 8, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  input: { flex: 1, minWidth: 0, height: 48, color: t.text, fontSize: 14 },
  run: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
  disabled: { opacity: 0.4 },
  starters: { marginHorizontal: 16, marginTop: 16 },
  starter: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 6, backgroundColor: t.surface, flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  starterIcon: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center' },
  starterCopy: { flex: 1, minWidth: 0 },
  starterLabel: { color: t.text, fontSize: 14, lineHeight: 24, fontWeight: '600' },
  error: { minHeight: 58, margin: 10, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: t.negative, borderRadius: 9, backgroundColor: t.negativeSoft },
  errorCopy: { flex: 1 },
  errorTitle: { color: t.negative, fontSize: 14, fontWeight: '600' },
  errorBody: { color: t.negative, fontSize: 12, lineHeight: 18, marginTop: 3 },
  answer: { margin: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 16, backgroundColor: t.surface },
  groundingNote: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginVertical: 8 },
  answerTop: { minHeight: 30, flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' },
  answerLabel: { flex: 1, color: t.text, fontSize: 14, fontWeight: '600' },
  answerMeta: { color: t.textMuted, fontSize: 12 },
  bullet: { flexDirection: 'row', marginTop: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: t.accent, marginTop: 6, marginRight: 8 },
  answerText: { flex: 1, color: t.text, fontSize: 14, lineHeight: 22 },
  section: { minHeight: 34, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 5, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  sourceGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  source: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', gap: 7, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  sourceNo: { width: 28, color: t.accent, fontSize: 12, fontWeight: '600' },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceTitle: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  sourceMeta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
})
