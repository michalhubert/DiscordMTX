'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { popupSx } from '@/lib/theme'

const PREVIEW_WIDTH = 208
// Image + caption, used to keep the card on screen.
const PREVIEW_MAX_HEIGHT = 280
const GAP = 12
const MARGIN = 8

function largeAvatarUrl(url: string): string {
  if (url.includes('derpicdn.net/')) {
    // thumb_small (150px) -> thumb (250px)
    return url.replace(/\/thumb_small\.(\w+)$/, '/thumb.$1')
  }
  if (url.includes('cdn.discordapp.com/') && !url.includes('size=')) {
    return `${url}${url.includes('?') ? '&' : '?'}size=256`
  }
  return url
}

interface Props {
  image: string | null
  name: string
  sx?: SxProps<Theme>
  children: ReactNode
}

// Enlarged avatar on hover (or tap). Portalled so lists can't clip it - into the
// fullscreen element when there is one.
export default function AvatarPreview({
  image,
  name,
  sx,
  children,
}: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Right, left, below, then above the anchor - whichever fits.
  function open() {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect || !image) return
    const { innerWidth: vw, innerHeight: vh } = window
    const clamp = (value: number, max: number) =>
      Math.max(MARGIN, Math.min(value, max - MARGIN))

    if (rect.right + GAP + PREVIEW_WIDTH <= vw - MARGIN) {
      const top = clamp(rect.top - 8, vh - PREVIEW_MAX_HEIGHT)
      return setPosition({ left: rect.right + GAP, top })
    }
    if (rect.left - GAP - PREVIEW_WIDTH >= MARGIN) {
      const top = clamp(rect.top - 8, vh - PREVIEW_MAX_HEIGHT)
      return setPosition({ left: rect.left - GAP - PREVIEW_WIDTH, top })
    }
    const left = clamp(rect.left, vw - PREVIEW_WIDTH)
    const below = rect.bottom + GAP + PREVIEW_MAX_HEIGHT <= vh - MARGIN
    const top = below
      ? rect.bottom + GAP
      : Math.max(MARGIN, rect.top - GAP - PREVIEW_MAX_HEIGHT)
    setPosition({ left, top })
  }

  function close() {
    setPosition(null)
    setLoaded(false)
  }

  useEffect(() => {
    if (!position) return
    function handlePointerDown(e: PointerEvent) {
      if (!anchorRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', close, true)
    }
  }, [position])

  return (
    <>
      <Box
        component="span"
        ref={anchorRef}
        sx={sx}
        onPointerEnter={(e) => e.pointerType === 'mouse' && open()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && close()}
        onClick={(e) => {
          if (!image) return
          e.stopPropagation()
          if (position) close()
          else open()
        }}
      >
        {children}
      </Box>

      {position &&
        image &&
        createPortal(
          <Box
            role="tooltip"
            sx={[
              popupSx,
              {
                pointerEvents: 'none',
                position: 'fixed',
                zIndex: 'tooltip',
                borderRadius: 3,
                p: 1,
              },
            ]}
            style={{
              left: position.left,
              top: position.top,
              width: PREVIEW_WIDTH,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                aspectRatio: '1',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.05)',
              }}
            >
              <Box
                component="img"
                src={largeAvatarUrl(image)}
                alt=""
                referrerPolicy="no-referrer"
                onLoad={() => setLoaded(true)}
                sx={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  transition: 'opacity 200ms',
                  opacity: loaded ? 1 : 0,
                }}
              />
            </Box>
            <Typography
              noWrap
              sx={{ mt: 1, px: 0.5, textAlign: 'center', fontSize: 12, fontWeight: 500 }}
            >
              {name}
            </Typography>
          </Box>,
          document.fullscreenElement ?? document.body,
        )}
    </>
  )
}
