import { useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchItem, fetchThread, toStory } from '@/engine/hn/api'
import type { Comment, Story } from '@/engine/hn/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { openLink } from '@/ui/openLink'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

function CommentRow({ comment }: { comment: Comment }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  return <View><View style={[styles.comment, { marginLeft: Math.min(comment.depth, 5) * 11 }]}><View style={styles.commentRule} /><View style={styles.commentCopy}><Text style={styles.commentMeta}>{comment.by}</Text><Text style={styles.commentText}>{comment.text}</Text></View></View>{comment.replies.map((reply) => <CommentRow key={reply.id} comment={reply} />)}</View>
}

export default function HnThreadScreen(): JSX.Element {
  const t = useTheme(); const styles = useThemedStyles(makeStyles); const { id = '' } = useLocalSearchParams<{ id?: string }>()
  const [story, setStory] = useState<Story | null>(null); const [comments, setComments] = useState<Comment[]>([]); const [commentsLoading, setCommentsLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; void (async () => { try { const raw = await fetchItem(Number(id)); if (!raw) throw new Error('HN story not found.'); if (live) setStory(toStory(raw)); const result = await fetchThread(Number(id), 50); if (live) { setStory(result.story); setComments(result.comments) } } catch (e) { if (live) setError(e instanceof Error ? e.message : 'Thread unavailable.') } finally { if (live) setCommentsLoading(false) } })(); return () => { live = false } }, [id])
  const storyCard = story ? <><Text style={styles.storyTitle}>{story.title}</Text><Text style={styles.storyMeta}>{story.domain ?? 'Ask HN'} · {story.by}</Text>{story.text ? <Text style={styles.storyBody}>{story.text}</Text> : null}</> : null
  return <SafeAreaView style={styles.screen}><AppHeader title="HN discussion" subtitle={story ? `${story.commentCount} comments · ${story.score} points` : 'Loading story'} /><ScrollView contentContainerStyle={styles.content}>{error ? <StateCard title="Thread unavailable" body={error} /> : !story ? <ActivityIndicator color={t.accent} /> : <>{story.url ? <PressableScale style={styles.story} onPress={() => openLink(story.url!, story.title)} accessibilityRole="link" accessibilityLabel={`Open original story: ${story.title}`}>{storyCard}</PressableScale> : <View style={styles.story} accessible accessibilityRole="summary" accessibilityLabel={`${story.title}, by ${story.by}`}>{storyCard}</View>}<Text style={styles.section}>DISCUSSION · {commentsLoading ? 'LOADING' : `${comments.length} LOADED`}</Text>{commentsLoading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 14 }} /> : null}{comments.map((comment) => <CommentRow key={comment.id} comment={comment} />)}</>}</ScrollView></SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, content: { paddingVertical: 10, paddingBottom: 45 }, story: { marginHorizontal: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.warning, backgroundColor: t.warningSoft }, storyTitle: { color: t.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }, storyMeta: { color: t.warning, fontSize: 12, marginTop: 5 }, storyBody: { color: t.textMuted, fontSize: 14, lineHeight: 18, marginTop: 8 }, section: { color: t.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginHorizontal: 13, marginTop: 16, marginBottom: 5 }, comment: { flexDirection: 'row', paddingRight: 10, paddingVertical: 8 }, commentRule: { width: 2, borderRadius: 1, backgroundColor: t.border, marginRight: 8 }, commentCopy: { flex: 1 }, commentMeta: { color: t.warning, fontSize: 12, fontWeight: '700' }, commentText: { color: t.text, fontSize: 14, lineHeight: 18, marginTop: 3 },
})
