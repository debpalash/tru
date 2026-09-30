import { useSyncExternalStore } from 'react'

export type XMediaMode = 'safe' | 'hidden'

const STORE_KEY = 'tru.x.media-mode.v2'
const LEGACY_STORE_KEY = 'tru.x.media-mode.v1'
const listeners = new Set<() => void>()
let mode: XMediaMode = 'safe'

function secureStore(): typeof import('expo-secure-store') {
  return require('expo-secure-store') as typeof import('expo-secure-store')
}

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function loadXMediaMode(): Promise<XMediaMode> {
  try {
    const store = secureStore()
    const saved = await store.getItemAsync(STORE_KEY)
    if (saved === 'hidden' || saved === 'safe') mode = saved
    else {
      // Obsolete preferences never restore unrestricted media.
      await store.getItemAsync(LEGACY_STORE_KEY)
      mode = 'safe'
    }
  } catch {
    mode = 'safe'
  }
  emit()
  return mode
}

export async function setXMediaMode(next: XMediaMode): Promise<void> {
  mode = next
  emit()
  try {
    await secureStore().setItemAsync(STORE_KEY, next)
  } catch {
    mode = 'safe'
    emit()
  }
}

export function useXMediaMode(): XMediaMode {
  return useSyncExternalStore(subscribe, () => mode, () => 'safe')
}

// Restore eagerly as well as from the root layout. This keeps the preference
// stable across Metro Fast Refresh, where this module can be replaced without
// remounting the root effect.
void loadXMediaMode()
