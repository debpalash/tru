import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { fetchXDmConversation, sendXDm } from '@/engine/x/client'
import { useXSession } from '@/engine/x/session'
import type { XDmMessage } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useHideTabBar } from '@/ui/navigation/useHideTabBar'
import { useKeyboardInset } from '@/ui/navigation/useKeyboardInset'
import { AppHeader } from '@/ui/shell/AppHeader'
import { StateCard } from '@/ui/shell/StateCard'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

const POLL_MS = 12_000

function clock(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function XDmScreen(): JSX.Element {
  useHideTabBar()
  const keyboardInset = useKeyboardInset(56)
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const { id = '', name = 'Conversation', username = '' } = useLocalSearchParams<{ id?: string; name?: string; username?: string }>()
  const live = useRef(true)
  const [messages, setMessages] = useState<XDmMessage[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [older, setOlder] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => { live.current = false }, [])

  const merge = useCallback((incoming: XDmMessage[], prepend = false) => {
    setMessages((current) => {
      const merged = [...new Map((prepend ? [...incoming, ...current] : [...current, ...incoming]).map((item) => [item.id, item])).values()]
      return merged.sort((a, b) => a.createdAt - b.createdAt)
    })
  }, [])
  const load = useCallback(async (next = '') => {
    if (!id || !session) { setLoading(false); return }
    if (next) setOlder(true); else setLoading(true)
    setError(null)
    try {
      const page = await fetchXDmConversation(id, next)
      if (live.current) { merge(page.messages, Boolean(next)); setCursor(page.cursor) }
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : 'Conversation unavailable.') }
    finally { if (live.current) { setLoading(false); setOlder(false) } }
  }, [id, merge, session])
  useEffect(() => { void load() }, [load])
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => { void fetchXDmConversation(id).then((page) => { if (live.current) merge(page.messages) }).catch(() => {}) }, POLL_MS)
    return () => clearInterval(timer)
  }, [id, merge]))

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending || !id) return
    const optimistic: XDmMessage = { id: `local-${Date.now()}`, conversationId: id, senderId: session?.userId || 'me', text, createdAt: Date.now() }
    setDraft(''); setSending(true); merge([optimistic])
    try {
      if (!await sendXDm(id, text)) throw new Error('X did not confirm the message.')
      const page = await fetchXDmConversation(id)
      if (live.current) { setMessages((current) => current.filter((item) => item.id !== optimistic.id)); merge(page.messages) }
    } catch (cause) {
      if (live.current) { setMessages((current) => current.filter((item) => item.id !== optimistic.id)); setDraft(text); Alert.alert('Message not sent', cause instanceof Error ? cause.message : 'Try again.') }
    } finally { if (live.current) setSending(false) }
  }, [draft, id, merge, sending, session?.userId])

  const data = useMemo(() => [...messages].reverse(), [messages])
  const state = !session ? <StateCard title="Connect X" body="Sign in to open this conversation." action="Connect" onAction={() => router.push('/x/login')} />
    : loading ? <StateCard title="Loading conversation" loading />
      : error && !messages.length ? <StateCard title="Conversation needs attention" body={error} action="Retry" onAction={() => void load()} /> : null

  return <SafeAreaView style={styles.screen}>
    <AppHeader title={name} subtitle={username ? `@${username} · X messages` : 'X messages'} />
    <View style={[styles.flex, keyboardInset ? { paddingBottom: keyboardInset } : null]}>
      <FlatList
        data={state ? [] : data}
        inverted
        keyExtractor={(item) => item.id}
        ListHeaderComponent={state}
        contentContainerStyle={styles.list}
        onEndReached={() => { if (cursor && !older) void load(cursor) }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) => {
          const own = item.senderId === session?.userId || item.id.startsWith('local-')
          return <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}><Text style={[styles.message, own && styles.messageOwn]}>{item.text || (item.mediaUrl ? 'Media attachment' : '')}</Text>{item.mediaUrl ? <PressableScale style={styles.attachment} onPress={() => router.push({ pathname: '/browser', params: { url: item.mediaUrl!, title: 'X message media' } })} accessibilityRole="link" accessibilityLabel="Open message media"><Text style={styles.attachmentText}>Open media</Text></PressableScale> : null}<Text style={[styles.time, own && styles.timeOwn]}>{clock(item.createdAt)}{item.id.startsWith('local-') ? ' · sending' : ''}</Text></View>
        }}
      />
      <View style={styles.composer}><TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={styles.placeholder.color} multiline maxLength={10_000} accessibilityLabel="Message text" /><PressableScale style={[styles.send, (!draft.trim() || sending) && styles.sendDisabled]} disabled={!draft.trim() || sending} onPress={() => void send()} accessibilityRole="button" accessibilityLabel="Send message"><Text style={styles.sendText}>{sending ? 'Sending' : 'Send'}</Text></PressableScale></View>
    </View>
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg }, flex: { flex: 1 }, list: { paddingHorizontal: 9, paddingVertical: 7 },
  bubble: { maxWidth: '82%', minWidth: 58, marginVertical: 2.5, paddingHorizontal: 9, paddingTop: 7, paddingBottom: 5, borderRadius: 11 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: t.accent, borderBottomRightRadius: 3 }, bubbleOther: { alignSelf: 'flex-start', backgroundColor: t.surfaceAlt, borderBottomLeftRadius: 3 },
  message: { color: t.text, fontSize: 14, lineHeight: 18 }, messageOwn: { color: t.onAccent }, time: { alignSelf: 'flex-end', color: t.textMuted, fontSize: 12, marginTop: 3 }, timeOwn: { color: t.onAccent },
  attachment: { minHeight: 48, marginTop: 5, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: t.accentSoft }, attachmentText: { color: t.accent, fontSize: 12, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, backgroundColor: t.surface },
  input: { flex: 1, maxHeight: 104, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, color: t.text, fontSize: 14, backgroundColor: t.surfaceAlt }, placeholder: { color: t.textMuted },
  send: { minWidth: 64, height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent }, sendDisabled: { opacity: 0.35 }, sendText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
})
