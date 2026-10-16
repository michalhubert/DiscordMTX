import { isStreamerAuthorized } from '@/lib/authz'
import { dockSnapshot } from '@/lib/dockSnapshot'
import { onChanged } from '@/lib/events'
import { eventStream } from '@/lib/sse'
import { NextRequest } from 'next/server'

// Changes are pushed; this only refreshes counters.
const REFRESH_MS = 2000

export async function GET(req: NextRequest) {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  return eventStream(req, (stream) => {
    let closed = false
    let building = false
    let rebuild = false
    let last = ''

    // Changes during a build trigger one more.
    async function refresh() {
      if (building) {
        rebuild = true
        return
      }
      building = true
      try {
        do {
          rebuild = false
          const snapshot = await dockSnapshot()
          if (closed) return
          const json = JSON.stringify(snapshot)
          if (json !== last) {
            last = json
            stream.send({ type: 'snapshot', snapshot })
          }
        } while (rebuild && !closed)
      } catch (err) {
        console.error('Failed to build dock snapshot:', err)
      } finally {
        building = false
      }
    }

    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_MS)
    const unsubscribe = onChanged(() => void refresh())

    return {
      close() {
        closed = true
        clearInterval(interval)
        unsubscribe()
      },
    }
  })
}
