import { isStreamerAuthorized } from '@/lib/authz'
import { listConfiguredPaths, pathNames } from '@/lib/mediamtx'
import { refreshStreamStates } from '@/lib/streamState'

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const [live, configured] = await Promise.all([
    refreshStreamStates(),
    listConfiguredPaths(),
  ])
  if (!live && !configured) {
    return Response.json({ error: 'MediaMTX API unreachable' }, { status: 502 })
  }
  return Response.json({ paths: pathNames(configured, live) })
}
