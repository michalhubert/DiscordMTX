import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AlertTriangle, WifiOff } from 'lucide-react'
import type { PlayerStatus } from '../hooks/useWhepPlayer'

interface Props {
  status: PlayerStatus
}

const statusLabels: Record<PlayerStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  offline: 'Stream offline',
  error: 'Connection error',
}

export default function PlayerStatusOverlay({ status }: Props) {
  if (status === 'connected') return null

  return (
    <Stack
      spacing={1.5}
      sx={{
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.8)',
        color: 'text.secondary',
      }}
    >
      <StatusIcon status={status} />
      <Typography variant="h6" component="p" color="text.primary" sx={{ fontWeight: 500 }}>
        {statusLabels[status]}
      </Typography>
    </Stack>
  )
}

function StatusIcon({ status }: { status: PlayerStatus }) {
  if (status === 'connecting') {
    return <CircularProgress size={36} />
  }
  if (status === 'offline') {
    return <WifiOff size={40} />
  }
  return <AlertTriangle size={40} />
}
