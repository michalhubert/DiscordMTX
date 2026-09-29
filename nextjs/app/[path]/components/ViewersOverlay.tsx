'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dices, Loader2, Pin, Tag, Users, X } from 'lucide-react'
import type { WatchGuest, WatchViewer } from '@/lib/watchRoomShared'
import AvatarPreview from '@/app/components/AvatarPreview'
import type { PonyChangeResult } from '../hooks/useWatchRoom'
import FavoriteTagForm from './FavoriteTagForm'
import ViewerAvatar from './ViewerAvatar'

const MAX_LISTED = 8

interface Props {
  viewers: WatchViewer[]
  selfId: string | null
  // null for non-guests.
  guest: WatchGuest | null
  rerollReadyAt: number
  ponyBusy: boolean
  onToggleKeep: () => void
  onReroll: () => Promise<PonyChangeResult>
  onSetFavoriteTag: (tag: string | null) => Promise<PonyChangeResult>
  onHide: () => void
}

function useSecondsUntil(at: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= at) clearInterval(interval)
    }
    const interval = setInterval(tick, 250)
    tick()
    return () => clearInterval(interval)
  }, [at])
  return Math.max(0, Math.ceil((at - now) / 1000))
}

const iconButtonClass =
  '-my-1 rounded p-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'

export default function ViewersOverlay({
  viewers,
  selfId,
  guest,
  rerollReadyAt,
  ponyBusy,
  onToggleKeep,
  onReroll,
  onSetFavoriteTag,
  onHide,
}: Props) {
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const cooldownS = useSecondsUntil(rerollReadyAt)
  const listed = viewers.slice(0, MAX_LISTED)
  const hidden = viewers.length - listed.length
  const selfName = viewers.find((v) => v.id === selfId)?.name ?? 'your pony'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto w-56 max-w-full shrink-0 rounded-xl border border-white/10 bg-black/55 p-2 text-white shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center gap-2 pb-1.5 pl-1 text-xs font-medium text-white/70">
        <Users className="h-3.5 w-3.5" />
        <span className="flex-1">{viewers.length} watching</span>
        <button
          type="button"
          onClick={onHide}
          title="Hide viewers (V)"
          aria-label="Hide viewers"
          className="-m-1 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="flex flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {listed.map((viewer) => (
            <motion.li
              key={viewer.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 overflow-hidden rounded-md px-1 py-1 text-sm"
            >
              <AvatarPreview
                image={viewer.image}
                name={viewer.name}
                className={`flex min-w-0 flex-1 items-center gap-2 ${
                  viewer.image ? 'cursor-zoom-in' : ''
                }`}
              >
                <ViewerAvatar viewer={viewer} />
                <span className="flex min-w-0 flex-1 items-baseline gap-1">
                  <span className="truncate">{viewer.name}</span>
                  {viewer.id === selfId && (
                    <span className="shrink-0 text-white/40">(you)</span>
                  )}
                </span>
              </AvatarPreview>
              {viewer.id === selfId && guest && (
                <>
                  <button
                    type="button"
                    onClick={() => void onReroll()}
                    disabled={ponyBusy || cooldownS > 0}
                    aria-label={
                      cooldownS > 0
                        ? `New picture available in ${cooldownS} seconds`
                        : 'New picture of your pony'
                    }
                    title={
                      cooldownS > 0
                        ? `New picture in ${cooldownS}s`
                        : 'New picture of your pony'
                    }
                    className={`${iconButtonClass} flex min-w-[22px] justify-center text-white/35 hover:text-white disabled:hover:bg-transparent disabled:hover:text-white/35`}
                  >
                    {ponyBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : cooldownS > 0 ? (
                      <span className="text-[10px] leading-[14px] tabular-nums">
                        {cooldownS}
                      </span>
                    ) : (
                      <Dices className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagFormOpen((open) => !open)}
                    aria-expanded={tagFormOpen}
                    aria-label="Favourite tag for your pictures"
                    title={
                      guest.favoriteTag
                        ? `Favourite tag: ${guest.favoriteTag}`
                        : 'Pick a favourite tag for your pictures'
                    }
                    className={`${iconButtonClass} ${
                      guest.favoriteTag
                        ? 'text-sky-300'
                        : 'text-white/35 hover:text-white'
                    }`}
                  >
                    <Tag
                      className={`h-3.5 w-3.5 ${guest.favoriteTag ? 'fill-current' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleKeep}
                    aria-pressed={guest.kept}
                    aria-label={
                      guest.kept
                        ? 'Stop keeping this pony - get a new one next stream'
                        : 'Keep this pony for future streams'
                    }
                    title={
                      guest.kept
                        ? 'Kept for future streams - click to get a new pony next stream'
                        : 'Keep this pony for future streams'
                    }
                    className={`${iconButtonClass} ${
                      guest.kept
                        ? 'text-amber-300'
                        : 'text-white/35 hover:text-white'
                    }`}
                  >
                    <Pin
                      className={`h-3.5 w-3.5 ${guest.kept ? 'fill-current' : ''}`}
                    />
                  </button>
                </>
              )}
              {viewer.role === 'streamer' && (
                <span className="rounded bg-red-500/80 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
                  Host
                </span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {hidden > 0 && (
        <p className="px-1 pt-1 text-xs text-white/50">+{hidden} more</p>
      )}

      <AnimatePresence initial={false}>
        {guest && tagFormOpen && (
          <FavoriteTagForm
            ponyName={selfName}
            favoriteTag={guest.favoriteTag}
            cooldownS={cooldownS}
            busy={ponyBusy}
            onSubmit={onSetFavoriteTag}
            onClose={() => setTagFormOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
