export interface SessionStorage {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}
export const SESSION_KEY = 'tru.x.session.v1'
export const LEGACY_SESSION_KEY = 'unbird.session'
export async function readStoredSession(store: SessionStorage): Promise<string | null> {
  const primary = await store.getItemAsync(SESSION_KEY)
  if (primary !== null) return primary
  const legacy = await store.getItemAsync(LEGACY_SESSION_KEY)
  if (legacy !== null) {
    await store.setItemAsync(SESSION_KEY, legacy)
    await store.deleteItemAsync(LEGACY_SESSION_KEY)
  }
  return legacy
}
export async function revokeStoredSession(store: SessionStorage): Promise<void> {
  // A persisted tombstone prevents legacy resurrection even if deletion fails.
  await store.setItemAsync(SESSION_KEY, 'null')
  await store.deleteItemAsync(LEGACY_SESSION_KEY)
  await store.deleteItemAsync(SESSION_KEY)
}
