import type { ReactNode } from 'react'

interface Props {
  label: string
  shortcut?: string
  align?: 'start' | 'center' | 'end'
  children: ReactNode
}

const alignClass = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

export default function ControlTooltip({
  label,
  shortcut,
  align = 'center',
  children,
}: Props) {
  return (
    <div className="group/tip relative flex">
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-3 flex translate-y-1 items-center gap-2 whitespace-nowrap rounded-md bg-neutral-900/95 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-y-0 group-has-[:focus-visible]/tip:opacity-100 ${alignClass[align]}`}
      >
        {label}
        {shortcut && (
          <kbd className="rounded bg-white/15 px-1.5 py-px font-sans text-[10px] font-semibold text-white/80">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  )
}
