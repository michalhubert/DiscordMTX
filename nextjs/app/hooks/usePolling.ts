import { useEffect, useEffectEvent, type DependencyList } from 'react'

// Runs `fn` now and then every `ms` (once only when `ms` is omitted), restarting
// when `deps` change. `isCancelled()` turns true once the effect is torn down,
// so async callbacks can skip setting state after unmount or a deps change.
export function usePolling(
  fn: (isCancelled: () => boolean) => unknown,
  ms: number | undefined,
  deps: DependencyList,
) {
  const tick = useEffectEvent(fn)

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    tick(isCancelled)
    const interval = ms ? setInterval(() => tick(isCancelled), ms) : null
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps])
}
