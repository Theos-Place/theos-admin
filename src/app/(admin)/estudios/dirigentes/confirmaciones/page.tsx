'use client'

/**
 * SRV-9 · A quién hay que volver a buscar.
 *
 * Las campañas de actualización son tres veces al año (marzo, julio,
 * noviembre) y lo primero que necesita el comité es esa lista. Hasta hoy no se
 * podía preguntar: la disponibilidad vivía en hojas sueltas de Linktree y no
 * había fecha de confirmación.
 *
 * EL FILTRO POR DEFECTO ES «PENDIENTES» y no «todos». Esta pantalla se abre
 * para actuar, y abrirla en 505 filas ordenadas alfabéticamente obliga a
 * filtrar antes de poder hacer nada.
 *
 * NO CONFUNDIR con /estudios/dirigentes/disponibilidad (DIR-1), que muestra
 * respuestas de FORMULARIO y es solo insumo. Esto es el dato en firme.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Download, Loader2, Home, UserCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  estadoDeConfirmacion, CONFIRMACION_LABEL, etiquetaDeSlot, textoDelRango,
  MESES_DE_VIGENCIA_DE_LA_CONFIRMACION, type EstadoDeConfirmacion,
} from '@/lib/studies/disponibilidad-de-dirigente'

const VIEW_ROLES = ['coordinador_dirigentes', 'coordinador_estudios', 'direccion', 'admin'] as const

type Fila = {
  member_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  is_active: boolean
  formacion: string[]
  disponible: string[]
  interesado: string[]
  slots: string[]
  presta_casa: boolean
  suplente: boolean
  desde: string | null
  hasta: string | null
  confirmado_at: string | null
}

const FILTROS: Array<{ key: 'pendientes' | EstadoDeConfirmacion | 'todos'; label: string }> = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'nunca', label: 'Nunca confirmaron' },
  { key: 'vencida', label: 'Desactualizados' },
  { key: 'vigente', label: 'Al día' },
  { key: 'todos', label: 'Todos' },
]

const BADGE: Record<EstadoDeConfirmacion, string> = {
  nunca: 'bg-surface-low text-navy-light/80',
  vencida: 'bg-coral/10 text-coral-deep',
  vigente: 'bg-success/12 text-success',
}

export default function ConfirmacionesPage() {
  const { user, loaded, hasRole } = useAuth()
  useTituloDePantalla('Confirmaciones de disponibilidad', 'Dirigentes')
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [filtro, setFiltro] = useState<typeof FILTROS[number]['key']>('pendientes')
  const permitido = hasRole(...VIEW_ROLES)

  useEffect(() => {
    if (!permitido) return
    let vivo = true
    fetch('/api/studies/dirigentes/disponibilidad-actual')
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => { if (vivo) setFilas((d.items ?? []) as Fila[]) })
      .catch(() => { if (vivo) setFilas([]) })
    return () => { vivo = false }
  }, [permitido])

  const ahora = useMemo(() => new Date(), [])
  const conEstado = useMemo(
    () => (filas ?? []).map(f => ({ ...f, estado: estadoDeConfirmacion(f.confirmado_at, ahora) })),
    [filas, ahora],
  )
  const conteos = useMemo(() => ({
    nunca: conEstado.filter(f => f.estado === 'nunca').length,
    vencida: conEstado.filter(f => f.estado === 'vencida').length,
    vigente: conEstado.filter(f => f.estado === 'vigente').length,
  }), [conEstado])

  const visibles = useMemo(() => {
    const base = filtro === 'todos' ? conEstado
      : filtro === 'pendientes' ? conEstado.filter(f => f.estado !== 'vigente')
      : conEstado.filter(f => f.estado === filtro)
    // Los pendientes arriba, y dentro de cada grupo por nombre: la pantalla se
    // abre para actuar, no para leer en orden alfabético.
    const peso: Record<EstadoDeConfirmacion, number> = { nunca: 0, vencida: 1, vigente: 2 }
    return [...base].sort((a, b) =>
      peso[a.estado] !== peso[b.estado]
        ? peso[a.estado] - peso[b.estado]
        : a.nombre.localeCompare(b.nombre, 'es'))
  }, [conEstado, filtro])

  if (!loaded) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (user && !permitido) return <AccessDenied />

  return (
    <div className="space-y-5">
      <Link href="/estudios/dirigentes" className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Dirigentes
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy font-display">Confirmaciones de disponibilidad</h1>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            Quién revisó sus datos y quién no. Se considera desactualizado a los{' '}
            {MESES_DE_VIGENCIA_DE_LA_CONFIRMACION} meses: la campaña es cada cuatro, más
            uno de gracia.
          </p>
        </div>
        {/* El Excel se baja por el mismo endpoint que pinta la tabla: con dos,
            el día que se agregue una columna una de las dos se queda atrás. */}
        <Button
          href="/api/studies/dirigentes/disponibilidad-actual?formato=xlsx"
          variante="navy"
          className="inline-flex items-center gap-1.5 shrink-0"
        >
          <Download size={14} aria-hidden="true" /> Descargar Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(f => {
          const n = f.key === 'todos' ? conEstado.length
            : f.key === 'pendientes' ? conteos.nunca + conteos.vencida
            : conteos[f.key]
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              aria-pressed={filtro === f.key}
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] font-body border transition-all',
                filtro === f.key ? 'bg-navy text-white border-navy' : 'bg-transparent text-navy/80 border-outline hover:text-navy',
              )}
            >
              {f.label} {filas ? `(${n})` : ''}
            </button>
          )
        })}
      </div>

      {filas === null ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-navy-light/80" /></div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-card">
          <EmptyState
            title={filtro === 'pendientes' ? 'Nadie quedó pendiente' : 'No hay dirigentes con ese filtro'}
            description={filtro === 'pendientes'
              ? 'Todos confirmaron sus datos dentro de la ventana.'
              : 'Probá con otro filtro.'}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                {['Dirigente', 'Confirmación', 'Quiere dar', 'Cuándo puede', 'Ventana', 'Extras'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(f => (
                <tr key={f.member_id} className="border-b border-[var(--outline-variant)] last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/estudios/dirigentes/${f.member_id}`} className="text-navy font-medium hover:text-coral transition-colors">
                      {f.nombre}
                    </Link>
                    <div className="text-[13px] text-navy-light/80">
                      {f.is_active ? 'Activo' : 'Inactivo'}{f.correo ? ` · ${f.correo}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[13px]', BADGE[f.estado])}>
                      {CONFIRMACION_LABEL[f.estado]}
                    </span>
                    {f.confirmado_at && (
                      <div className="text-[13px] text-navy-light/80 mt-0.5">{formatDate(f.confirmado_at)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 max-w-56">
                    {f.disponible.length > 0 ? f.disponible.join(', ') : '—'}
                    {f.interesado.length > 0 && (
                      // «Interesado» va marcado como tal: si se leyera junto a
                      // «quiere dar», alguien terminaría asignado a un estudio
                      // para el que todavía no está capacitado.
                      <div className="mt-0.5">Quiere aprender: {f.interesado.join(', ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 max-w-56">
                    {f.slots.length > 0 ? f.slots.map(etiquetaDeSlot).join(' · ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80">
                    {textoDelRango(f.desde, f.hasta)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-navy-light/80">
                    <span className="inline-flex flex-wrap gap-2">
                      {f.presta_casa && <span className="inline-flex items-center gap-1"><Home size={12} aria-hidden="true" /> Casa</span>}
                      {f.suplente && <span className="inline-flex items-center gap-1"><UserCheck size={12} aria-hidden="true" /> Suplente</span>}
                      {!f.presta_casa && !f.suplente && '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
