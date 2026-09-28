// Pony names and avatars for viewers without a Discord account ("guests").
// Avatars are hotlinked from Derpibooru's CDN; only the chosen URL is stored.
// Identities are per path + IP and last for one stream session, unless kept.
import { createHash } from 'crypto'
import {
  getGuestIdentity,
  getStreamSessionByPath,
  saveGuestIdentity,
  type GuestIdentityRow,
} from './db'
import { PONY_NAMES } from './ponyNames'

const DERPIBOORU_SEARCH = 'https://derpibooru.org/api/v1/json/search/images'
const POOL_SIZE = 20
// More than one, so there's still a pick when the first is the current picture.
const REROLL_BATCH_SIZE = 3
const POOL_TTL_MS = 6 * 60 * 60 * 1000
const RETRY_AFTER_FAILURE_MS = 60 * 1000
const FETCH_TIMEOUT_MS = 5000
// Derpibooru answers bursts with HTTP 429, e.g. when many guests join at once.
const MIN_REQUEST_GAP_MS = 500
const RATE_LIMIT_BACKOFF_MS = 5000
// Used when a pony has no matching pictures.
const FALLBACK_TAG = 'pony'
// How long joining the watch room waits for a new avatar; slower picks still get stored.
const AVATAR_WAIT_MS = 2000

// Empty = Derpibooru's default filter.
const filterId = (process.env.GUEST_AVATAR_FILTER_ID ?? '').trim()

// Comma-separated tags, "-" prefix excludes. Quoted so they can't alter the query.
const extraTags = (process.env.GUEST_AVATAR_TAGS ?? '')
  .split(',')
  .map((t) => {
    const negated = t.trim().startsWith('-')
    const tag = t
      .trim()
      .replace(/^-/, '')
      .replace(/["\\]/g, '')
      .trim()
      .toLowerCase()
    return tag ? `${negated ? '-' : ''}"${tag}"` : ''
  })
  .filter(Boolean)

// Stored with each avatar, so changing the settings re-picks avatars.
const settingsKey = [filterId, ...extraTags].join('|')

function ponyFor(seed: string): (typeof PONY_NAMES)[number] {
  const digest = createHash('sha256')
    .update(`${process.env.NEXTAUTH_SECRET ?? ''}:guest:${seed}`)
    .digest()
  return PONY_NAMES[digest.readUInt32BE(0) % PONY_NAMES.length]
}

const store = globalThis as typeof globalThis & {
  __guestAvatarPools?: Map<string, { urls: string[]; expiresAt: number }>
  __guestAvatarRequests?: Map<string, Promise<string[] | null>>
  __guestAvatarPicks?: Map<string, Promise<string | null>>
  __derpibooruNextSlotAt?: number
}
const pools = (store.__guestAvatarPools ??= new Map())
const inflight = (store.__guestAvatarRequests ??= new Map())
// Keyed by identityKey(), so parallel requests agree on one image.
const avatarPicks = (store.__guestAvatarPicks ??= new Map())

async function waitForRequestSlot(): Promise<void> {
  const now = Date.now()
  const at = Math.max(now, store.__derpibooruNextSlotAt ?? 0)
  store.__derpibooruNextSlotAt = at + MIN_REQUEST_GAP_MS
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
}

function backOff(res: Response): void {
  const retryAfterS = Number(res.headers.get('retry-after'))
  const waitMs = retryAfterS > 0 ? retryAfterS * 1000 : RATE_LIMIT_BACKOFF_MS
  store.__derpibooruNextSlotAt = Math.max(
    store.__derpibooruNextSlotAt ?? 0,
    Date.now() + waitMs,
  )
}

// null = request failed (as opposed to [] = no matching images).
async function fetchPool(
  tag: string,
  count = POOL_SIZE,
  retryOnRateLimit = true,
): Promise<string[] | null> {
  const params = new URLSearchParams({
    q: [`"${tag}"`, 'solo', ...extraTags, 'score.gte:50', '-animated'].join(
      ', ',
    ),
    per_page: String(count),
    sf: 'random',
  })
  if (filterId) params.set('filter_id', filterId)

  try {
    await waitForRequestSlot()
    const res = await fetch(`${DERPIBOORU_SEARCH}?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DiscordMTX guest avatars',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      if (res.status === 429) {
        backOff(res)
        if (retryOnRateLimit) return fetchPool(tag, count, false)
      }
      console.error(
        `Failed to fetch guest avatars for "${tag}": HTTP ${res.status}`,
      )
      return null
    }
    const data = (await res.json()) as {
      images?: { representations?: { thumb_small?: string } }[]
    }
    return (data.images ?? [])
      .map((image) => image.representations?.thumb_small)
      .filter((url): url is string => !!url?.startsWith('https://'))
  } catch (err) {
    console.error(`Failed to fetch guest avatars for "${tag}":`, err)
    return null
  }
}

async function poolFor(tag: string): Promise<string[]> {
  const cached = pools.get(tag)
  if (cached && Date.now() < cached.expiresAt) return cached.urls

  let request = inflight.get(tag)
  if (!request) {
    request = fetchPool(tag).finally(() => inflight.delete(tag))
    inflight.set(tag, request)
  }
  const urls = await request
  if (urls === null) {
    // Keep serving the stale pool, and retry soon.
    const stale = cached?.urls ?? []
    pools.set(tag, {
      urls: stale,
      expiresAt: Date.now() + RETRY_AFTER_FAILURE_MS,
    })
    return stale
  }
  pools.set(tag, { urls, expiresAt: Date.now() + POOL_TTL_MS })
  return urls
}

function identityKey(path: string, ip: string): string {
  return `${path}::${ip}`
}

// The guest's row for the current stream; a fresh one when there's none yet or it
// belongs to a previous stream and wasn't kept.
function currentRow(path: string, ip: string): GuestIdentityRow {
  const row = getGuestIdentity(path, ip)
  const session = getStreamSessionByPath(path)?.id ?? null
  // While offline (no session) keep whatever they had.
  const expired =
    row && !row.keep && session !== null && row.stream_session_id !== session
  if (row && !expired) return row

  const fresh: GuestIdentityRow = {
    path,
    ip,
    // Deterministic, so concurrent first requests produce the same identity.
    seed: `${ip}:${session ?? 'none'}`,
    avatar_url: null,
    avatar_settings: null,
    keep: 0,
    stream_session_id: session,
  }
  saveGuestIdentity(fresh)
  return fresh
}

function storedAvatar(row: GuestIdentityRow): string | null {
  return row.avatar_settings === settingsKey ? row.avatar_url : null
}

async function pickAvatar(
  row: GuestIdentityRow,
  exclude: string | null,
): Promise<string | null> {
  const [, tag] = ponyFor(row.seed)
  let choices = (await poolFor(tag)).filter((u) => u !== exclude)
  if (choices.length === 0)
    choices = (await poolFor(FALLBACK_TAG)).filter((u) => u !== exclude)
  if (choices.length === 0) return null
  return choices[Math.floor(Math.random() * choices.length)]
}

function assignAvatar(row: GuestIdentityRow): Promise<string | null> {
  const key = identityKey(row.path, row.ip)
  let pick = avatarPicks.get(key)
  if (!pick) {
    pick = pickAvatar(row, null)
      .then((url) => {
        // Only store it if the identity hasn't moved on meanwhile.
        const latest = getGuestIdentity(row.path, row.ip)
        if (url && latest?.seed === row.seed) {
          saveGuestIdentity({
            ...latest,
            avatar_url: url,
            avatar_settings: settingsKey,
          })
        }
        return url
      })
      .finally(() => avatarPicks.delete(key))
    avatarPicks.set(key, pick)
  }
  return pick
}

export type GuestIdentity = {
  name: string
  // null until picked, or when Derpibooru is unreachable (UI shows initials).
  image: string | null
  kept: boolean
}

function toIdentity(
  row: GuestIdentityRow,
  image: string | null,
): GuestIdentity {
  return { name: ponyFor(row.seed)[0], image, kept: row.keep === 1 }
}

export async function guestIdentity(
  path: string,
  ip: string,
): Promise<GuestIdentity> {
  const row = currentRow(path, ip)
  const stored = storedAvatar(row)
  if (stored) return toIdentity(row, stored)
  const image = await Promise.race([
    assignAvatar(row),
    new Promise<null>((resolve) => setTimeout(resolve, AVATAR_WAIT_MS, null)),
  ])
  return toIdentity(row, image)
}

// Non-blocking: returns the avatar only if already known, and starts picking one otherwise.
export function cachedGuestIdentity(path: string, ip: string): GuestIdentity {
  const row = currentRow(path, ip)
  const image = storedAvatar(row)
  if (!image) void assignAvatar(row)
  return toIdentity(row, image)
}

// Kept identities survive future streams; releasing keeps it for the current one.
export function setGuestKeep(
  path: string,
  ip: string,
  keep: boolean,
): GuestIdentity {
  const row = currentRow(path, ip)
  const updated: GuestIdentityRow = {
    ...row,
    keep: keep ? 1 : 0,
    stream_session_id:
      getStreamSessionByPath(path)?.id ?? row.stream_session_id,
  }
  saveGuestIdentity(updated)
  return toIdentity(updated, storedAvatar(updated))
}

export async function rerollGuestAvatar(
  path: string,
  ip: string,
): Promise<GuestIdentity> {
  // Let a running pick finish first, so it can't overwrite the reroll.
  await avatarPicks.get(identityKey(path, ip))
  const row = currentRow(path, ip)
  const current = storedAvatar(row)

  // A fresh random batch rather than the cached pool, so rerolls don't cycle
  // through the same pictures.
  const [, tag] = ponyFor(row.seed)
  const fresh = await fetchPool(tag, REROLL_BATCH_SIZE)
  const url =
    fresh?.find((u) => u !== current) ?? (await pickAvatar(row, current))

  if (url)
    saveGuestIdentity({ ...row, avatar_url: url, avatar_settings: settingsKey })
  return toIdentity(row, url ?? current)
}
