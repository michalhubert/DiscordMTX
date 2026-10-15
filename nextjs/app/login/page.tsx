import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { isViewerPasswordStale, type SessionUser } from '@/lib/authz'
import { streamPathOf } from '@/lib/loginUrl'
import LoginForm from './LoginForm'
import StreamGate from './StreamGate'

export const dynamic = 'force-dynamic'

function getDiscordEnabled() {
  return (
    process.env.NEXT_PUBLIC_DISCORD_ENABLED === 'true' ||
    !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { callbackUrl, mode } = await searchParams
  const path = streamPathOf(callbackUrl)
  const user = (await auth())?.user as SessionUser | undefined

  // A signed-in viewer sent here from a stream waits for access instead of signing in again.
  if (
    path &&
    mode !== 'streamer' &&
    user &&
    user.role !== 'streamer' &&
    !isViewerPasswordStale(user, path)
  ) {
    return <StreamGate path={path} />
  }

  return (
    <Suspense>
      <LoginForm discordEnabled={getDiscordEnabled()} />
    </Suspense>
  )
}
