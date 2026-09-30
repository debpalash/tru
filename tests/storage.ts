import { mock } from 'bun:test'
const values = new Map<string, string>()
const failedWrites = new Set<string>()
export function failNextStorageWrite(key: string): void { failedWrites.add(key) }
mock.module('expo-secure-store', () => ({
  getItemAsync: async (key: string) => values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (failedWrites.delete(key)) throw new Error('Storage unavailable')
    values.set(key, value)
  },
  deleteItemAsync: async (key: string) => { values.delete(key) },
}))
