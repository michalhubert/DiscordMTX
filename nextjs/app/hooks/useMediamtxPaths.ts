import { useState } from 'react'
import { usePolling } from './usePolling'

// Names of every MediaMTX path: configured ones (paths.yml) merged with the ones
// currently present at runtime, sorted. Refreshed every `refreshMs` if given.
export function useMediamtxPaths(refreshMs?: number): string[] {
  const [paths, setPaths] = useState<string[]>([])

  usePolling(
    async (isCancelled) => {
      try {
        const results = await Promise.allSettled([
          fetch('/api/mediamtx/config/paths/list'),
          fetch('/api/mediamtx/paths/list'),
        ])

        const names = new Set<string>()
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json()
            for (const item of data.items ?? []) {
              if (item?.name) names.add(item.name as string)
            }
          }
        }

        if (!isCancelled()) setPaths(Array.from(names).sort())
      } catch (err) {
        console.error('Failed to load MediaMTX path list:', err)
      }
    },
    refreshMs,
    [],
  )

  return paths
}
