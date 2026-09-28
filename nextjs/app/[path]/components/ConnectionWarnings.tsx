'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TriangleAlert, WifiOff, X } from 'lucide-react'
import type {
  ConnectionStats,
  ConnectionWarning,
} from '../hooks/useConnectionStats'

const DISMISS_FOR_MS = 60_000

interface Props {
  warnings: ConnectionWarning[]
  stats: ConnectionStats | null
}

// Non-critical warnings can be dismissed for a minute.
export default function ConnectionWarnings({ warnings, stats }: Props) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())

  const visible = warnings.filter(
    (w) => w.severity === 'critical' || !dismissed.has(w.id),
  )
  const top = visible.find((w) => w.severity === 'critical') ?? visible[0]

  function dismiss() {
    const ids = visible.map((w) => w.id)
    setDismissed((prev) => new Set([...prev, ...ids]))
    setTimeout(() => {
      setDismissed((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, DISMISS_FOR_MS)
  }

  const critical = top?.severity === 'critical'

  return (
    <div className="flex justify-center">
      <AnimatePresence>
        {top && (
          <motion.div
            key="connection-warning"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border px-3 py-2 text-sm shadow-xl backdrop-blur-md ${
              critical
                ? 'border-red-400/30 bg-red-950/75 text-red-100'
                : 'border-amber-400/30 bg-amber-950/70 text-amber-100'
            }`}
          >
            {top.id === 'offline' ? (
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{top.message}</p>
              {visible.length > 1 && (
                <p className="mt-0.5 text-xs opacity-75">
                  +{visible.length - 1} more issue
                  {visible.length > 2 ? 's' : ''}:{' '}
                  {visible
                    .filter((w) => w !== top)
                    .map((w) => w.id.replace('-', ' '))
                    .join(', ')}
                </p>
              )}
              {stats && (
                <p className="mt-0.5 font-mono text-[11px] opacity-60">
                  loss {stats.packetLossPct.toFixed(1)}%
                  {stats.rttMs !== null &&
                    ` · rtt ${Math.round(stats.rttMs)}ms`}
                  {` · ${Math.round(stats.bitrateKbps)} kbps`}
                  {stats.fps !== null && ` · ${Math.round(stats.fps)} fps`}
                </p>
              )}
            </div>
            {!critical && (
              <button
                type="button"
                onClick={dismiss}
                title="Dismiss for a minute"
                aria-label="Dismiss connection warning"
                className="-m-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
