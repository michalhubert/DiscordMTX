import {
  WARN_AT,
  type ConnectionQuality,
  type ConnectionStats,
} from '../hooks/useConnectionStats'

const DASH = '–'

const qualityMeta: Record<
  ConnectionQuality,
  { bars: number; bar: string; text: string; label: string }
> = {
  good: {
    bars: 4,
    bar: 'bg-emerald-400',
    text: 'text-emerald-400',
    label: 'Excellent',
  },
  fair: {
    bars: 2,
    bar: 'bg-amber-400',
    text: 'text-amber-400',
    label: 'Unstable',
  },
  poor: { bars: 1, bar: 'bg-red-400', text: 'text-red-400', label: 'Poor' },
}

function bitrate(kbps: number): [string, string] {
  return kbps >= 1000
    ? [(kbps / 1000).toFixed(1), 'Mbps']
    : [Math.round(kbps).toString(), 'kbps']
}

function SignalBars({ quality }: { quality: ConnectionQuality }) {
  const { bars, bar } = qualityMeta[quality]
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0.35, 0.55, 0.78, 1].map((height, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-colors ${
            i < bars ? bar : 'bg-white/20'
          }`}
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </span>
  )
}

function StatRow({
  label,
  value,
  unit,
  warn,
}: {
  label: string
  value: string | null
  unit: string
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1">
      <dt className="text-white/50">{label}</dt>
      <dd
        className={`font-medium tabular-nums ${warn ? 'text-amber-300' : 'text-white'}`}
      >
        {value ?? DASH}
        {value !== null && <span className="ml-1 text-white/40">{unit}</span>}
      </dd>
    </div>
  )
}

interface Props {
  quality: ConnectionQuality
  stats: ConnectionStats | null
}

const round = (value: number | null | undefined) =>
  value == null ? null : Math.round(value).toString()

// Signal bars + bitrate; hovering/focusing opens the stats card.
export default function ConnectionIndicator({ quality, stats }: Props) {
  const meta = qualityMeta[quality]
  const [rate, rateUnit] = stats ? bitrate(stats.bitrateKbps) : [DASH, '']

  return (
    <div className="group/stats relative flex">
      <button
        type="button"
        aria-label={`Connection ${meta.label.toLowerCase()} - show stats`}
        className="flex h-10 items-center gap-2.5 rounded-full px-3 text-white/90 transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <SignalBars quality={quality} />
        {/* Fixed width so changing values don't shift neighbours */}
        <span className="hidden w-[4.75rem] text-left text-xs tabular-nums md:block">
          <span className="font-semibold">{rate}</span>
          <span className="ml-1 text-white/50">{rateUnit}</span>
        </span>
      </button>

      <div className="pointer-events-none absolute bottom-full left-0 mb-3 w-64 translate-y-1 rounded-xl bg-neutral-900/95 p-3 text-xs opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-150 group-hover/stats:translate-y-0 group-hover/stats:opacity-100 group-has-[:focus-visible]/stats:translate-y-0 group-has-[:focus-visible]/stats:opacity-100">
        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-semibold text-white">Connection</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${meta.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.bar}`} />
            {meta.label}
          </span>
        </div>
        <dl>
          <StatRow
            label="Bitrate"
            value={stats ? rate : null}
            unit={rateUnit}
          />
          <StatRow label="Frame rate" value={round(stats?.fps)} unit="fps" />
          <StatRow
            label="Latency (RTT)"
            value={round(stats?.rttMs)}
            unit="ms"
            warn={(stats?.rttMs ?? 0) >= WARN_AT.rttMs}
          />
          <StatRow
            label="Jitter"
            value={round(stats?.jitterMs)}
            unit="ms"
            warn={(stats?.jitterMs ?? 0) >= WARN_AT.jitterMs}
          />
          <StatRow
            label="Packet loss"
            value={stats?.packetLossPct.toFixed(1) ?? null}
            unit="%"
            warn={(stats?.packetLossPct ?? 0) >= WARN_AT.packetLossPct}
          />
          <StatRow
            label="Dropped frames"
            value={stats?.droppedFramesPct.toFixed(1) ?? null}
            unit="%"
            warn={(stats?.droppedFramesPct ?? 0) >= WARN_AT.droppedFramesPct}
          />
        </dl>
      </div>
    </div>
  )
}
