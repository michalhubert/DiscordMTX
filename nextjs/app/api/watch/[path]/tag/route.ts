import {
  cachedGuestIdentity,
  claimGuestReroll,
  GUEST_REROLL_COOLDOWN_MS,
  guestRerollWaitMs,
  normalizeFavoriteTag,
  setGuestFavoriteTag,
} from '@/lib/guestIdentity'
import { authorizeGuest } from '@/lib/watchAccess'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

// Sets (or with null, clears) the Derpibooru tag a guest's avatars must have.
// It picks a new picture, so it shares the reroll cooldown.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const guest = await authorizeGuest(req, path)
  if (guest instanceof Response) return guest
  const { ponyKey } = guest

  const body = await req.json().catch(() => null)
  if (typeof body?.tag !== 'string' && body?.tag !== null) {
    return new Response('Expected { tag: string | null }', { status: 400 })
  }
  const tag = body.tag === null ? null : normalizeFavoriteTag(body.tag)
  if (body.tag !== null && !tag) {
    return new Response('Not a valid tag', { status: 400 })
  }

  const current = cachedGuestIdentity(path, ponyKey)
  if (current.favoriteTag === tag) {
    return Response.json({
      image: current.image,
      favoriteTag: tag,
      favoriteTagMatched: null,
      rerollInMs: guestRerollWaitMs(path, ponyKey),
    })
  }

  const waitMs = claimGuestReroll(path, ponyKey)
  if (waitMs > 0) {
    return Response.json({ rerollInMs: waitMs }, { status: 429 })
  }

  const pony = await setGuestFavoriteTag(path, ponyKey, tag)
  await refreshWatchGuest(path, ponyKey)
  return Response.json({
    image: pony.image,
    favoriteTag: pony.favoriteTag,
    favoriteTagMatched: pony.favoriteTagMatched,
    rerollInMs: GUEST_REROLL_COOLDOWN_MS,
  })
}
