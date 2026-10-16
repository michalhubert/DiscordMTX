import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { type SessionUser } from '@/lib/authz'
import { viewerAccess } from '@/lib/watchAccess'
import { loginUrlFor } from '@/lib/loginUrl'
import { PATH_NAME_RE } from '@/lib/streamSettings'
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
  if (!PATH_NAME_RE.test(path)) notFound()
  const user = session.user as SessionUser

  const ip = getClientIp({ headers: await headers() })
  if (viewerAccess(user, path, ip).status !== 'ok') redirect(loginUrlFor(path))

  return (
    <Box
      component="main"
      sx={{ height: '100vh', width: '100vw', bgcolor: 'common.black', overflow: 'hidden' }}
    >
      <PlayerClient path={path} whepUrl={`/api/whep/${path}`} />
    </Box>
  )
}
