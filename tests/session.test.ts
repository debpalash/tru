import { test, expect } from 'bun:test'
import { readStoredSession, revokeStoredSession, SESSION_KEY, LEGACY_SESSION_KEY } from '../src/engine/x/sessionStorage'
test('migrated login stays signed out after restart', async () => {
  const data = new Map([[LEGACY_SESSION_KEY, '{"authToken":"fixture"}']])
  const store = { getItemAsync: async (k: string) => data.get(k) ?? null, setItemAsync: async (k: string, v: string) => { data.set(k,v) }, deleteItemAsync: async (k: string) => { data.delete(k) } }
  expect(await readStoredSession(store)).toContain('fixture')
  expect(data.has(LEGACY_SESSION_KEY)).toBe(false)
  await revokeStoredSession(store)
  expect(await readStoredSession(store)).toBeNull()
})
test('partial logout failure persists a tombstone that prevents old session recovery', async () => {
  const data = new Map([[LEGACY_SESSION_KEY, 'old']])
  const store = { getItemAsync: async (k: string) => data.get(k) ?? null, setItemAsync: async (k: string,v: string) => { data.set(k,v) }, deleteItemAsync: async () => { throw new Error('disk failure') } }
  await expect(revokeStoredSession(store)).rejects.toThrow()
  expect(data.get(SESSION_KEY)).toBe('null')
  expect(await readStoredSession(store)).toBe('null')
})
