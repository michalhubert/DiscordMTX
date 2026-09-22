import { isStreamerAuthorized } from '@/lib/authz'
import {
  DEFAULT_STREAM_SETTINGS,
  getStreamSettings,
  saveStreamSettings,
  StreamSettings,
} from '@/lib/db'
import { NextRequest } from 'next/server'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SOURCE_TYPES = ['monitor', 'window', 'browser']
const VIDEO_CODECS = ['auto', 'vp9', 'vp8', 'h264', 'av1']
const CONTENT_HINTS = ['none', 'motion', 'detail', 'text']
const DEGRADATION_PREFERENCES = [
  'balanced',
  'maintain-framerate',
  'maintain-resolution',
]

// MediaMTX path names must be safe for MTX_PATHS_<NAME>_* env vars and URLs:
// letters, digits, and forward slashes only (matches MediaMTX's own path
// naming rules), 1-64 chars.
const PATH_NAME_RE = /^[A-Za-z0-9/]{1,64}$/

function sanitizeSettings(input: unknown): StreamSettings | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const path =
    typeof raw.path === 'string' && PATH_NAME_RE.test(raw.path)
      ? raw.path
      : DEFAULT_STREAM_SETTINGS.path

  const sourceType = SOURCE_TYPES.includes(raw.sourceType as string)
    ? (raw.sourceType as StreamSettings['sourceType'])
    : DEFAULT_STREAM_SETTINGS.sourceType

  const videoCodec = VIDEO_CODECS.includes(raw.videoCodec as string)
    ? (raw.videoCodec as StreamSettings['videoCodec'])
    : DEFAULT_STREAM_SETTINGS.videoCodec

  const contentHint = CONTENT_HINTS.includes(raw.contentHint as string)
    ? (raw.contentHint as StreamSettings['contentHint'])
    : DEFAULT_STREAM_SETTINGS.contentHint

  const degradationPreference = DEGRADATION_PREFERENCES.includes(
    raw.degradationPreference as string,
  )
    ? (raw.degradationPreference as StreamSettings['degradationPreference'])
    : DEFAULT_STREAM_SETTINGS.degradationPreference

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

  return json(getStreamSettings())
}

export async function POST(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const settings = sanitizeSettings(body)
  if (!settings) {
    return json({ error: 'Invalid settings payload' }, 400)
  }

  saveStreamSettings(settings)
  return json(settings)
}
