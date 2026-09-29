'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import type { PonyChangeResult } from '../hooks/useWatchRoom'

interface Props {
  ponyName: string
  favoriteTag: string | null
  cooldownS: number
  busy: boolean
  onSubmit: (tag: string | null) => Promise<PonyChangeResult>
  onClose: () => void
}

// The Derpibooru tag a guest's avatar pictures must have, applied on top of the
// server's own tags.
export default function FavoriteTagForm({
  ponyName,
  favoriteTag,
  cooldownS,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(favoriteTag ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const disabled = busy || cooldownS > 0

  async function submit(tag: string | null) {
    setMessage(null)
    const result = await onSubmit(tag)
    if (!result.ok) {
      setMessage(result.error)
    } else if (result.favoriteTagMatched === false) {
      setMessage(
        `No pictures of ${ponyName} tagged "${tag}" yet - showing any picture of them.`,
      )
    } else {
      onClose()
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      onSubmit={(e) => {
        e.preventDefault()
        const tag = draft.trim()
        void submit(tag ? tag : null)
      }}
      className="overflow-hidden"
    >
      <div className="mt-1.5 flex flex-col gap-1.5 border-t border-white/10 px-1 pt-2">
        <label
          htmlFor="favorite-tag"
          className="text-[11px] font-medium text-white/60"
        >
          Favourite tag for your pictures
        </label>
        <div className="flex gap-1">
          <input
            id="favorite-tag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
            placeholder="e.g. cute"
            maxLength={60}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 select-text rounded bg-white/10 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={disabled}
            aria-label="Save favourite tag"
            title="Save favourite tag"
            className="rounded bg-white/10 p-1.5 transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {message && (
          <p className="text-[11px] leading-snug text-amber-200/90">
            {message}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/40">
          <span>{cooldownS > 0 ? `Can change in ${cooldownS}s` : ''}</span>
          {favoriteTag && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setDraft('')
                void submit(null)
              }}
              className="rounded px-1 text-white/60 underline-offset-2 hover:text-white hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              Remove &ldquo;{favoriteTag}&rdquo;
            </button>
          )}
        </div>
      </div>
    </motion.form>
  )
}
