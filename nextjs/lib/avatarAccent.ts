import { useEffect } from 'react'
import { Vibrant } from 'node-vibrant/browser'
import { useThemeStore } from './themeStore'

// Fetched rather than passed as a URL: Firefox may reuse the <img> tags' non-CORS
// copy, which can't be read.
async function readAccent(image: string): Promise<string | null> {
  const blob = await (await fetch(image)).blob()
  const url = URL.createObjectURL(blob)
  try {
    const palette = await Vibrant.from(url).getPalette()
    // null for greyscale pictures, which falls back to the default accent.
    return (palette.Vibrant ?? palette.LightVibrant)?.hex ?? null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Keeps the stored avatar accent in sync with the viewer's current picture.
export function useAvatarAccentDetection(image: string | null | undefined) {
  const setAvatarAccent = useThemeStore((s) => s.setAvatarAccent)
  const setAvailable = useThemeStore((s) => s.setAvatarAccentAvailable)
  const hasImage = !!image

  useEffect(() => {
    if (!hasImage) return
    setAvailable(true)
    return () => setAvailable(false)
  }, [hasImage, setAvailable])

  useEffect(() => {
    if (!image) return
    let cancelled = false
    readAccent(image)
      .then((accent) => {
        if (!cancelled) setAvatarAccent(accent)
      })
      .catch(() => {
        // Unreadable picture: keep the previous accent.
      })
    return () => {
      cancelled = true
    }
  }, [image, setAvatarAccent])
}
