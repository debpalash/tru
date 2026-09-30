import { memo, useCallback, useState, type JSX } from 'react'
import { Alert, Share, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import { deleteXPost, setXBookmark, setXLike, setXRepost } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XPost } from '@/engine/x/types'
import { haptics } from '@/ui/haptics'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XMediaPreview } from './XMediaPreview'
import { XAvatar } from './XAvatar'
import { XPostText } from './XPostText'

function compact(n: number): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

function ago(time: number): string {
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60_000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}

function optimisticCount(value: number, initial: boolean, current: boolean): number {
  return Math.max(0, value + Number(current) - Number(initial))
}

export const XPostRow = memo(function XPostRow({ post, thread = false, threadLast = false, active = false }: { post: XPost; thread?: boolean; threadLast?: boolean; active?: boolean }): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const [liked, setLiked] = useState(post.liked)
  const [reposted, setReposted] = useState(post.reposted)
  const [bookmarked, setBookmarked] = useState(post.bookmarked)
  const [pending, setPending] = useState<'like' | 'repost' | 'bookmark' | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const own = session?.userId === post.user.id || session?.username?.toLowerCase() === post.user.username.toLowerCase()
  const postUrl = `https://x.com/${post.user.username}/status/${post.id}`
  const openPost = useCallback(() => router.push({ pathname: '/x/status', params: { id: post.id } }), [post.id])
  const sharePost = useCallback(() => {
    void Share.share({ message: postUrl, url: postUrl }).catch(() => Alert.alert('Share failed', 'Open the post and try again.'))
  }, [postUrl])

  const showMenu = useCallback(() => {
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Share post', onPress: sharePost },
      { text: 'Open on X', onPress: () => router.push({ pathname: '/browser', params: { url: postUrl, title: 'X post' } }) },
      { text: 'Quote post', onPress: () => router.push({ pathname: '/x/compose', params: { quoteId: post.id, quoteUsername: post.user.username, prompt: `Quote @${post.user.username}` } }) },
    ]
    if (own) buttons.push({ text: 'Delete post', style: 'destructive', onPress: () => Alert.alert('Delete this post?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteXPost(post.id).then(() => setDeleted(true)).catch((error) => Alert.alert('Delete failed', error instanceof Error ? error.message : 'Try again shortly.')) }]) })
    buttons.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Post actions', undefined, buttons)
  }, [own, post.id, post.user.username, postUrl, sharePost])

  const toggle = useCallback(async (kind: 'like' | 'repost' | 'bookmark') => {
    if (pending) return
    const before = kind === 'like' ? liked : kind === 'repost' ? reposted : bookmarked
    if (kind === 'like') setLiked(!before)
    else if (kind === 'repost') setReposted(!before)
    else setBookmarked(!before)
    haptics.light()
    setPending(kind)
    try {
      const ok = kind === 'like'
        ? await setXLike(post.id, !before)
        : kind === 'repost'
          ? await setXRepost(post.id, !before)
          : await setXBookmark(post.id, !before)
      if (ok) return
      throw new Error('X did not confirm this action.')
    } catch (error) {
      if (kind === 'like') setLiked(before)
      else if (kind === 'repost') setReposted(before)
      else setBookmarked(before)
      Alert.alert('X action failed', error instanceof Error ? error.message : 'Try again shortly.')
    } finally {
      setPending(null)
    }
  }, [bookmarked, liked, pending, post.id, reposted])

  if (deleted) return <View style={styles.deleted}><Text style={styles.deletedText}>Post deleted</Text></View>
  const collapsible = !thread && (post.text.length > 620 || post.text.split('\n').length > 12)

  return (
    <View style={styles.row}>
      <View style={styles.avatarRail}>
        <PressableScale
          style={styles.avatarButton}
          onPress={() => router.push({ pathname: '/x/profile', params: { username: post.user.username } })}
          haptic={false}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.user.name}'s profile`}
        >
          <View style={styles.avatarWrap}><XAvatar url={post.user.avatar} name={post.user.name} size={42} /></View>
        </PressableScale>
        {thread && !threadLast ? <View style={styles.threadLine} /> : null}
      </View>
      <View style={styles.content}>
        {post.repostedBy ? <View style={styles.contextRow}><Ionicons name="repeat-outline" size={12} color={styles.context.color} /><Text style={styles.context}>{post.repostedBy.name} reposted</Text></View> : null}
        <View style={styles.byline}>
          <Text style={styles.name} numberOfLines={1}>{post.user.name}</Text>
          {post.user.verified ? <Ionicons name="checkmark-circle" size={13} color={styles.verified.color} style={styles.verifiedIcon} /> : null}
          <Text style={styles.handle} numberOfLines={1}>@{post.user.username} · {ago(post.createdAt)}</Text>
          <PressableScale style={styles.more} haptic={false} onPress={showMenu} accessibilityRole="button" accessibilityLabel="Post actions"><Ionicons name="ellipsis-horizontal" size={17} color={styles.moreText.color} /></PressableScale>
        </View>
        <View style={styles.postCopy}>
          {post.replyToUsername ? <Text style={styles.context}>Replying to @{post.replyToUsername}</Text> : null}
          <XPostText value={post.text} style={[styles.text, thread && styles.threadText]} numberOfLines={collapsible && !expanded ? 12 : undefined} onOpenPost={openPost} onLongPress={showMenu} label={`Open post by ${post.user.name}: ${post.text}`} />
          {collapsible && !expanded ? <PressableScale style={styles.showMore} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} onPress={() => setExpanded(true)} haptic={false} accessibilityRole="button" accessibilityLabel="Show the full post"><Text style={styles.showMoreText}>Show more</Text></PressableScale> : null}
        </View>
        <XMediaPreview media={post.media} postUrl={postUrl} sensitive={post.sensitive} active={active} />
        {post.poll ? <View style={styles.poll}>{post.poll.options.slice(0, 4).map((option) => {
          const percent = post.poll!.totalVotes ? Math.round((option.votes / post.poll!.totalVotes) * 100) : 0
          return <View key={option.label} style={styles.pollOption}><View style={[styles.pollFill, { width: `${Math.min(100, percent)}%` }]} /><Text style={styles.pollLabel} numberOfLines={1}>{option.label}</Text><Text style={styles.pollPercent}>{percent}%</Text></View>
        })}<Text style={styles.pollMeta}>{compact(post.poll.totalVotes)} votes{post.poll.status ? ` · ${post.poll.status}` : ''}</Text></View> : null}
        {post.card ? <PressableScale style={styles.linkCard} haptic={false} onPress={() => router.push({ pathname: '/browser', params: { url: post.card!.url, title: post.card!.title } })} accessibilityRole="link" accessibilityLabel={`Open link: ${post.card.title}, ${post.card.display}`}><Text style={styles.linkDomain} numberOfLines={1}>{post.card.display}</Text><Text style={styles.linkTitle} numberOfLines={2}>{post.card.title}</Text>{post.card.description ? <Text style={styles.linkDescription} numberOfLines={2}>{post.card.description}</Text> : null}</PressableScale> : null}
        {post.quote ? <View style={styles.quote}>
          <PressableScale style={styles.quoteCopy} haptic={false} onPress={() => router.push({ pathname: '/x/status', params: { id: post.quote!.id } })} accessibilityRole="button" accessibilityLabel={`Open quoted post by ${post.quote.user.name}: ${post.quote.text}`}>
            <View style={styles.quoteByline}><XAvatar url={post.quote.user.avatar} name={post.quote.user.name} size={20} /><Text style={styles.quoteName} numberOfLines={1}>{post.quote.user.name}</Text>{post.quote.user.verified ? <Ionicons name="checkmark-circle" size={12} color={styles.verified.color} /> : null}<Text style={styles.quoteHandle} numberOfLines={1}>@{post.quote.user.username} · {ago(post.quote.createdAt)}</Text></View>
            <Text style={styles.quoteText} numberOfLines={4}>{post.quote.text}</Text>
          </PressableScale>
          <XMediaPreview media={post.quote.media} postUrl={`https://x.com/${post.quote.user.username}/status/${post.quote.id}`} sensitive={post.quote.sensitive} compact />
        </View> : null}
        {post.communityNote ? <View style={styles.note}><Ionicons name="document-text-outline" size={16} color={styles.noteText.color} /><View style={styles.noteCopy}><Text style={styles.noteTitle}>Community note</Text><Text style={styles.noteText}>{post.communityNote}</Text></View></View> : null}
        <View style={styles.actions}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`${post.replies} replies`} style={styles.metric} onPress={() => router.push({ pathname: '/x/compose', params: { replyTo: post.id, prompt: `Reply to @${post.user.username}` } })} haptic="light"><Ionicons name="chatbubble-outline" size={15} color={styles.metricIcon.color} /><Text style={styles.metricText}>{compact(post.replies)}</Text></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel={reposted ? 'Undo repost' : 'Repost'} accessibilityState={{ selected: reposted, disabled: pending === 'repost', busy: pending === 'repost' }} style={styles.metric} disabled={pending === 'repost'} onPress={() => void toggle('repost')} onLongPress={() => router.push({ pathname: '/x/compose', params: { quoteId: post.id, quoteUsername: post.user.username, prompt: `Quote @${post.user.username}` } })} haptic={false}><Ionicons name="repeat-outline" size={17} color={reposted ? styles.reposted.color : styles.metricIcon.color} /><Text style={[styles.metricText, reposted && styles.reposted]}>{compact(optimisticCount(post.reposts, post.reposted, reposted))}</Text></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} accessibilityState={{ selected: liked, disabled: pending === 'like', busy: pending === 'like' }} style={styles.metric} disabled={pending === 'like'} onPress={() => void toggle('like')} haptic={false}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? styles.liked.color : styles.metricIcon.color} /><Text style={[styles.metricText, liked && styles.liked]}>{compact(optimisticCount(post.likes, post.liked, liked))}</Text></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark'} accessibilityState={{ selected: bookmarked, disabled: pending === 'bookmark' }} style={styles.save} disabled={pending === 'bookmark'} onPress={() => void toggle('bookmark')} haptic={false}><Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={16} color={bookmarked ? styles.saved.color : styles.metricIcon.color} /></PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Share post" style={styles.save} onPress={sharePost} haptic={false}><Ionicons name="share-outline" size={17} color={styles.metricIcon.color} /></PressableScale>
        </View>
      </View>
    </View>
  )
})

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 9, paddingTop: 7, paddingBottom: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.bg },
  deleted: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }, deletedText: { color: t.textMuted, fontSize: 12 },
  avatarRail: { width: 48, marginLeft: -5, alignItems: 'center' },
  avatarButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'flex-start' },
  avatarWrap: { paddingTop: 1 },
  threadLine: { position: 'absolute', top: 47, bottom: -2, left: 23, width: 2, borderRadius: 1, backgroundColor: t.borderStrong },
  content: { flex: 1, minWidth: 0 },
  byline: { minHeight: 24, paddingRight: 40, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  name: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600', maxWidth: '42%' },
  verified: { color: t.accent },
  verifiedIcon: { marginLeft: 3 },
  handle: { flex: 1, color: t.textMuted, fontSize: 12, lineHeight: 18, marginLeft: 4 },
  more: { position: 'absolute', width: 48, height: 48, right: -8, top: -12, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: t.textMuted },
  contextRow: { minHeight: 18, flexDirection: 'row', gap: 4, alignItems: 'center' },
  context: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  postCopy: { paddingTop: 1, paddingBottom: 2 },
  text: { color: t.text, fontSize: 14, lineHeight: 24 },
  threadText: { fontSize: 15, lineHeight: 21 },
  showMore: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  showMoreText: { color: t.accent, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  poll: { gap: 3, marginTop: 5 },
  pollOption: { minHeight: 30, overflow: 'hidden', borderRadius: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, backgroundColor: t.surfaceAlt },
  pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: t.accentSoft },
  pollLabel: { flex: 1, color: t.text, fontSize: 12, fontWeight: '700' },
  pollPercent: { color: t.textMuted, fontSize: 12, fontWeight: '600', marginLeft: 6 },
  pollMeta: { color: t.textMuted, fontSize: 12, marginTop: 1 },
  linkCard: { minHeight: 48, marginTop: 5, padding: 8, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.surface },
  linkDomain: { color: t.textMuted, fontSize: 12 },
  linkTitle: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600', marginTop: 2 },
  linkDescription: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  quote: { minHeight: 48, marginTop: 6, padding: 7, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.surface },
  quoteCopy: { minHeight: 44 },
  quoteByline: { minHeight: 23, flexDirection: 'row', alignItems: 'center', gap: 4 },
  quoteName: { maxWidth: '36%', color: t.text, fontSize: 12, fontWeight: '600' },
  quoteHandle: { flex: 1, color: t.textMuted, fontSize: 12 },
  quoteText: { color: t.text, fontSize: 14, lineHeight: 22, marginTop: 3 },
  note: { marginTop: 6, padding: 8, borderRadius: 7, flexDirection: 'row', gap: 7, backgroundColor: t.warningSoft },
  noteCopy: { flex: 1, minWidth: 0 },
  noteTitle: { color: t.warning, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  noteText: { color: t.warning, fontSize: 12, lineHeight: 18, marginTop: 1 },
  actions: { height: 48, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, minWidth: 48, height: 48, flexDirection: 'row', gap: 4, alignItems: 'center' },
  metricIcon: { color: t.textMuted },
  metricText: { color: t.textMuted, fontSize: 12 },
  reposted: { color: t.retweet },
  liked: { color: t.like },
  saved: { color: t.bookmark },
  save: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
})
