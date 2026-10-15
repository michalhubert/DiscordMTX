import { redirect } from 'next/navigation'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { auth } from '@/lib/auth'
import { Satellite } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface MediaMtxPathItem {
  name?: string
  ready?: boolean
}

async function getActiveStreamPath(): Promise<string | null> {
  const host = process.env.MEDIAMTX_HOST ?? 'discordmtx'
  const apiPort = process.env.MEDIAMTX_API_PORT ?? '9997'

  try {
    const res = await fetch(`http://${host}:${apiPort}/v3/paths/list`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as { items?: MediaMtxPathItem[] }
    const activePath = data.items?.find((item) => item.ready)
    return activePath?.name ?? null
  } catch {
    return null
  }
}

export default async function Home() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const activePath = await getActiveStreamPath()
  if (activePath) {
    redirect(`/${activePath}`)
  }

  return (
    <Stack
      sx={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Typography component="span" color="text.disabled" sx={{ display: 'flex' }}>
          <Satellite size={28} />
        </Typography>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          DiscordMTX
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        No stream is currently running.
      </Typography>
    </Stack>
  )
}
