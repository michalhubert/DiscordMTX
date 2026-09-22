import { isStreamerAuthorized } from '@/lib/authz'
import { syncStreamState } from '@/lib/streamState'
import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { segments } = await params
  const host = process.env.MEDIAMTX_HOST ?? 'discordmtx'
  const apiPort = process.env.MEDIAMTX_API_PORT ?? '9997'
  const upstream = `http://${host}:${apiPort}/v3/${segments.join('/')}${req.nextUrl.search}`

  try {
    const res = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await res.text()

    if (res.ok && segments.join('/') === 'paths/list') {
      try {
        const data = JSON.parse(body)
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            if (item.name) syncStreamState(item.name, item)
          }
        }
      } catch {}
    }

    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'MediaMTX API unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
