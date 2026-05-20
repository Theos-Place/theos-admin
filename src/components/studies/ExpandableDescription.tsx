'use client'

import { useState } from 'react'

export function ExpandableDescription({ text, maxLength = 120 }: { text?: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null

  const isLong = text.length > maxLength
  const displayed = expanded || !isLong ? text : text.slice(0, maxLength) + '...'

  return (
    <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
      {displayed}
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--brand-coral)', fontSize: 11, fontWeight: 600,
            padding: '0 0 0 4px',
          }}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
