// Carries a persisted store over from its pre-rename (DiscordMTX) localStorage
// key, so viewers keep their settings. Runs before the store hydrates.
export function adoptLegacyStorageKey(key: string, legacyKey: string): string {
  if (typeof window === 'undefined') return key
  try {
    const legacy = localStorage.getItem(legacyKey)
    if (legacy !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy)
      localStorage.removeItem(legacyKey)
    }
  } catch {}
  return key
}
