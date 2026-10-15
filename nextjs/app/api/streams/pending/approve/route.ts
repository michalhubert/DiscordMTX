import { approveAccess } from '@/lib/accessRequests'
import { NextRequest } from 'next/server'
import { parsePendingBody } from '../parsePendingBody'

export async function POST(req: NextRequest) {
  const target = await parsePendingBody(req)
  if (target instanceof Response) return target

  approveAccess(target.path, target.ip, target.role)
  return Response.json({ ok: true })
}
