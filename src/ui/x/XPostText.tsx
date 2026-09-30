import { memo, useMemo, type JSX } from 'react'
import { Text, type GestureResponderEvent, type StyleProp, type TextStyle } from 'react-native'
import { router } from 'expo-router'

import { useTheme } from '@/ui/theme'

type Segment = { value: string; kind: 'text' | 'url' | 'mention' | 'hashtag' }
const TOKEN = /(https?:\/\/[^\s]+|@[A-Za-z0-9_]{1,15}|#[\p{L}\p{N}_]+)/gu

function segments(value: string): Segment[] {
  const output: Segment[] = []
  let cursor = 0
  for (const match of value.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > cursor) output.push({ value: value.slice(cursor, index), kind: 'text' })
    let token = match[0]
    let suffix = ''
    if (token.startsWith('http')) {
      const trailing = token.match(/[),.!?;:]+$/)?.[0] ?? ''
      if (trailing) {
        token = token.slice(0, -trailing.length)
        suffix = trailing
      }
    }
    output.push({ value: token, kind: token.startsWith('http') ? 'url' : token.startsWith('@') ? 'mention' : 'hashtag' })
    if (suffix) output.push({ value: suffix, kind: 'text' })
    cursor = index + match[0].length
  }
  if (cursor < value.length) output.push({ value: value.slice(cursor), kind: 'text' })
  return output
}

export const XPostText = memo(function XPostText({
  value,
  style,
  numberOfLines,
  onOpenPost,
  onLongPress,
  label,
}: {
  value: string
  style: StyleProp<TextStyle>
  numberOfLines?: number
  onOpenPost: () => void
  onLongPress: () => void
  label: string
}): JSX.Element {
  const theme = useTheme()
  const linkStyle = useMemo(() => ({ color: theme.accent }), [theme.accent])
  const parts = segments(value)
  const open = (event: GestureResponderEvent, part: Segment) => {
    event.stopPropagation()
    if (part.kind === 'mention') {
      router.push({ pathname: '/x/profile', params: { username: part.value.slice(1) } })
    } else if (part.kind === 'hashtag') {
      router.push({ pathname: '/x/search', params: { q: part.value } })
    } else if (part.kind === 'url') {
      let title = 'Link from X'
      try { title = new URL(part.value).hostname } catch { /* browser validates the URL */ }
      router.push({ pathname: '/browser', params: { url: part.value, title } })
    }
  }

  return <Text
    style={style}
    numberOfLines={numberOfLines}
    onPress={onOpenPost}
    onLongPress={onLongPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    suppressHighlighting={false}
  >
    {parts.map((part, index) => part.kind === 'text'
      ? <Text key={index}>{part.value}</Text>
      : <Text key={index} style={linkStyle} onPress={(event) => open(event, part)} accessibilityRole="link">{part.value}</Text>)}
  </Text>
})
