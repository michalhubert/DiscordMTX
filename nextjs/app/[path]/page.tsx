import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPathVisibility } from '@/lib/db'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { isApproved } from '@/lib/accessRequests'
import { getBlock, blockedViewerOf } from '@/lib/accessBlocks'
import { loginUrlFor } from '@/lib/loginUrl'
import { getClientIp } from '@/lib/net'
import Box from '@mui/material/Box'
import PlayerClient from './PlayerClient'

export default async function StreamPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const { path } = await params
  const user = session.user as SessionUser

  // Bounce back to login if the streamer rotated the password since this session was issued.
  if (isViewerPasswordStale(user, path)) {
    redirect('/login')
  }

  if (user.role !== 'streamer') {
    const ip = getClientIp({ headers: await headers() })
    const mustWait =
      getBlock(path, blockedViewerOf(user, ip)) ||
      (getPathVisibility(path) === 'private' && !isApproved(path, ip, user.role))
    if (mustWait) redirect(loginUrlFor(path))
  }

  return (
    <Box
      component="main"
      sx={{ height: '100vh', width: '100vw', bgcolor: 'common.black', overflow: 'hidden' }}
    >
      <PlayerClient path={path} whepUrl={`/api/whep/${path}`} />
    </Box>
  )
}
