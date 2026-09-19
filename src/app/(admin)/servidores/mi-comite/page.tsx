'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, Star, Check, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { leFaltaAlgo, faltantes, etiquetaDeEstudio, type Compromisos } from '@/lib/servers/compromisos'

type Fila = Compromisos & {
  member_id: string
  nombre: string
  puestos: string[]
  encargado: boolean
}
type Comite = { id: string; nombre: string; filas: Fila[] }

/** Columnas del export. La pantalla los pinta con íconos; el archivo va en
 *  palabras — un ✓ en una celda de Excel no se puede filtrar ni contar. */
const COLUMNAS: ColumnDef<Fila>[] = [
  { key: 'nombre',    label: 'Nombre',        defaultVisible: true },
  { key: 'puestos',   label: 'Puesto(s)',     defaultVisible: true, exportValue: f => f.puestos.join(' · ') },
  { key: 'encargado', label: 'Encargado',     defaultVisible: true, exportValue: f => (f.encargado ? 'Sí' : '') },
  { key: 'asistencia',label: 'Asistencia',    defaultVisible: true, exportValue: f => (f.asistencia ? 'Cumple' : 'No cumple') },
  { key: 'estudio',   label: 'Estudio',       defaultVisible: true, exportValue: f => etiquetaDeEstudio(f) || 'Ninguno' },
  { key: 'donante',   label: 'Donante activo',defaultVisible: true, exportValue: f => (f.donante ? 'Sí' : 'No') },
  { key: 'ultimo',    label: 'Último check-in', defaultVisible: true, exportValue: f => f.ultimoCheckin ?? '' },
  { key: 'falta',     label: 'Le falta',      defaultVisible: true, exportValue: f => faltantes(f).join(', ') },
]

function Marca({ ok, titulo }: { ok: boolean; titulo: string }) {
  return ok
    ? <Check size={15} strokeWidth={2.5} className="text-teal-deep" aria-label={`${titulo}: cumple`} />
    : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label={`${titulo}: no cumple`} />
}

export default function MiComitePage() {
  const { loaded } = usePermissions()
  const { user } = useAuth()
  const esLider = (user?.roles ?? []).includes('lider_comite') || (user?.roles ?? []).includes('admin')

  const [comites, setComites] = useState<Comite[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [soloPendientes, setSoloPendientes] = useState(false)

  useEffect(() => {
    if (!loaded || !esLider) return
    let vivo = true
    fetch('/api/servers/mi-comite')
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => null) as { error?: string } | null
          throw new Error(d?.error ?? 'No se pudo cargar tu comité.')
        }
        return r.json()
      })
      .then((d: { comites: Comite[] }) => { if (vivo) setComites(d.comites ?? []) })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error desconocido') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [loaded, esLider])

  const visibles = useMemo(
    () => comites.map(c => ({ ...c, filas: soloPendientes ? c.filas.filter(leFaltaAlgo) : c.filas })),
    [comites, soloPendientes],
  )

  // Hasta que carguen los roles no se sabe si tiene permiso: pintar "Acceso
  // restringido" antes deja un parpadeo rojo en cada carga (ver usePermissions).
  if (!loaded) return null
  if (!esLider) {
    return <EmptyState icon={Users} title="Acceso restringido" description="Esta pantalla es para los encargados de comité." />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="ptitle">Mi comité</h1>
        <p className="psub">Tu gente y cómo va cada quien con sus compromisos.</p>
      </div>

      {error && (
        <div className="card p-4 text-[13px] text-coral-deep font-body">{error}</div>
      )}

      {!error && !cargando && comites.length === 0 && (
        <EmptyState
          icon={Users}
          title="Todavía no sos encargada de ningún comité"
          description="La estrella de encargado la ponen staff o dirección en la lista de personas del comité."
        />
      )}

      {comites.length > 0 && (
        <label className="flex items-center gap-2 text-[13px] text-navy-light font-body">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={e => setSoloPendientes(e.target.checked)}
            className="accent-coral"
          />
          Solo los que tienen algo pendiente
        </label>
      )}

      {visibles.map(c => (
        <div key={c.id} className="card w-full min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-[var(--outline-variant)]">
            <div>
              <p className="text-base font-bold text-navy font-display">{c.nombre}</p>
              <p className="text-[13px] text-navy-light/80 font-body">
                {c.filas.length.toLocaleString('es-CR')} {c.filas.length === 1 ? 'persona' : 'personas'}
                {soloPendientes ? ' con algo pendiente' : ''}
              </p>
            </div>
            <ExportButton<Fila>
              data={c.filas}
              columns={COLUMNAS}
              allColumns={COLUMNAS}
              filename={`mi-comite-${c.nombre.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </div>

          {c.filas.length === 0 ? (
            <EmptyState icon={Users} title={soloPendientes ? 'Nadie tiene pendientes' : 'El comité no tiene gente activa'} />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Persona', 'Puesto', 'Asistencia', 'Estudio', 'Donante', 'Último check-in'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.filas.map((f, i) => (
                      <tr key={f.member_id} className={cn('transition-colors', i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-navy font-body">
                            {f.nombre}
                            {f.encargado && <Star size={12} className="text-coral shrink-0" fill="currentColor" aria-label="Encargado del comité" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{f.puestos.join(' · ')}</td>
                        <td className="px-4 py-3"><Marca ok={f.asistencia} titulo="Asistencia" /></td>
                        <td className="px-4 py-3 text-[13px] font-body">
                          {etiquetaDeEstudio(f)
                            ? <span className="rounded-full bg-teal-deep/10 px-2 py-0.5 text-[11px] text-teal-deep font-semibold">{etiquetaDeEstudio(f)}</span>
                            : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label="Estudio: ninguno en el último año" />}
                        </td>
                        <td className="px-4 py-3"><Marca ok={f.donante} titulo="Donante activo" /></td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                          {f.ultimoCheckin ? formatDate(f.ultimoCheckin) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <ul className="md:hidden">
                {c.filas.map((f, i) => (
                  <li key={f.member_id} className="px-4 py-3" style={i < c.filas.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-navy font-body">
                      {f.nombre}
                      {f.encargado && <Star size={12} className="text-coral shrink-0" fill="currentColor" aria-label="Encargado del comité" />}
                    </p>
                    <p className="text-[13px] text-navy-light/80 font-body">{f.puestos.join(' · ')}</p>
                    <p className="mt-1 text-[13px] font-body">
                      {faltantes(f).length
                        ? <span className="text-coral-deep">Le falta {faltantes(f).join(', ')}</span>
                        : <span className="text-teal-deep">Al día</span>}
                      <span className="text-navy-light/80">
                        {' · último check-in '}{f.ultimoCheckin ? formatDate(f.ultimoCheckin) : '—'}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}

      <p className="text-[13px] text-navy-light/80 font-body">
        ¿Alguien no debería estar en la lista? Eso se cambia en{' '}
        <Link href="/servidores" className="text-coral hover:underline">Servidores</Link>.
      </p>
    </div>
  )
}
