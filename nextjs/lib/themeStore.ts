import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ACCENT } from './theme'

// 'avatar' follows the colour detected from the viewer's own avatar.
export type AccentMode = 'avatar' | 'custom'

interface ThemeState {
  accentMode: AccentMode
  customAccent: string
  avatarAccent: string | null

  setCustomAccent: (accent: string) => void
  followAvatarAccent: () => void
  setAvatarAccent: (accent: string | null) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentMode: 'avatar',
      customAccent: DEFAULT_ACCENT,
      avatarAccent: null,

      setCustomAccent: (customAccent) =>
        set({ customAccent, accentMode: 'custom' }),
      followAvatarAccent: () => set({ accentMode: 'avatar' }),
      setAvatarAccent: (avatarAccent) => set({ avatarAccent }),
    }),
    {
      name: 'discordmtx-theme',
    },
  ),
)

export function resolveAccent(state: ThemeState): string {
  if (state.accentMode === 'custom') return state.customAccent
  return state.avatarAccent ?? DEFAULT_ACCENT
}
