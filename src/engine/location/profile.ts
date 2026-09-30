import { useSyncExternalStore } from 'react'

export type NewsRegion = 'africa' | 'asia' | 'europe' | 'latin-america' | 'middle-east' | 'north-america' | 'oceania'

export interface CountryOption {
  code: string
  name: string
  region: NewsRegion
}

export interface LocationProfile extends CountryOption {
  mode: 'device' | 'manual'
  timeZone: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'AR', name: 'Argentina', region: 'latin-america' },
  { code: 'AU', name: 'Australia', region: 'oceania' },
  { code: 'BD', name: 'Bangladesh', region: 'asia' },
  { code: 'BR', name: 'Brazil', region: 'latin-america' },
  { code: 'CA', name: 'Canada', region: 'north-america' },
  { code: 'CL', name: 'Chile', region: 'latin-america' },
  { code: 'CN', name: 'China', region: 'asia' },
  { code: 'CO', name: 'Colombia', region: 'latin-america' },
  { code: 'DE', name: 'Germany', region: 'europe' },
  { code: 'EG', name: 'Egypt', region: 'middle-east' },
  { code: 'ES', name: 'Spain', region: 'europe' },
  { code: 'FR', name: 'France', region: 'europe' },
  { code: 'GB', name: 'United Kingdom', region: 'europe' },
  { code: 'GH', name: 'Ghana', region: 'africa' },
  { code: 'HK', name: 'Hong Kong', region: 'asia' },
  { code: 'ID', name: 'Indonesia', region: 'asia' },
  { code: 'IE', name: 'Ireland', region: 'europe' },
  { code: 'IL', name: 'Israel', region: 'middle-east' },
  { code: 'IN', name: 'India', region: 'asia' },
  { code: 'IT', name: 'Italy', region: 'europe' },
  { code: 'JP', name: 'Japan', region: 'asia' },
  { code: 'KE', name: 'Kenya', region: 'africa' },
  { code: 'KR', name: 'South Korea', region: 'asia' },
  { code: 'LK', name: 'Sri Lanka', region: 'asia' },
  { code: 'MX', name: 'Mexico', region: 'latin-america' },
  { code: 'MY', name: 'Malaysia', region: 'asia' },
  { code: 'NG', name: 'Nigeria', region: 'africa' },
  { code: 'NL', name: 'Netherlands', region: 'europe' },
  { code: 'NP', name: 'Nepal', region: 'asia' },
  { code: 'NZ', name: 'New Zealand', region: 'oceania' },
  { code: 'PH', name: 'Philippines', region: 'asia' },
  { code: 'PK', name: 'Pakistan', region: 'asia' },
  { code: 'PL', name: 'Poland', region: 'europe' },
  { code: 'PT', name: 'Portugal', region: 'europe' },
  { code: 'QA', name: 'Qatar', region: 'middle-east' },
  { code: 'SA', name: 'Saudi Arabia', region: 'middle-east' },
  { code: 'SG', name: 'Singapore', region: 'asia' },
  { code: 'TH', name: 'Thailand', region: 'asia' },
  { code: 'TR', name: 'Türkiye', region: 'middle-east' },
  { code: 'TW', name: 'Taiwan', region: 'asia' },
  { code: 'UA', name: 'Ukraine', region: 'europe' },
  { code: 'AE', name: 'United Arab Emirates', region: 'middle-east' },
  { code: 'US', name: 'United States', region: 'north-america' },
  { code: 'VN', name: 'Vietnam', region: 'asia' },
  { code: 'ZA', name: 'South Africa', region: 'africa' },
]

const OVERRIDE_KEY = 'tru.location.country'
const listeners = new Set<() => void>()
const TIME_ZONE_COUNTRY: Record<string, string> = {
  'Asia/Calcutta': 'IN', 'Asia/Kolkata': 'IN', 'Asia/Singapore': 'SG', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Hong_Kong': 'HK', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Riyadh': 'SA', 'Asia/Jerusalem': 'IL', 'Africa/Cairo': 'EG',
  'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Accra': 'GH', 'Africa/Johannesburg': 'ZA',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Lisbon': 'PT', 'Europe/Warsaw': 'PL', 'Europe/Kyiv': 'UA', 'Europe/Istanbul': 'TR',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO',
}

function secureStore(): typeof import('expo-secure-store') | null {
  try { return require('expo-secure-store') as typeof import('expo-secure-store') } catch { return null }
}

function currentTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

function localeCountry(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.replace('_', '-')
    const region = locale.split('-').find((part) => /^[A-Z]{2}$/.test(part))
    return region ?? ''
  } catch { return '' }
}

function option(code: string): CountryOption {
  return COUNTRY_OPTIONS.find((item) => item.code === code) ?? COUNTRY_OPTIONS.find((item) => item.code === 'US')!
}

function inferredCode(): string {
  return TIME_ZONE_COUNTRY[currentTimeZone()] ?? (localeCountry() || 'US')
}

let manualCode = ''
let snapshot: LocationProfile = { ...option(inferredCode()), mode: 'device', timeZone: currentTimeZone() }

function updateSnapshot(): void {
  snapshot = { ...option(manualCode || inferredCode()), mode: manualCode ? 'manual' : 'device', timeZone: currentTimeZone() }
  for (const listener of listeners) listener()
}

export async function initializeLocationProfile(): Promise<void> {
  try {
    const stored = await secureStore()?.getItemAsync(OVERRIDE_KEY)
    manualCode = stored && COUNTRY_OPTIONS.some((item) => item.code === stored) ? stored : ''
  } catch { manualCode = '' }
  updateSnapshot()
}

export function locationProfile(): LocationProfile { return snapshot }
export function useLocationProfile(): LocationProfile {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, locationProfile, locationProfile)
}

export async function setLocationCountry(code: string | null): Promise<void> {
  manualCode = code && COUNTRY_OPTIONS.some((item) => item.code === code) ? code : ''
  try {
    if (manualCode) await secureStore()?.setItemAsync(OVERRIDE_KEY, manualCode)
    else await secureStore()?.deleteItemAsync(OVERRIDE_KEY)
  } catch { /* in-memory selection remains valid */ }
  updateSnapshot()
}
