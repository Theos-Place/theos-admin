'use client'

/**
 * Pestaña "Del sistema": los correos automáticos, con a quién y cómo salieron.
 *
 * Hasta ahora no se veían en ningún lado. Un aviso de matrícula, una beca
 * aprobada o un enlace de contraseña salía sin dejar rastro visible, y cuando
 * alguien decía "no me llegó" la respuesta se deducía mirando otras tablas.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Mail, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import {
  FILTROS_CORREO, ETIQUETA_ESTADO, BADGE_ESTADO, AYUDA_ESTADO, esProblema, textoVacio,
  type FiltroCorreo, type CorreoDelSistema,
} from '@/lib/communications/correos-del-sistema'

const POR_PAGINA = 50

export function CorreosDelSistemaTab() {
  const [filtro, setFiltro] = useState<FiltroCorreo>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<{ items: CorreoDelSistema[]; total: number }>({ items: [], total: 0 })
  const [cargando, setCargando] = useState(true)

  // La búsqueda va al servidor (son ~1.700 filas y crecen), con un respiro para
  // no disparar una consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda.trim()); setPagina(1) }, 350)
    return () => clearTimeout(t)
  }, [busqueda])

  // Cadena de .then y no async/await: el estado se toca solo dentro de los
  // callbacks, que es la única forma en que react-hooks/set-state-in-effect
  // acepta un fetch disparado desde un efecto. Con await marca igual aunque el
  // setState vaya después (comprobado; está anotado en eslint.config.mjs), y
  // este código es nuevo: no tiene por qué nacer debiendo.
  const cargar = useCallback(() => {
    const p = new URLSearchParams({ filtro, page: String(pagina), pageSize: String(POR_PAGINA) })
    if (q) p.set('q', q)
    return fetch(`/api/communications/system-emails?${p}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then(d => setDatos({ items: d?.items ?? [], total: d?.total ?? 0 }))
      .catch(() => setDatos({ items: [], total: 0 }))
      .finally(() => setCargando(false))
  }, [filtro, pagina, q])
  useEffect(() => { cargar() }, [cargar])

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA))
  const desde = datos.total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const hasta = Math.min(pagina * POR_PAGINA, datos.total)
  const conProblema = useMemo(() => datos.items.filter(i => esProblema(i.estado)).length, [datos.items])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTROS_CORREO.map(f => (
            <button
              key={f.id}
              onClick={() => { setFiltro(f.id); setPagina(1); setCargando(true) }}
              aria-pressed={filtro === f.id}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-all font-display',
                filtro === f.id ? 'bg-navy text-white border-navy' : 'text-navy-light/80 hover:text-navy border-transparent hover:border-navy/20',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" aria-hidden />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            aria-label="Buscar por persona, correo o asunto"
            placeholder="Buscar correo o asunto…"
            className="w-64 rounded-xl border border-outline bg-surface-card pl-9 pr-3 py-2 text-sm text-navy font-body"
          />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/80 font-body inline-flex items-center gap-2 justify-center w-full">
            <Loader2 size={15} className="animate-spin" /> Cargando…
          </p>
        ) : datos.items.length === 0 ? (
          <EmptyState icon={Mail} title={textoVacio(filtro, q.length > 0)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Para', 'Asunto', 'Fecha', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c, idx) => (
                  <tr key={c.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-4 py-3">
                      {/* El nombre sale de emparejar el correo con una ficha; si
                          no hay ficha, la dirección es todo lo que tenemos. */}
                      {c.persona
                        ? <>
                            <span className="block text-sm font-medium text-navy font-body">{c.persona}</span>
                            <span className="block text-[13px] text-navy-light/80 font-body">{c.destinatario}</span>
                          </>
                        : <span className="text-sm text-navy font-body">{c.destinatario}</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body max-w-md truncate" title={c.asunto}>
                      {c.asunto || '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">
                      {c.fecha ? formatDateTime(c.fecha) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={`${AYUDA_ESTADO[c.estado]}${c.error ? ` · ${c.error}` : ''}`}
                        className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display whitespace-nowrap', BADGE_ESTADO[c.estado])}
                      >
                        {ETIQUETA_ESTADO[c.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!cargando && datos.total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-navy-light/80 font-body">
            {desde}–{hasta} de {datos.total.toLocaleString('es-CR')}
            {conProblema > 0 && <span className="text-coral"> · {conProblema} con problema en esta página</span>}
          </p>
          {paginas > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPagina(p => Math.max(1, p - 1)); setCargando(true) }}
                disabled={pagina === 1}
                aria-label="Página anterior"
                className="h-8 w-8 rounded-full border border-[var(--outline-variant)] text-navy-light inline-flex items-center justify-center hover:bg-surface-low transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[13px] text-navy-light/80 font-body">{pagina} / {paginas}</span>
              <button
                onClick={() => { setPagina(p => Math.min(paginas, p + 1)); setCargando(true) }}
                disabled={pagina === paginas}
                aria-label="Página siguiente"
                className="h-8 w-8 rounded-full border border-[var(--outline-variant)] text-navy-light inline-flex items-center justify-center hover:bg-surface-low transition-colors disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
