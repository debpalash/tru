import { SESSION_KEY, readStoredSession, revokeStoredSession } from './sessionStorage'
import { useEffect, useState } from 'react'

type SecureStoreModule = typeof import('expo-secure-store')

export interface XSession {
  authToken: string
  ct0: string
  username?: string
  userId?: string
}

const STORAGE_KEY = SESSION_KEY
let current: XSession | null = null
let hydrated = false
const listeners = new Set<(session: XSession | null) => void>()

function secureStore(): SecureStoreModule {
  return require('expo-secure-store') as SecureStoreModule
}

function valid(value: unknown): value is XSession {
  const item = value as Partial<XSession> | null
  return Boolean(item && typeof item.authToken === 'string' && item.authToken.trim() && typeof item.ct0 === 'string' && item.ct0.trim())
}

function emit(): void {
  for (const listener of listeners) listener(current)
}

export function getXSession(): XSession | null {
  return current
}

export async function loadXSession(): Promise<XSession | null> {
  if (hydrated) return current
  hydrated = true
  try {
    const raw = await readStoredSession(secureStore())
    const parsed: unknown = raw ? JSON.parse(raw) : null
    current = valid(parsed) ? parsed : null
  } catch {
    current = null
  }
  emit()
  return current
}

export async function saveXSession(session: XSession): Promise<void> {
  if (!valid(session)) throw new Error('X did not provide both required session cookies.')
  await secureStore().setItemAsync(STORAGE_KEY, JSON.stringify(session))
  current = session
  hydrated = true
  emit()
}

export async function patchXSession(patch: Partial<Pick<XSession, 'ct0' | 'username' | 'userId'>>): Promise<XSession | null> {
  if (!current) return null
  const next = { ...current, ...patch }
  if (!valid(next)) return current
  current = next
  hydrated = true
  emit()
  try {
    await secureStore().setItemAsync(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The live session remains usable even if this metadata refresh cannot persist.
  }
  return next
}

export async function clearXSession(): Promise<void> {
  await revokeStoredSession(secureStore())
  current = null
  hydrated = true
  emit()
}

export function useXSession(): XSession | null {
  const [session, setSession] = useState(current)
  useEffect(() => {
    setSession(current)
    listeners.add(setSession)
    return () => { listeners.delete(setSession) }
  }, [])
  return session
}
