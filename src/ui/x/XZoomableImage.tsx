import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const AnimatedImage = Animated.createAnimatedComponent(Image)

export function XZoomableImage({
  uri,
  fallbackUri,
  placeholderUri,
  width,
  onZoomChange,
}: {
  uri: string
  fallbackUri: string
  placeholderUri: string
  width: number
  onZoomChange: (zoomed: boolean) => void
}): JSX.Element {
  const [source, setSource] = useState(uri)
  const [zoomed, setZoomed] = useState(false)
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)

  useEffect(() => setSource(uri), [uri])
  const reportZoom = useCallback((next: boolean) => {
    setZoomed(next)
    onZoomChange(next)
  }, [onZoomChange])

  const pinch = useMemo(() => Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale))
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, { duration: 150 })
        savedScale.value = 1
        translateX.value = withTiming(0, { duration: 150 })
        translateY.value = withTiming(0, { duration: 150 })
        savedX.value = 0
        savedY.value = 0
        runOnJS(reportZoom)(false)
      } else {
        savedScale.value = scale.value
        runOnJS(reportZoom)(true)
      }
    }), [reportZoom, savedScale, savedX, savedY, scale, translateX, translateY])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((event) => {
      const limit = (scale.value - 1) * (width / 2) + 40
      translateX.value = Math.max(-limit, Math.min(limit, savedX.value + event.translationX))
      translateY.value = Math.max(-limit, Math.min(limit, savedY.value + event.translationY))
    })
    .onEnd(() => {
      savedX.value = translateX.value
      savedY.value = translateY.value
    }), [savedX, savedY, scale, translateX, translateY, width, zoomed])

  const gesture = useMemo(() => Gesture.Simultaneous(pinch, pan), [pan, pinch])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return <GestureDetector gesture={gesture}>
    <Animated.View style={styles.fill}>
      <AnimatedImage
        source={source}
        placeholder={placeholderUri}
        placeholderContentFit="contain"
        style={[styles.fill, animatedStyle]}
        contentFit="contain"
        allowDownscaling={false}
        cachePolicy="memory-disk"
        recyclingKey={source}
        transition={120}
        onError={() => { if (source !== fallbackUri) setSource(fallbackUri) }}
        accessibilityLabel="X post image. Pinch to zoom"
      />
    </Animated.View>
  </GestureDetector>
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
})
