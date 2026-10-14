import { useEffect, useState, type RefObject } from 'react'

export function useFullscreen(
  containerRef: RefObject<HTMLDivElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  function isCurrentlyFullscreen(): boolean {
    const doc = document as Document & { webkitFullscreenElement?: Element }
    const video = videoRef.current as
      (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null
    return !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      video?.webkitDisplayingFullscreen
    )
  }

  // Standard API, plus webkit for Safari - and iOS, where only the <video>
  // element itself can go fullscreen.
  async function enterVideoFullscreen() {
    const video = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen()
    else if (video?.requestFullscreen) await video.requestFullscreen()
    else return
    setIsFullscreen(true)
  }

  async function toggleFullscreen() {
    const container = containerRef.current as
      | (HTMLDivElement & {
          webkitRequestFullscreen?: () => Promise<void> | void
        })
      | null
    const video = videoRef.current as
      (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null
    const doc = document as Document & {
      webkitFullscreenElement?: Element
      webkitExitFullscreen?: () => Promise<void> | void
    }

    if (isCurrentlyFullscreen()) {
      try {
        if (doc.fullscreenElement) {
          await doc.exitFullscreen()
        } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (video?.webkitExitFullscreen) {
          video.webkitExitFullscreen()
        }
      } catch {}
      setIsFullscreen(false)
      return
    }

    try {
      if (container?.requestFullscreen) {
        await container.requestFullscreen()
      } else if (container?.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen()
      } else {
        await enterVideoFullscreen()
        return
      }
      setIsFullscreen(true)
    } catch {
      try {
        await enterVideoFullscreen()
      } catch {}
    }
  }

  useEffect(() => {
    const update = () => setIsFullscreen(isCurrentlyFullscreen())
    const events = ['fullscreenchange', 'webkitfullscreenchange']
    events.forEach((ev) => document.addEventListener(ev, update))

    const video = videoRef.current
    if (video) {
      video.addEventListener('webkitbeginfullscreen', update)
      video.addEventListener('webkitendfullscreen', update)
    }

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, update))
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', update)
        video.removeEventListener('webkitendfullscreen', update)
      }
    }
  }, [videoRef])

  return { isFullscreen, toggleFullscreen }
}
