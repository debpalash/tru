const listeners = new Set<() => void>()

export function emitPrivacyChange(): void {
  for (const listener of listeners) listener()
}

export function subscribePrivacy(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
