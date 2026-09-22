import { isStreamerAuthorized } from '@/lib/authz'
import { listPendingRequests } from '@/lib/accessRequests'

export async function GET() {
  if (!(await isStreamerAuthorized())) {
    return new Response('Unauthorized', { status: 401 })
  }

  return new Response(JSON.stringify({ items: listPendingRequests() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
