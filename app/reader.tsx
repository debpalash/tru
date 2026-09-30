import { useCallback, useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { loadSavedFeedItems, toggleSavedFeedId, updateSavedOfflineText, type SavedFeedRecord } from '@/engine/feed/saved'
import { scrapeTrustedPage } from '@/engine/web/firecrawl'
import { PressableScale } from '@/ui/ios/PressableScale'
import { openLink } from '@/ui/openLink'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function ReaderScreen(): JSX.Element {
  const t = useTheme(); const styles = useThemedStyles(makeStyles); const { id = '' } = useLocalSearchParams<{ id?: string }>()
  const [item, setItem] = useState<SavedFeedRecord | null>(null); const [loading, setLoading] = useState(true); const [archiving, setArchiving] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { void loadSavedFeedItems().then((items) => setItem(items.find((candidate) => candidate.id === id) ?? null)).finally(() => setLoading(false)) }, [id])
  const archive = useCallback(async () => {
    if (!item?.url || archiving) return; setArchiving(true); setError(null)
    try { const text = await scrapeTrustedPage(item.url); if (!text) throw new Error('No readable article text was returned.'); const next = await updateSavedOfflineText(item.id, text); if (next) setItem(next) } catch (e) { setError(e instanceof Error ? e.message : 'Offline extraction failed.') } finally { setArchiving(false) }
  }, [archiving, item])
  const remove = useCallback(() => {
    if (!item) return
    Alert.alert('Remove saved story?', 'Its offline copy and saved evidence will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void toggleSavedFeedId(item.id).then(() => router.back()) },
    ])
  }, [item])
  return <SafeAreaView style={styles.screen}><AppHeader title="Reader" subtitle="Saved story" />{loading ? <ActivityIndicator style={{ marginTop: 50 }} color={t.accent} /> : !item ? <StateCard title="Saved item not found" body="It may have been removed from this device." /> : <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>{item.sourceName.toUpperCase()} · {item.evidenceScore}% {item.evidenceLabel.toUpperCase()}</Text><Text style={styles.title}>{item.title}</Text>{item.offlineText || item.summary ? <Text style={styles.body}>{item.offlineText ?? item.summary}</Text> : <Text style={styles.muted}>No summary saved. Download an excerpt or open the original.</Text>}{error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}<View style={styles.actions}><PressableScale style={styles.primary} disabled={!item.url} onPress={() => item.url && openLink(item.url, item.title)} accessibilityRole="link" accessibilityLabel={`Open original article: ${item.title}`} accessibilityState={{ disabled: !item.url }}><Text style={styles.primaryText}>Open original</Text></PressableScale><PressableScale style={styles.secondary} disabled={archiving} onPress={() => void archive()} accessibilityRole="button" accessibilityLabel={item.offlineText ? 'Refresh offline copy' : 'Download offline copy'} accessibilityState={{ busy: archiving, disabled: archiving }}>{archiving ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={styles.secondaryText}>{item.offlineText ? 'Refresh offline copy' : 'Download offline copy'}</Text>}</PressableScale></View><Text style={styles.section}>Sources</Text>{item.citations.length ? item.citations.map((citation) => <PressableScale key={citation.url} style={styles.citation} onPress={() => openLink(citation.url, citation.publisher)} accessibilityRole="link" accessibilityLabel={`Open verified source: ${citation.publisher}`}><Text style={styles.citationName}>{citation.publisher}</Text><Text style={styles.citationUrl} numberOfLines={1}>{citation.url}</Text></PressableScale>) : <Text style={styles.muted}>No additional sources saved.</Text>}<PressableScale style={styles.remove} onPress={remove} accessibilityRole="button" accessibilityLabel="Remove story from library" accessibilityHint="Asks for confirmation before removing the offline copy"><Text style={styles.removeText}>Remove from library</Text></PressableScale></ScrollView>}</SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({ screen: { flex: 1, backgroundColor: t.bg }, content: { padding: 16, paddingBottom: 50 }, kicker: { color: t.accent, fontSize: 12, fontWeight: '600', letterSpacing: 0.7 }, title: { color: t.text, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.5, marginTop: 7 }, body: { color: t.text, fontSize: 15, lineHeight: 23, marginTop: 16 }, muted: { color: t.textMuted, fontSize: 14, lineHeight: 18, marginTop: 14 }, error: { color: t.negative, fontSize: 12, marginTop: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 17 }, primary: { minHeight: 48, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent }, primaryText: { color: t.onAccent, fontSize: 14, fontWeight: '600' }, secondary: { minHeight: 48, paddingHorizontal: 12, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: t.textMuted, fontSize: 14, fontWeight: '600' }, section: { color: t.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: 25, marginBottom: 7 }, citation: { minHeight: 48, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, citationName: { color: t.text, fontSize: 14, fontWeight: '600' }, citationUrl: { color: t.textMuted, fontSize: 12, marginTop: 2 }, remove: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', marginTop: 20 }, removeText: { color: t.negative, fontSize: 14, fontWeight: '600' } })
