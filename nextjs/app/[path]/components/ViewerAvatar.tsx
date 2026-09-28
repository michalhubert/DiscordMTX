import type { WatchViewer } from '@/lib/watchRoomShared'

const FALLBACK_COLORS = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-teal-500',
  'bg-orange-500',
]

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)
}

interface Props {
  viewer: WatchViewer
  className?: string
}

export default function ViewerAvatar({ viewer, className = 'h-6 w-6' }: Props) {
  if (viewer.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={viewer.image}
        alt=""
        referrerPolicy="no-referrer"
        className={`${className} shrink-0 rounded-full object-cover ring-1 ring-white/20`}
      />
    )
  }

  const color =
    FALLBACK_COLORS[
      parseInt(viewer.id.slice(0, 2), 16) % FALLBACK_COLORS.length
    ]
  return (
    <span
      className={`${className} ${
        viewer.role === 'streamer' ? 'bg-red-500' : color
      } flex shrink-0 items-center justify-center rounded-full text-[0.6em] font-semibold uppercase text-white ring-1 ring-white/20`}
    >
      {initials(viewer.name)}
    </span>
  )
}
