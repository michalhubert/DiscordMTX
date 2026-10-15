import Avatar from '@mui/material/Avatar'
import type { SxProps, Theme } from '@mui/material/styles'
import type { WatchViewer } from '@/lib/watchRoomShared'

const FALLBACK_COLORS = [
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#8b5cf6',
  '#d946ef',
  '#14b8a6',
  '#f97316',
]

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)
}

interface Props {
  viewer: WatchViewer
  size?: number
  sx?: SxProps<Theme>
}

export default function ViewerAvatar({ viewer, size = 24, sx }: Props) {
  const color =
    viewer.role === 'streamer'
      ? '#ef4444'
      : FALLBACK_COLORS[
          parseInt(viewer.id.slice(0, 2), 16) % FALLBACK_COLORS.length
        ]

  return (
    <Avatar
      src={viewer.image ?? undefined}
      alt=""
      slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
      sx={[
        {
          width: size,
          height: size,
          flexShrink: 0,
          fontSize: size * 0.4,
          fontWeight: 600,
          textTransform: 'uppercase',
          color: '#fff',
          bgcolor: viewer.image ? 'transparent' : color,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.2)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {initials(viewer.name)}
    </Avatar>
  )
}
