import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { ActivityIndicator, Alert, FlatList, Share, StyleSheet, Text, View, useWindowDimensions, type ViewToken } from 'react-native'
import { Image } from 'expo-image'
import * as FileSystem from 'expo-file-system/legacy'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { VideoView, useVideoPlayer } from 'expo-video'
import Ionicons from '@expo/vector-icons/Ionicons'

import { privacyMediaUrl, usePrivacySnapshot } from '@/engine/privacy'
import { useXMediaMode } from '@/engine/x/mediaPreference'
import { isTrustedXMediaUrl, verifyXMedia, xMediaFullUrl, xMediaPreviewUrl, type XMediaSafety } from '@/engine/x/mediaSafety'
import type { XMedia } from '@/engine/x/types'
import { PressableScale } from '@/ui/ios/PressableScale'
import { useHideTabBar } from '@/ui/navigation/useHideTabBar'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
import { XZoomableImage } from '@/ui/x/XZoomableImage'

function parseMedia(raw?: string): XMedia[] {
  try {
    const value = JSON.parse(raw || '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item): XMedia[] => {
      if (!item || typeof item !== 'object') return []
      const kind = Reflect.get(item, 'kind')
      const previewUrl = Reflect.get(item, 'previewUrl')
      const playbackUrl = Reflect.get(item, 'playbackUrl')
      if (!['photo', 'video', 'gif'].includes(String(kind)) || typeof previewUrl !== 'string' || !isTrustedXMediaUrl(previewUrl)) return []
      return [{
        kind: kind as XMedia['kind'],
        previewUrl,
        playbackUrl: typeof playbackUrl === 'string' && isTrustedXMediaUrl(playbackUrl) ? playbackUrl : undefined,
        contentType: typeof Reflect.get(item, 'contentType') === 'string' ? String(Reflect.get(item, 'contentType')) : undefined,
        alt: typeof Reflect.get(item, 'alt') === 'string' ? String(Reflect.get(item, 'alt')) : undefined,
      }]
    }).slice(0, 4)
  } catch {
    return []
  }
}

function XVideo({ item }: { item: XMedia }): JSX.Element {
  const [ready, setReady] = useState(false)
  const playbackUrl = item.playbackUrl ? privacyMediaUrl(item.playbackUrl) : null
  const posterUrl = privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))
  const player = useVideoPlayer(playbackUrl ? { uri: playbackUrl, contentType: 'progressive', useCaching: true } : null, (instance) => {
    instance.loop = item.kind === 'gif'
    instance.play()
  })
  if (!playbackUrl) {
    return <Image source={posterUrl} style={styles.media} contentFit="contain" cachePolicy="memory-disk" />
  }
  return <View style={styles.media}>
    <VideoView style={styles.media} player={player} nativeControls={item.kind !== 'gif'} contentFit="contain" surfaceType="textureView" fullscreenOptions={{ enable: true }} onFirstFrameRender={() => setReady(true)} />
    {!ready ? <Image source={posterUrl} style={styles.media} contentFit="contain" cachePolicy="memory-disk" transition={0} /> : null}
  </View>
}

function MediaPage({ item, width, sensitive, active, onZoomChange }: { item: XMedia; width: number; sensitive: boolean; active: boolean; onZoomChange: (zoomed: boolean) => void }): JSX.Element {
  const mode = useXMediaMode()
  const privacy = usePrivacySnapshot()
  const themed = useThemedStyles(makeStyles)
  const [verdict, setVerdict] = useState<XMediaSafety | 'checking'>('checking')

  useEffect(() => {
    let live = true
    if (mode === 'hidden') {
      setVerdict('unsafe')
      return () => { live = false }
    }
    if (sensitive) {
      setVerdict('unsafe')
      return () => { live = false }
    }
    setVerdict('checking')
    void verifyXMedia([item]).then((next) => { if (live) setVerdict(next) })
    return () => { live = false }
  }, [item, mode, sensitive])

  return (
    <View style={[styles.page, { width }]}>
      {(privacy.torEnabled || (privacy.proxy.enabled && !privacy.relayEnabled)) ? (
        <View style={themed.blocked}>
          <Ionicons name="shield-checkmark-outline" size={26} color={themed.blockedGlyph.color} />
          <Text style={themed.blockedTitle}>Direct media blocked</Text>
          <Text style={themed.blockedBody}>{privacy.torEnabled ? 'Embedded Tor' : 'The X proxy'} protects feed traffic. Media stays covered when its connection cannot use the selected route.</Text>
          <PressableScale style={themed.reviewButton} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Open privacy settings">
            <Text style={themed.reviewButtonText}>Privacy settings</Text>
          </PressableScale>
        </View>
      ) : verdict === 'checking' ? (
        <View style={themed.checking}><ActivityIndicator color={themed.spinner.color} /><Text style={themed.checkingText}>Verifying media</Text></View>
      ) : mode === 'hidden' || sensitive || verdict !== 'safe' ? (
        <View style={themed.blocked}>
          <Ionicons name="eye-off-outline" size={26} color={themed.blockedGlyph.color} />
          <Text style={themed.blockedTitle}>Media covered</Text>
          <Text style={themed.blockedBody}>{verdict === 'unsafe' ? 'Safe media is on for this X account.' : 'Tru could not verify this preview.'}</Text>
          <PressableScale style={themed.reviewButton} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Open X media controls">
            <Text style={themed.reviewButtonText}>Media controls</Text>
          </PressableScale>
        </View>
      ) : <View style={styles.media}>
        <Image source={privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))} style={styles.ambient} contentFit="cover" blurRadius={28} cachePolicy="memory-disk" transition={0} accessible={false} />
        <View style={styles.ambientDim} pointerEvents="none" />
        {item.kind === 'photo' ? active ? (
          <XZoomableImage
            uri={privacyMediaUrl(xMediaFullUrl(item.previewUrl))!}
            fallbackUri={privacyMediaUrl(item.previewUrl)!}
            placeholderUri={privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))!}
            width={width}
            onZoomChange={onZoomChange}
          />
        ) : <Image source={privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))} style={styles.media} contentFit="contain" cachePolicy="memory-disk" accessible={false} />
          : active ? <XVideo item={item} /> : <Image source={privacyMediaUrl(xMediaPreviewUrl(item.previewUrl))} style={styles.media} contentFit="contain" cachePolicy="memory-disk" accessible={false} />}
      </View>}
    </View>
  )
}

export default function XMediaScreen(): JSX.Element {
  const themed = useThemedStyles(makeStyles)
  useHideTabBar()
  const { width } = useWindowDimensions()
  const mode = useXMediaMode()
  const privacy = usePrivacySnapshot()
  const params = useLocalSearchParams<{ items?: string; index?: string; postUrl?: string; sensitive?: string }>()
  const items = useMemo(() => parseMedia(params.items), [params.items])
  const initialIndex = Math.min(Math.max(items.length - 1, 0), Math.max(0, Number(params.index) || 0))
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const [saving, setSaving] = useState(false)
  const item = items[index]

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<XMedia>> }) => {
    const next = viewableItems.find((token) => token.isViewable)?.index
    if (typeof next === 'number') {
      setIndex(next)
      setZoomed(false)
    }
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current
  const sensitive = params.sensitive === '1'
  const renderMedia = useCallback(({ item: media, index: mediaIndex }: { item: XMedia; index: number }) => (
    <MediaPage item={media} width={width} sensitive={sensitive} active={mediaIndex === index} onZoomChange={setZoomed} />
  ), [index, sensitive, width])

  const originalSourceUrl = item?.playbackUrl || item?.previewUrl || params.postUrl || ''
  const sourceUrl = originalSourceUrl ? privacyMediaUrl(originalSourceUrl) ?? '' : ''
  const share = useCallback(async () => {
    if (!originalSourceUrl) return
    await Share.share({ message: params.postUrl ? `${params.postUrl}\n${originalSourceUrl}` : originalSourceUrl, url: originalSourceUrl })
  }, [originalSourceUrl, params.postUrl])

  const exportMedia = useCallback(async () => {
    if (!sourceUrl || saving) return
    setSaving(true)
    try {
      const suffix = item?.kind === 'photo' ? '.jpg' : '.mp4'
      const destination = `${FileSystem.cacheDirectory}tru-x-${Date.now()}${suffix}`
      const result = await FileSystem.downloadAsync(sourceUrl, destination)
      await Share.share({ message: 'Tru X media', url: result.uri })
    } catch {
      Alert.alert('Could not export media', 'Open the original X post and try again.')
    } finally {
      setSaving(false)
    }
  }, [item?.kind, saving, sourceUrl])

  return (
    <SafeAreaView style={themed.screen}>
      <StatusBar style="light" />
      <View style={themed.header}>
        <PressableScale style={themed.headerButton} onPress={() => router.back()} haptic={false} accessibilityRole="button" accessibilityLabel="Close media">
          <Ionicons name="close" size={26} color="#fff" />
        </PressableScale>
        <View style={themed.headerCopy}>
          <Text style={themed.title}>X media</Text>
          <Text style={themed.meta}>{items.length ? `${index + 1} of ${items.length} · ${mode === 'safe' ? 'Safe media' : 'Hide media'}` : 'Unavailable'}</Text>
        </View>
        <PressableScale style={themed.headerButton} onPress={() => void share()} haptic={false} accessibilityRole="button" accessibilityLabel="Share media">
          <Ionicons name="share-outline" size={22} color="#fff" />
        </PressableScale>
        <PressableScale style={themed.headerButton} disabled={saving} onPress={() => void exportMedia()} haptic={false} accessibilityRole="button" accessibilityLabel="Export media">
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={22} color="#fff" />}
        </PressableScale>
      </View>

      {items.length ? (
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={items.length > 1 ? initialIndex : undefined}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          keyExtractor={(media, itemIndex) => `${media.previewUrl}:${itemIndex}`}
          renderItem={renderMedia}
          extraData={index}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          style={styles.list}
        />
      ) : (
        <View style={themed.empty}><Text style={themed.blockedTitle}>Media unavailable</Text><Text style={themed.blockedBody}>This post did not include a valid X media URL.</Text></View>
      )}

      <View style={themed.footer}>
        {items.length > 1 ? <View style={themed.dots}>{items.map((_, dot) => <View key={dot} style={[themed.dot, dot === index && themed.dotActive]} />)}</View> : null}
        {params.postUrl ? (
          <PressableScale style={themed.source} onPress={() => router.push({ pathname: '/browser', params: { url: params.postUrl!, title: 'X post' } })} haptic={false} accessibilityRole="link" accessibilityLabel="Open original X post">
            <Text style={themed.sourceText}>Open original X post</Text>
            <Ionicons name="open-outline" size={17} color={themed.sourceText.color} />
          </PressableScale>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  ambient: { ...StyleSheet.absoluteFill },
  ambientDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.48)' },
})

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: { minHeight: 56, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252a30', backgroundColor: '#090b0e' },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, paddingLeft: 4 },
  title: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '600' },
  meta: { color: '#aab3bc', fontSize: 12, lineHeight: 18, marginTop: 1 },
  checking: { alignItems: 'center', gap: 10 },
  spinner: { color: t.accent },
  checkingText: { color: '#aab3bc', fontSize: 14 },
  blocked: { maxWidth: 300, marginHorizontal: 20, padding: 18, borderRadius: 14, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#3a424b', backgroundColor: '#11161b' },
  blockedGlyph: { color: '#aab3bc' },
  blockedTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '600', marginTop: 8 },
  blockedBody: { color: '#aab3bc', fontSize: 14, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  reviewButton: { minHeight: 48, marginTop: 12, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent },
  reviewButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  footer: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#252a30', backgroundColor: '#090b0e' },
  dots: { minHeight: 20, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4d5761' },
  dotActive: { width: 16, backgroundColor: t.accent },
  source: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  sourceText: { color: '#8ec5ff', fontSize: 14, fontWeight: '600' },
})
