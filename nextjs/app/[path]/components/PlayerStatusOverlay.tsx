import { AlertTriangle, Loader2, WifiOff } from 'lucide-react'
import type { PlayerStatus } from '../hooks/useWhepPlayer'

interface Props {
  status: PlayerStatus
}

const statusLabels: Record<PlayerStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  offline: 'Stream offline',
  error: 'Connection error',
  kicked: 'Removed by the streamer',
}

export default function PlayerStatusOverlay({ status }: Props) {
  if (status === 'connected') return null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
      <StatusIcon status={status} className="w-10 h-10 text-gray-300" />
      <p className="text-white text-lg font-medium">{statusLabels[status]}</p>
    </div>
  )
}

function StatusIcon({
  status,
  className,
}: {
  status: PlayerStatus
  className?: string
}) {
  if (status === 'connecting') {
    return <Loader2 className={`${className ?? ''} animate-spin`} />
  }
  if (status === 'offline' || status === 'kicked') {
    return <WifiOff className={className} />
  }
  return <AlertTriangle className={className} />
}
