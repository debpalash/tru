import { memo, useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { VideoView, useVideoPlayer } from 'expo-video'
import { router } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'

import { privacyMediaUrl, usePrivacySnapshot } from '@/engine/privacy'
import { verifyXMedia, xMediaPreviewUrl, type XMediaSafety } from '@/engine/x/mediaSafety'
import { useXMediaMode } from '@/engine/x/mediaPreference'
import type { XMedia } from '@/engine/x/types'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'

type GridStyles = ReturnType<typeof makeStyles>

function InlineVideo({ item, styles }: { item: XMedia; styles: GridStyles }): JSX.Element {
  const [ready, setReady] = useState(false)
  const playbackUrl = item.playbackUrl ? privacyMediaUrl(item.playbackUrl) : null
  const posterUrl = privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))
  const source = playbackUrl ? { uri: playbackUrl, contentType: 'progressive' as const, useCaching: true } : null
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true
    instance.muted = true
    instance.play()
  })

  useEffect(() => setReady(false), [item.playbackUrl])

  return <View style={styles.fill} pointerEvents="none">
    <Image source={posterUrl} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={`${item.previewUrl}:inline-poster`} transition={0} />
    {playbackUrl ? <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls={false} surfaceType="textureView" onFirstFrameRender={() => setReady(true)} /> : null}
    {!ready ? <Image source={posterUrl} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={`${item.previewUrl}:inline-cover`} transition={0} /> : null}
    {item.kind === 'gif' ? <View style={styles.gifBadge}><Text style={styles.gifText}>GIF</Text></View> : <View style={styles.mutedBadge}><Ionicons name="volume-mute" size={13} color="#fff" /></View>}
  </View>
}

function Cell({
  item,
  index,
  count,
  style,
  active,
  inline,
  failed,
  onError,
  onPress,
  styles,
}: {
  item: XMedia
  index: number
  count: number
  style: StyleProp<ViewStyle>
  active: boolean
  inline: boolean
  failed: boolean
  onError: () => void
  onPress: () => void
  styles: GridStyles
}): JSX.Element {
  const video = item.kind !== 'photo'
  const autoplay = inline && active && video && Boolean(item.playbackUrl)
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, style, pressed && styles.cellPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.alt || `Open ${item.kind} ${index + 1} of ${count}`}
    >
      {autoplay ? <InlineVideo item={item} styles={styles} /> : <Image
        source={privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))}
        style={styles.fill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`${item.previewUrl}:${index}`}
        transition={0}
        allowDownscaling
        accessible={false}
        onError={onError}
      />}
      {failed ? <View style={styles.imageError}><Ionicons name="image-outline" size={18} color={styles.imageErrorText.color} /><Text style={styles.imageErrorText}>Preview unavailable</Text></View> : null}
      {video && !autoplay ? <View style={styles.play} pointerEvents="none">
        {item.kind === 'gif' ? <Text style={styles.playText}>GIF</Text> : <Ionicons name="play" size={20} color="#fff" />}
      </View> : null}
    </Pressable>
  )
}

function MediaLayout({
  items,
  active,
  inline,
  failed,
  open,
  fail,
  styles,
}: {
  items: XMedia[]
  active: boolean
  inline: boolean
  failed: Set<number>
  open: (index: number) => void
  fail: (index: number) => void
  styles: GridStyles
}): JSX.Element {
  const cell = (item: XMedia, index: number, style: StyleProp<ViewStyle>) => <Cell
    key={`${item.previewUrl}:${index}`}
    item={item}
    index={index}
    count={items.length}
    style={style}
    active={active}
    inline={inline && items.length === 1}
    failed={failed.has(index)}
    onError={() => fail(index)}
    onPress={() => open(index)}
    styles={styles}
  />

  if (items.length === 1) return cell(items[0], 0, styles.fill)
  if (items.length === 2) return <View style={styles.rowFill}>{cell(items[0], 0, styles.half)}<View style={styles.gapH} />{cell(items[1], 1, styles.half)}</View>
  if (items.length === 3) return <View style={styles.rowFill}>
    {cell(items[0], 0, styles.half)}
    <View style={styles.gapH} />
    <View style={styles.half}>{cell(items[1], 1, styles.fill)}<View style={styles.gapV} />{cell(items[2], 2, styles.fill)}</View>
  </View>
  return <View style={styles.fill}>
    <View style={styles.gridRow}>{cell(items[0], 0, styles.half)}<View style={styles.gapH} />{cell(items[1], 1, styles.half)}</View>
    <View style={styles.gapV} />
    <View style={styles.gridRow}>{cell(items[2], 2, styles.half)}<View style={styles.gapH} />{cell(items[3], 3, styles.half)}</View>
  </View>
}

export const XMediaPreview = memo(function XMediaPreview({
  media = [],
  postUrl,
  sensitive = false,
  compact = false,
  active = false,
}: {
  media?: XMedia[]
  postUrl: string
  sensitive?: boolean
  compact?: boolean
  active?: boolean
}): JSX.Element | null {
  const styles = useThemedStyles(makeStyles)
  const mode = useXMediaMode()
  const privacy = usePrivacySnapshot()
  const reducedMotion = useReducedMotion()
  const [verdict, setVerdict] = useState<XMediaSafety | 'checking'>('checking')
  const mediaKey = media.map(item => item.previewUrl).join('|')
  const [verifiedKey, setVerifiedKey] = useState('')
  const [failed, setFailed] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    let current = true
    setVerdict('checking')
    setFailed(new Set())
    if (!media.length) return () => { current = false }
    if (mode === 'hidden') {
      setVerdict('unsafe')
      return () => { current = false }
    }
    if (sensitive) {
      setVerdict('unsafe')
      return () => { current = false }
    }
    void verifyXMedia(media).then((result) => { if (current) { setVerdict(result); setVerifiedKey(mediaKey) } })
    return () => { current = false }
  }, [media, mediaKey, mode, sensitive])

  if (!media.length) return null
  const shown = media.slice(0, 4)
  const frame = [styles.grid, compact && styles.compactGrid]
  if ((privacy.torEnabled || (privacy.proxy.enabled && !privacy.relayEnabled))) return <Pressable
    style={({ pressed }) => [frame, pressed && styles.cellPressed]}
    onPress={() => router.push('/settings')}
    accessibilityRole="button"
    accessibilityLabel="Media blocked to prevent a direct connection. Open privacy settings"
  >
    <View style={styles.status}><Ionicons name="shield-checkmark-outline" size={19} color={styles.hiddenText.color} /><Text style={styles.hiddenTitle}>Direct media blocked</Text><Text style={styles.hiddenText}>{privacy.torEnabled ? 'Tor is strict' : 'X proxy is strict'} · media stays covered</Text></View>
  </Pressable>
  if (mode === 'safe' && !sensitive && (verdict === 'checking' || verifiedKey !== mediaKey)) return <View style={frame} accessible accessibilityRole="progressbar" accessibilityLabel="Checking X media">
    <View style={styles.status}><ActivityIndicator size="small" color={styles.statusText.color} /><Text style={styles.statusText}>Checking preview</Text></View>
  </View>
  if (mode === 'hidden' || sensitive || verdict !== 'safe') return <Pressable
    style={({ pressed }) => [frame, pressed && styles.cellPressed]}
    onPress={() => router.push('/settings')}
    accessibilityRole="button"
    accessibilityLabel={`${verdict === 'unsafe' ? 'Sensitive media covered' : 'Media verification unavailable'}. Open media settings`}
  >
    <View style={styles.status}><Ionicons name="eye-off-outline" size={19} color={styles.hiddenText.color} /><Text style={styles.hiddenTitle}>{verdict === 'unsafe' ? 'Sensitive media covered' : 'Preview not verified'}</Text><Text style={styles.hiddenText}>Open media settings</Text></View>
  </Pressable>

  const open = (index: number) => router.push({ pathname: '/x/media', params: { items: JSON.stringify(shown), index: String(index), postUrl, sensitive: sensitive ? '1' : '0' } })
  const fail = (index: number) => setFailed((current) => {
    const next = new Set(current)
    next.add(index)
    return next
  })
  return <View style={frame}>
    <MediaLayout items={shown} active={active} inline={!reducedMotion} failed={failed} open={open} fail={fail} styles={styles} />
  </View>
})

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  grid: { width: '100%', aspectRatio: 16 / 9, marginTop: 6, overflow: 'hidden', borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.skeleton },
  compactGrid: { aspectRatio: 2.2 },
  fill: { ...StyleSheet.absoluteFill },
  rowFill: { flex: 1, flexDirection: 'row' },
  gridRow: { flex: 1, flexDirection: 'row' },
  half: { flex: 1 },
  gapH: { width: 2 },
  gapV: { height: 2 },
  cell: { overflow: 'hidden', backgroundColor: t.surfaceAlt },
  cellPressed: { opacity: 0.82 },
  status: { flex: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.surface },
  statusText: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  hiddenTitle: { color: t.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  hiddenText: { color: t.textMuted, fontSize: 12, lineHeight: 18 },
  imageError: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: t.surfaceAlt },
  imageErrorText: { color: t.textMuted, fontSize: 12 },
  play: { position: 'absolute', left: '50%', top: '50%', width: 42, height: 42, marginLeft: -21, marginTop: -21, borderRadius: 21, alignItems: 'center', justifyContent: 'center', paddingLeft: 2, backgroundColor: 'rgba(0,0,0,0.58)' },
  playText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  gifBadge: { position: 'absolute', left: 7, bottom: 7, height: 21, paddingHorizontal: 6, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.66)' },
  gifText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mutedBadge: { position: 'absolute', right: 7, bottom: 7, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.66)' },
})
