import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePathname } from 'next/navigation'
import { accentScopeFor, DEFAULT_ACCENT, type AccentScope } from './theme'

// 'avatar' follows the colour detected from the viewer's own avatar.
export type AccentMode = 'avatar' | 'custom'

interface ThemeState {
  accentMode: AccentMode
  customAccent: string
  avatarAccent: string | null
  avatarAccentAvailable: boolean
  studioAccent: string

  setStudioAccent: (accent: string) => void
  setCustomAccent: (accent: string) => void
  followAvatarAccent: () => void
  setAvatarAccent: (accent: string | null) => void
  setAvatarAccentAvailable: (available: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentMode: 'avatar',
      customAccent: DEFAULT_ACCENT,
      avatarAccent: null,
      avatarAccentAvailable: false,
      studioAccent: DEFAULT_ACCENT,

      setStudioAccent: (studioAccent) => set({ studioAccent }),

      setCustomAccent: (customAccent) =>
        set({ customAccent, accentMode: 'custom' }),
      followAvatarAccent: () => set({ accentMode: 'avatar' }),
      setAvatarAccent: (avatarAccent) => set({ avatarAccent }),
      setAvatarAccentAvailable: (avatarAccentAvailable) =>
        set({ avatarAccentAvailable }),
    }),
    {
      name: 'discordmtx-theme',
      partialize: ({ accentMode, customAccent, avatarAccent, studioAccent }) => ({
        accentMode,
        customAccent,
        avatarAccent,
        studioAccent,
      }),
    },
  ),
)

export function followsAvatar(state: ThemeState): boolean {
  return state.accentMode === 'avatar' && state.avatarAccent !== null
}

export function useAccentScope(): AccentScope {
  return accentScopeFor(usePathname())
}

export function resolveAccent(state: ThemeState, scope: AccentScope): string {
  if (scope === 'studio') return state.studioAccent
  return followsAvatar(state) && state.avatarAccent
    ? state.avatarAccent
    : state.customAccent
}
