import { useEffect } from 'react'
import { Vibrant } from 'node-vibrant/browser'
import { useThemeStore } from './themeStore'

// Keeps the stored avatar accent in sync with the viewer's current picture.
// Discord's and Derpibooru's CDNs allow CORS, so the picture is readable.
export function useAvatarAccentDetection(image: string | null | undefined) {
  const setAvatarAccent = useThemeStore((s) => s.setAvatarAccent)

  useEffect(() => {
    if (!image) return
    let cancelled = false
    Vibrant.from(image)
      .getPalette()
      .then((palette) => {
        // null for greyscale pictures, which falls back to the default accent.
        const swatch = palette.Vibrant ?? palette.LightVibrant
        if (!cancelled) setAvatarAccent(swatch?.hex ?? null)
      })
      .catch(() => {
        // Unreadable picture: keep the previous accent.
      })
    return () => {
      cancelled = true
    }
  }, [image, setAvatarAccent])
}
