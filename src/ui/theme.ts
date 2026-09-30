import { useMemo, useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export interface ThemeTokens {
  name: ThemeName
  scheme: 'light' | 'dark'
  bg: string
  surface: string
  surfaceAlt: string
  elevated: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textSubtle: string
  accent: string
  accentPressed: string
  accentSoft: string
  onAccent: string
  positive: string
  positiveSoft: string
  warning: string
  warningSoft: string
  negative: string
  negativeSoft: string
  overlay: string
  skeleton: string
  like: string
  retweet: string
  bookmark: string
}

export type ThemeName = 'light' | 'dark' | 'dim'
export type ThemePreference = 'system' | ThemeName

export const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    name: 'light', scheme: 'light',
    bg: '#ffffff', surface: '#f7f7f8', surfaceAlt: '#ededee', elevated: '#ffffff',
    border: '#e5e5e5', borderStrong: '#c5c5c5', text: '#171717', textMuted: '#606060', textSubtle: '#707070',
    accent: '#171717', accentPressed: '#333333', accentSoft: '#f0f0f0', onAccent: '#ffffff',
    positive: '#147a50', positiveSoft: '#e4f6ed', warning: '#9a5d00', warningSoft: '#fff1d6',
    negative: '#bd2635', negativeSoft: '#fdebee', overlay: 'rgba(5, 12, 18, 0.55)', skeleton: '#e5eaee',
    like: '#d72c74', retweet: '#147a50', bookmark: '#171717',
  },
  dark: {
    name: 'dark', scheme: 'dark',
    bg: '#171717', surface: '#202020', surfaceAlt: '#292929', elevated: '#303030',
    border: '#363636', borderStrong: '#525252', text: '#f5f5f5', textMuted: '#b4b4b4', textSubtle: '#a0a0a0',
    accent: '#f5f5f5', accentPressed: '#d4d4d4', accentSoft: '#303030', onAccent: '#171717',
    positive: '#55d69e', positiveSoft: '#102b20', warning: '#efb247', warningSoft: '#312713',
    negative: '#ff8e99', negativeSoft: '#30191f', overlay: 'rgba(0, 0, 0, 0.72)', skeleton: '#2b2b2b',
    like: '#f45b9c', retweet: '#55d69e', bookmark: '#f5f5f5',
  },
  dim: {
    name: 'dim', scheme: 'dark',
    bg: '#242424', surface: '#2c2c2c', surfaceAlt: '#343434', elevated: '#3d3d3d',
    border: '#444444', borderStrong: '#606060', text: '#f5f5f5', textMuted: '#bcbcbc', textSubtle: '#aaaaaa',
    accent: '#f5f5f5', accentPressed: '#dedede', accentSoft: '#3b3b3b', onAccent: '#171717',
    positive: '#62d9a0', positiveSoft: '#18392b', warning: '#f0b85a', warningSoft: '#3a301c',
    negative: '#ff9aa4', negativeSoft: '#42252b', overlay: 'rgba(5, 10, 15, 0.64)', skeleton: '#383838',
    like: '#f56aa4', retweet: '#62d9a0', bookmark: '#f5f5f5',
  },
}

const STORAGE_KEY = 'tru.theme.preference.v1'
const listeners = new Set<() => void>()
let preference: ThemePreference = 'system'

function systemTheme(): ThemeName {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
}

function resolveTheme(next: ThemePreference): ThemeTokens {
  return THEMES[next === 'system' ? systemTheme() : next]
}

let active = resolveTheme(preference)

function emit(): void {
  active = resolveTheme(preference)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

Appearance.addChangeListener(() => {
  if (preference === 'system') emit()
})

export async function initializeThemePreference(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(STORAGE_KEY)
    if (saved === 'system' || saved === 'light' || saved === 'dark' || saved === 'dim') {
      preference = saved
      emit()
    }
  } catch {
    // The system theme remains a complete fallback when secure storage is unavailable.
  }
}

export async function setThemePreference(next: ThemePreference): Promise<void> {
  preference = next
  emit()
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, next)
  } catch {
    // The in-memory selection remains valid for this session.
  }
}

export function setActiveTheme(name: ThemeName): void {
  void setThemePreference(name)
}

export function getActiveTheme(): ThemeTokens {
  return active
}

export function getActiveThemeName(): ThemeName {
  return active.name
}

export function getThemePreference(): ThemePreference {
  return preference
}

export function useTheme(): ThemeTokens {
  return useSyncExternalStore(subscribe, getActiveTheme, getActiveTheme)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference)
}

export function useThemedStyles<T>(factory: (theme: ThemeTokens) => T): T {
  const current = useTheme()
  return useMemo(() => factory(current), [current, factory])
}

export const theme: ThemeTokens = THEMES.dark

export function formatStat(value: number): string {
  if (!value || value <= 0) return ''
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}
