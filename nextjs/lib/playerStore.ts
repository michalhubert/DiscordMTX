import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlayerState {
  volume: number
  muted: boolean
  showViewers: boolean
  warningsSuppressed: boolean

  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setShowViewers: (show: boolean) => void
  setWarningsSuppressed: (suppressed: boolean) => void
  toggleMuted: () => void
  toggleShowViewers: () => void
  toggleWarningsSuppressed: () => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      showViewers: true,
      warningsSuppressed: false,

      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      setShowViewers: (showViewers) => set({ showViewers }),
      setWarningsSuppressed: (warningsSuppressed) =>
        set({ warningsSuppressed }),

      toggleMuted: () => set((state) => ({ muted: !state.muted })),
      toggleShowViewers: () => set((state) => ({ showViewers: !state.showViewers })),
      toggleWarningsSuppressed: () =>
        set((state) => ({ warningsSuppressed: !state.warningsSuppressed })),
    }),
    {
      name: 'discordmtx-player-settings',
    },
  ),
)
