'use client'

import { useState } from 'react'

export function ExpandableDescription({ text, maxLength = 120 }: { text?: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null

  const isLong = text.length > maxLength
  const displayed = expanded || !isLong ? text : text.slice(0, maxLength) + '...'

  return (
    <div className="text-[12px] text-[var(--fg-muted)] leading-[1.5] font-body">
      {displayed}
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className="bg-transparent border-none cursor-pointer text-coral text-[12px] font-semibold py-0 pr-0 pl-1"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
