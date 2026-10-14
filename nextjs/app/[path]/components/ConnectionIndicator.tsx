import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { TriangleAlert, WifiOff } from 'lucide-react'
import { popupSx } from '@/lib/theme'
import {
  WARN_AT,
  type ConnectionQuality,
  type ConnectionStats,
  type ConnectionWarning,
} from '../hooks/useConnectionStats'

const DASH = '–'

const qualityMeta: Record<
  ConnectionQuality,
  { bars: number; color: string; label: string }
> = {
  good: { bars: 4, color: 'success.light', label: 'Excellent' },
  fair: { bars: 2, color: 'warning.light', label: 'Unstable' },
  poor: { bars: 1, color: 'error.light', label: 'Poor' },
}

function bitrate(kbps: number): [string, string] {
  return kbps >= 1000
    ? [(kbps / 1000).toFixed(1), 'Mbps']
    : [Math.round(kbps).toString(), 'kbps']
}

function SignalBars({ quality }: { quality: ConnectionQuality }) {
  const { bars, color } = qualityMeta[quality]
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ display: 'flex', height: 16, alignItems: 'flex-end', gap: '3px' }}
    >
      {[0.35, 0.55, 0.78, 1].map((height, i) => (
        <Box
          component="span"
          key={i}
          sx={{
            width: 3,
            height: `${height * 100}%`,
            borderRadius: 1,
            bgcolor: i < bars ? color : 'rgba(255,255,255,0.2)',
            transition: 'background-color 150ms',
          }}
        />
      ))}
    </Box>
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 3,
        py: 0.5,
      }}
    >
      <Box component="dt" sx={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </Box>
      <Box
        component="dd"
        sx={{
          m: 0,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: warn ? 'warning.light' : 'common.white',
        }}
      >
        {value ?? DASH}
        {value !== null && (
          <Box
            component="span"
            sx={{ ml: 0.5, color: 'rgba(255,255,255,0.4)' }}
          >
            {unit}
          </Box>
        )}
      </Box>
    </Box>
  )
}

interface Props {
  quality: ConnectionQuality
  stats: ConnectionStats | null
  warnings: ConnectionWarning[]
}

const round = (value: number | null | undefined) =>
  value == null ? null : Math.round(value).toString()

export default function ConnectionIndicator({ quality, stats, warnings }: Props) {
  const meta = qualityMeta[quality]
  const [rate, rateUnit] = stats ? bitrate(stats.bitrateKbps) : [DASH, '']
  const critical = warnings.some((w) => w.severity === 'critical')

  const card = (
    <Box sx={{ fontSize: 12 }}>
      {warnings.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={[
            {
              mb: 1,
              alignItems: 'flex-start',
              borderRadius: 2,
              border: 1,
              px: 1,
              py: 0.75,
            },
            critical
              ? {
                  borderColor: 'rgba(248,113,113,0.3)',
                  bgcolor: 'rgba(69,10,10,0.75)',
                  color: '#fee2e2',
                }
              : {
                  borderColor: 'rgba(251,191,36,0.3)',
                  bgcolor: 'rgba(69,26,3,0.7)',
                  color: '#fef3c7',
                },
          ]}
        >
          <Box sx={{ mt: '2px', display: 'flex', flexShrink: 0 }}>
            {warnings[0].id === 'offline' ? (
              <WifiOff size={14} />
            ) : (
              <TriangleAlert size={14} />
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.25 }}>
              {warnings[0].message}
            </Typography>
            {warnings.length > 1 && (
              <Typography sx={{ mt: 0.25, fontSize: 10, opacity: 0.75 }}>
                +{warnings.length - 1} more
              </Typography>
            )}
          </Box>
        </Stack>
      )}
      <Box
        sx={{
          mb: 1,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Box component="span" sx={{ fontWeight: 600 }}>
          Connection
        </Box>
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontWeight: 500,
            color: meta.color,
          }}
        >
          <Box
            component="span"
            sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: meta.color }}
          />
          {meta.label}
        </Box>
      </Box>
      <Box component="dl" sx={{ m: 0 }}>
        <StatRow label="Bitrate" value={stats ? rate : null} unit={rateUnit} />
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
      </Box>
    </Box>
  )

  return (
    <Tooltip
      title={card}
      placement="top-start"
      slotProps={{
        tooltip: {
          sx: [
            popupSx,
            { width: 256, maxWidth: 'none', p: 1.5, borderRadius: 3 },
          ],
        },
      }}
    >
      <ButtonBase
        aria-label={`Connection ${meta.label.toLowerCase()} - show stats`}
        sx={{
          height: 40,
          gap: 1.25,
          px: 1.5,
          borderRadius: 5,
          color: 'rgba(255,255,255,0.9)',
          transition: 'background-color 150ms',
          '&:hover, &.Mui-focusVisible': { bgcolor: 'rgba(255,255,255,0.1)' },
        }}
      >
        <SignalBars quality={quality} />
        {/* Fixed width so changing values don't shift neighbours */}
        <Box
          component="span"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: '4.75rem',
            textAlign: 'left',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Box component="span" sx={{ fontWeight: 600 }}>
            {rate}
          </Box>
          <Box component="span" sx={{ ml: 0.5, color: 'rgba(255,255,255,0.5)' }}>
            {rateUnit}
          </Box>
        </Box>
      </ButtonBase>
    </Tooltip>
  )
}
