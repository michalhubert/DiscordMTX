import { useCallback, useSyncExternalStore } from 'react'

// Boolean preference in localStorage, with an in-memory fallback when it's blocked.
const memory = new Map<string, boolean>()
const listeners = new Set<() => void>()

function read(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) return stored === 'true'
  } catch {}
  return memory.get(key) ?? defaultValue
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useStoredToggle(key: string, defaultValue: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, defaultValue),
    () => defaultValue,
  )

  const toggle = useCallback(() => {
    const next = !read(key, defaultValue)
    memory.set(key, next)
    try {
      localStorage.setItem(key, String(next))
    } catch {}
    listeners.forEach((listener) => listener())
  }, [key, defaultValue])

  return [value, toggle] as const
}
