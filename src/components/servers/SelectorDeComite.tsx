'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useOrg } from '@/lib/org'
import { cn } from '@/lib/utils'

type Props = {
  value: string | null
  onChange: (id: string | null) => void
}

/**
 * SRV-6 · Elegir qué comité mirar en "Mi comité".
 *
 * Agrupado por ÁREA y no una lista plana de 46: quien busca "Worship" lo
 * encuentra escribiendo, pero quien no sabe el nombre exacto necesita el árbol
 * para orientarse.
 *
 * Solo lo ven los roles amplios. El encargado no tiene nada que elegir — ve los
 * suyos y punto.
 */
export function SelectorDeComite({ value, onChange }: Props) {
  const { adminCommittees, adminAreas } = useOrg()
  const [busqueda, setBusqueda] = useState('')

  const porArea = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const nombreDeArea = new Map(adminAreas.map(a => [a.id, a.name]))
    const grupos = new Map<string, { area: string; comites: { id: string; name: string }[] }>()
    for (const c of adminCommittees) {
      if (q && !c.name.toLowerCase().includes(q)) continue
      // Un comité sin área padre no se esconde: iría a parar a un grupo que no
      // existe y desaparecería del selector sin que nadie lo note.
      const areaId = c.area_code || 'sin-area'
      const area = nombreDeArea.get(c.area_code) ?? 'Sin área'
      const g = grupos.get(areaId) ?? { area, comites: [] }
      g.comites.push({ id: c.id, name: c.name })
      grupos.set(areaId, g)
    }
    return [...grupos.values()]
      .map(g => ({ ...g, comites: g.comites.sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
      .sort((a, b) => a.area.localeCompare(b.area, 'es'))
  }, [adminCommittees, adminAreas, busqueda])

  const total = porArea.reduce((n, g) => n + g.comites.length, 0)

  return (
    <div className="card w-full min-w-0 p-4 space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/40" aria-hidden />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar comité…"
          aria-label="Buscar comité"
          className="w-full rounded-xl bg-surface-low py-2 pl-9 pr-3 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
        />
      </div>

      {total === 0 ? (
        <p className="text-[13px] text-navy-light/80 font-body">Ningún comité con ese nombre.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-3">
          {porArea.map(g => (
            <div key={g.area}>
              <p className="mb-1 text-[11px] uppercase tracking-widest text-navy-light/80 font-display">{g.area}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.comites.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c.id === value ? null : c.id)}
                    aria-pressed={c.id === value}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[13px] transition-colors font-body border',
                      c.id === value
                        ? 'bg-coral text-white border-coral'
                        : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
