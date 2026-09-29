import {
  claimGuestReroll,
  GUEST_REROLL_COOLDOWN_MS,
  ponyKeyFor,
  rerollGuestAvatar,
} from '@/lib/guestIdentity'
import { authorizeWatch } from '@/lib/watchAccess'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

// Gives a guest a different picture of their pony, once per cooldown.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const result = await authorizeWatch(req, path)
  if (!result.user) return new Response(null, { status: result.error })
  const ponyKey = ponyKeyFor(
    result.user.role,
    result.user.name,
    result.ip,
    path,
  )
  if (!ponyKey) {
    return new Response('No pony identity', { status: 400 })
  }

  const waitMs = claimGuestReroll(path, ponyKey)
  if (waitMs > 0) {
    return Response.json({ rerollInMs: waitMs }, { status: 429 })
  }

  const pony = await rerollGuestAvatar(path, ponyKey)
  await refreshWatchGuest(path, ponyKey)
  return Response.json({
    image: pony.image,
    favoriteTag: pony.favoriteTag,
    favoriteTagMatched: pony.favoriteTagMatched,
    rerollInMs: GUEST_REROLL_COOLDOWN_MS,
  })
}
