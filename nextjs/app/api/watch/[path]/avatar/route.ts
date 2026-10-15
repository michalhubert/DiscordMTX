import {
  claimGuestReroll,
  GUEST_REROLL_COOLDOWN_MS,
  rerollGuestAvatar,
} from '@/lib/guestIdentity'
import { authorizeGuest } from '@/lib/watchAccess'
import { refreshWatchGuest } from '@/lib/watchRoom'
import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string }> },
) {
  const { path } = await params
  const guest = await authorizeGuest(req, path)
  if (guest instanceof Response) return guest
  const { ponyKey } = guest

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
