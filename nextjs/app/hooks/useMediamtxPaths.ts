import { useEffect, useState } from 'react'

// Configured paths (paths.yml) plus any currently live, sorted.
export function useMediamtxPaths(): string[] {
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/stream/paths')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setPaths(data.paths)
      })
      .catch((err) => console.error('Failed to load MediaMTX path list:', err))
    return () => {
      cancelled = true
    }
  }, [])

  return paths
}
