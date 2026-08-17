'use client'

import { useState, useEffect, useRef } from 'react'
import { Columns2, RotateCcw } from 'lucide-react'

export type ColumnDef<T> = {
  key: keyof T | string
  label: string
  defaultVisible: boolean
  alwaysVisible?: boolean
  exportable?: boolean
  render?: (row: T) => React.ReactNode
  exportValue?: (row: T) => string
}

interface Props<T> {
  columns: ColumnDef<T>[]
  storageKey: string
  onChange: (visible: ColumnDef<T>[]) => void
}

export function ColumnSelector<T>({ columns, storageKey, onChange }: Props<T>) {
  const getDefaults = () => columns.filter(c => c.defaultVisible).map(c => String(c.key))

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return getDefaults()
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: string[] = JSON.parse(stored)
        // always include alwaysVisible keys
        const always = columns.filter(c => c.alwaysVisible).map(c => String(c.key))
        return Array.from(new Set([...always, ...parsed]))
      }
    } catch {}
    return getDefaults()
  })

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const visible = columns.filter(c => visibleKeys.includes(String(c.key)) || c.alwaysVisible)
    onChangeRef.current(visible)
    try { localStorage.setItem(storageKey, JSON.stringify(visibleKeys)) } catch {}
  }, [visibleKeys, columns, storageKey])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(key: string) {
    setVisibleKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function reset() {
    setVisibleKeys(getDefaults())
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
      >
        <Columns2 size={14} strokeWidth={1.75} />
        Columnas
        <span className="text-[12px] opacity-50">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-2xl overflow-hidden bg-surface-card shadow-[0_20px_48px_rgba(22,20,64,0.14)] border border-[var(--outline-variant)]"
        >
          <div className="px-4 py-3 border-b border-[var(--outline-variant)]">
            <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">
              Columnas visibles
            </p>
          </div>

          <div className="py-1.5 max-h-72 overflow-y-auto">
            {columns.map(col => {
              const key = String(col.key)
              const checked = visibleKeys.includes(key) || !!col.alwaysVisible
              return (
                <label
                  key={key}
                  className={`font-body flex items-center gap-2.5 px-4 py-2 text-sm cursor-pointer transition-colors ${
                    col.alwaysVisible ? 'opacity-60 cursor-not-allowed' : 'hover:bg-surface-low'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={col.alwaysVisible}
                    onChange={() => !col.alwaysVisible && toggle(key)}
                    className="accent-coral h-3.5 w-3.5 cursor-pointer rounded"
                  />
                  <span className="flex-1 text-navy">{col.label}</span>
                  {col.alwaysVisible && (
                    <span className="text-[11px] text-navy-light/70 font-body">
                      fijo
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <div className="border-t px-4 py-2.5 border-[var(--outline-variant)]">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-[12px] text-navy-light/70 hover:text-navy transition-colors w-full font-body"
            >
              <RotateCcw size={12} />
              Restaurar por defecto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
