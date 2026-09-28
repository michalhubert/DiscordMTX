'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  className?: string
  children: ReactNode
}

// Enlarged avatar on hover (or tap). Portalled so lists can't clip it - into the
// fullscreen element when there is one.
export default function AvatarPreview({
  image,
  name,
  className,
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

  // Tapping elsewhere or scrolling closes it.
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
      <span
        ref={anchorRef}
        className={className}
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
      </span>

      {position &&
        image &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] rounded-xl bg-neutral-900/95 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
            style={{
              left: position.left,
              top: position.top,
              width: PREVIEW_WIDTH,
            }}
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={largeAvatarUrl(image)}
                alt=""
                referrerPolicy="no-referrer"
                onLoad={() => setLoaded(true)}
                className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
                  loaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
            <p className="mt-2 truncate px-1 text-center text-xs font-medium text-white">
              {name}
            </p>
          </div>,
          document.fullscreenElement ?? document.body,
        )}
    </>
  )
}
