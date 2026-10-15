'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { AnimatePresence, motion } from 'motion/react'
import { Dices, Pin, Tag, Users, X } from 'lucide-react'
import type { WatchGuest, WatchViewer } from '@/lib/watchRoomShared'
import AvatarPreview from '@/app/components/AvatarPreview'
import { accentAlpha, accentGlassSx } from '@/lib/theme'
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

function RowButton({
  active,
  activeColor,
  children,
  ...props
}: IconButtonProps & {
  active?: boolean
  activeColor?: string
  children: ReactNode
}) {
  return (
    <IconButton
      size="small"
      {...props}
      sx={{
        my: -0.5,
        p: 0.5,
        minWidth: 22,
        borderRadius: 1,
        color: active ? activeColor : 'rgba(255,255,255,0.35)',
        '& svg': { fill: active ? 'currentColor' : 'none' },
        '&:hover': {
          bgcolor: accentAlpha(0.2),
          color: active ? activeColor : 'common.white',
        },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' },
      }}
    >
      {children}
    </IconButton>
  )
}

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
      style={{
        pointerEvents: 'auto',
        width: 'max-content',
        maxWidth: '100%',
        flexShrink: 0,
        borderRadius: 8,
        padding: 8,
      }}
    >
      <Box sx={[accentGlassSx, { borderRadius: 1, p: 1 }]}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 0.75,
            pl: 0.5,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <Users size={14} />
          <Box component="span" sx={{ flex: 1 }}>
            {viewers.length} watching
          </Box>
          <IconButton
            size="small"
            onClick={onHide}
            title="Hide viewers (V)"
            aria-label="Hide viewers"
            sx={{
              m: -0.5,
              p: 0.5,
              borderRadius: 1,
              color: 'rgba(255,255,255,0.5)',
              '&:hover': { bgcolor: accentAlpha(0.2), color: 'common.white' },
            }}
          >
            <X size={14} />
          </IconButton>
        </Box>

        <Box
          component="ul"
          sx={{
            m: 0,
            p: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <AnimatePresence initial={false}>
            {listed.map((viewer) => (
              <motion.li
                key={viewer.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 0.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    fontSize: 14,
                    bgcolor:
                      viewer.id === selfId ? accentAlpha(0.18) : undefined,
                  }}
                >
                  <AvatarPreview
                    image={viewer.image}
                    name={viewer.name}
                    sx={{
                      display: 'flex',
                      flex: 1,
                      minWidth: 0,
                      alignItems: 'center',
                      gap: 1,
                      cursor: viewer.image ? 'zoom-in' : undefined,
                    }}
                  >
                    <ViewerAvatar viewer={viewer} />
                    <Box
                      component="span"
                      sx={{
                        display: 'flex',
                        flex: 1,
                        minWidth: 0,
                        alignItems: 'baseline',
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        component="span"
                        noWrap
                        sx={{ fontSize: 'inherit' }}
                      >
                        {viewer.name}
                      </Typography>
                      {viewer.id === selfId && (
                        <Box
                          component="span"
                          sx={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }}
                        >
                          (you)
                        </Box>
                      )}
                    </Box>
                  </AvatarPreview>
                  {viewer.id === selfId && guest && (
                    <>
                      <RowButton
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
                      >
                        {ponyBusy ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : cooldownS > 0 ? (
                          <Box
                            component="span"
                            sx={{
                              fontSize: 10,
                              lineHeight: '14px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {cooldownS}
                          </Box>
                        ) : (
                          <Dices size={14} />
                        )}
                      </RowButton>
                      <RowButton
                        onClick={() => setTagFormOpen((open) => !open)}
                        active={!!guest.favoriteTag}
                        activeColor="info.light"
                        aria-expanded={tagFormOpen}
                        aria-label="Favourite tag for your pictures"
                        title={
                          guest.favoriteTag
                            ? `Favourite tag: ${guest.favoriteTag}`
                            : 'Pick a favourite tag for your pictures'
                        }
                      >
                        <Tag size={14} />
                      </RowButton>
                      <RowButton
                        onClick={onToggleKeep}
                        active={guest.kept}
                        activeColor="warning.light"
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
                      >
                        <Pin size={14} />
                      </RowButton>
                    </>
                  )}
                  {viewer.role === 'streamer' && (
                    <Box
                      component="span"
                      sx={{
                        borderRadius: 0.5,
                        bgcolor: 'rgba(239,68,68,0.8)',
                        px: 0.75,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Host
                    </Box>
                  )}
                </Box>
              </motion.li>
            ))}
          </AnimatePresence>
        </Box>

        {hidden > 0 && (
          <Typography
            sx={{
              px: 0.5,
              pt: 0.5,
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            +{hidden} more
          </Typography>
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
      </Box>
    </motion.div>
  )
}
