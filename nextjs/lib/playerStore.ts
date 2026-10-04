import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlayerState {
  volume: number
  muted: boolean
  showViewers: boolean

  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setShowViewers: (show: boolean) => void
  toggleMuted: () => void
  toggleShowViewers: () => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      showViewers: true,

      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      setShowViewers: (showViewers) => set({ showViewers }),

      toggleMuted: () => set((state) => ({ muted: !state.muted })),
      toggleShowViewers: () => set((state) => ({ showViewers: !state.showViewers })),
    }),
    {
      name: 'discordmtx-player-settings',
    },
  ),
)
