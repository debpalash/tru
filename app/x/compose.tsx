import { useEffect, useMemo, useState, type JSX } from 'react'
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import Ionicons from '@expo/vector-icons/Ionicons'

import { createXPost } from '@/engine/x/client'
import { isGeneralAudienceSocialText } from '@/engine/news/safety'
import { useXSession } from '@/engine/x/session'
import { Button, Text } from '@/ui/design'
import { useHideTabBar } from '@/ui/navigation/useHideTabBar'
import { useKeyboardInset } from '@/ui/navigation/useKeyboardInset'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

const MAX_POST_LENGTH = 280

export default function XComposeScreen(): JSX.Element {
  const t = useTheme()
  useHideTabBar()
  const styles = useThemedStyles(makeStyles)
  const session = useXSession()
  const { replyTo, quoteId, quoteUsername, prompt } = useLocalSearchParams<{ replyTo?: string; quoteId?: string; quoteUsername?: string; prompt?: string }>()
  const draftKey = useMemo(() => `tru.x.draft.v1.${replyTo ? `reply.${replyTo}` : quoteId ? `quote.${quoteId}` : 'new'}`, [quoteId, replyTo])
  const [text, setText] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const keyboardInset = useKeyboardInset(52)
  const audienceSafe = !text.trim() || isGeneralAudienceSocialText(text)
  const valid = text.trim().length > 0 && text.length <= MAX_POST_LENGTH && audienceSafe

  useEffect(() => {
    let live = true
    void SecureStore.getItemAsync(draftKey).then((draft) => {
      if (live && draft) setText(draft.slice(0, MAX_POST_LENGTH))
    }).finally(() => { if (live) setHydrated(true) })
    return () => { live = false }
  }, [draftKey])

  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => {
      if (text) void SecureStore.setItemAsync(draftKey, text)
      else void SecureStore.deleteItemAsync(draftKey)
    }, 300)
    return () => clearTimeout(timer)
  }, [draftKey, hydrated, text])

  const send = async () => {
    if (!valid || sending) return
    setSending(true)
    setStatus(null)
    try {
      const result = await createXPost(text, { replyToId: replyTo, quoteId, quoteUsername })
      if (result.ok) {
        await SecureStore.deleteItemAsync(draftKey)
        router.back()
      } else {
        setStatus(result.message ?? 'X did not accept the post. Check the account and try again.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Post failed.')
    } finally {
      setSending(false)
    }
  }

  const context = replyTo ? 'Replying in a thread' : quoteId ? `Quoting @${quoteUsername || 'account'}` : null
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <AppHeader
        title={replyTo ? 'Reply' : quoteId ? 'Quote post' : 'New post'}
        subtitle={prompt ?? (hydrated ? 'Drafts save on this device' : 'Loading draft')}
        right={sending ? <View style={styles.busy}><ActivityIndicator size="small" color={t.accent} /></View> : <Button compact variant="primary" label="Post" disabled={!valid} onPress={() => void send()} />}
      />
      <View style={[styles.flex, keyboardInset ? { paddingBottom: keyboardInset } : null]}>
        {context ? (
          <View style={styles.context}>
            <Ionicons name={replyTo ? 'return-down-forward-outline' : 'chatbox-ellipses-outline'} size={17} color={t.textMuted} />
            <Text variant="metadata" tone="muted" numberOfLines={1}>{context}</Text>
          </View>
        ) : null}
        <View style={styles.editor}>
          <View style={styles.identity} accessibilityLabel={`Posting as @${session?.username ?? 'connected account'}`}>
            <Text variant="label" weight="900" style={styles.identityText}>{(session?.username?.[0] || 'X').toUpperCase()}</Text>
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder="What is worth sharing?"
            placeholderTextColor={t.textMuted}
            style={styles.input}
            maxLength={MAX_POST_LENGTH}
            accessibilityLabel="Post text"
            textAlignVertical="top"
          />
        </View>
        <View style={styles.footer}>
          <View style={styles.policy}>
            <Ionicons name={audienceSafe ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={17} color={audienceSafe ? t.positive : t.negative} />
            <Text variant="metadata" tone={audienceSafe ? 'muted' : 'negative'}>{audienceSafe ? 'General-audience text' : 'Explicit text is not supported'}</Text>
          </View>
          <Text variant="metadata" tone={text.length > 260 ? 'warning' : 'muted'} weight="700">{MAX_POST_LENGTH - text.length}</Text>
        </View>
        {status ? <Text variant="metadata" tone="negative" style={styles.error} accessibilityRole="alert">{status}</Text> : null}
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  flex: { flex: 1 },
  busy: { width: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  context: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, backgroundColor: t.surface },
  editor: { flex: 1, minHeight: 190, paddingHorizontal: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  identity: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  identityText: { color: t.textMuted },
  input: { flex: 1, minHeight: 180, color: t.text, fontSize: 17, lineHeight: 24, padding: 0 },
  footer: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  policy: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 6, alignItems: 'center' },
  error: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: t.negativeSoft },
})
