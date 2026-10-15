import { isStreamerAuthorized } from '@/lib/authz'
import { getStreamSettings, saveStreamSettings } from '@/lib/db'
import {
  CONTENT_HINTS,
  DEFAULT_STREAM_SETTINGS,
  DEGRADATION_PREFERENCES,
  PATH_NAME_RE,
  SOURCE_TYPES,
  VIDEO_CODECS,
  type StreamSettings,
} from '@/lib/streamSettings'
import { NextRequest } from 'next/server'

function pickEnum<T extends string>(
  value: unknown,
  list: readonly T[],
  fallback: T,
): T {
  return list.includes(value as T) ? (value as T) : fallback
}

function sanitizeSettings(input: unknown): StreamSettings | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const path =
    typeof raw.path === 'string' && PATH_NAME_RE.test(raw.path)
      ? raw.path
      : DEFAULT_STREAM_SETTINGS.path

  const sourceType = pickEnum(
    raw.sourceType,
    SOURCE_TYPES,
    DEFAULT_STREAM_SETTINGS.sourceType,
  )
  const videoCodec = pickEnum(
    raw.videoCodec,
    VIDEO_CODECS,
    DEFAULT_STREAM_SETTINGS.videoCodec,
  )
  const contentHint = pickEnum(
    raw.contentHint,
    CONTENT_HINTS,
    DEFAULT_STREAM_SETTINGS.contentHint,
  )
  const degradationPreference = pickEnum(
    raw.degradationPreference,
    DEGRADATION_PREFERENCES,
    DEFAULT_STREAM_SETTINGS.degradationPreference,
  )

  const clamp = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, Math.round(num)))
  }

  return {
    path,
    sourceType,
    fixedResolution: !!raw.fixedResolution,
    width: clamp(raw.width, DEFAULT_STREAM_SETTINGS.width, 160, 7680),
    height: clamp(raw.height, DEFAULT_STREAM_SETTINGS.height, 120, 4320),
    fps: clamp(raw.fps, DEFAULT_STREAM_SETTINGS.fps, 1, 60),
    videoBitrateKbps: clamp(
      raw.videoBitrateKbps,
      DEFAULT_STREAM_SETTINGS.videoBitrateKbps,
      100,
      50000,
    ),
    videoCodec,
    contentHint,
    degradationPreference,
    includeAudio:
      raw.includeAudio !== undefined
        ? !!raw.includeAudio
        : DEFAULT_STREAM_SETTINGS.includeAudio,
    audioBitrateKbps: clamp(
      raw.audioBitrateKbps,
      DEFAULT_STREAM_SETTINGS.audioBitrateKbps,
      6,
      512,
    ),
  }
}

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  return Response.json(getStreamSettings())
}

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const settings = sanitizeSettings(body)
  if (!settings) {
    return Response.json(
      { error: 'Invalid settings payload' },
      { status: 400 },
    )
  }

  saveStreamSettings(settings)
  return Response.json(settings)
}
