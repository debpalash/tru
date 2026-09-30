import type { JSX } from 'react'
import { Image } from 'expo-image'
import { useTheme } from '../theme'

const darkInk = require('../../../assets/brand/wordmark.png')
const lightInk = require('../../../assets/brand/wordmark-light.png')

export function Wordmark({ width = 86 }: { width?: number }): JSX.Element {
  const theme = useTheme()
  return <Image source={theme.scheme === 'light' ? darkInk : lightInk} style={{ width, height: width * 0.39 }} contentFit="contain" accessible accessibilityLabel="Tru" />
}
