import { redirect } from 'next/navigation'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { auth } from '@/lib/auth'
import { listPaths } from '@/lib/mediamtx'
import { Satellite } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getActiveStreamPath(): Promise<string | null> {
  const paths = await listPaths()
  return paths?.find((item) => item.ready)?.name ?? null
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
