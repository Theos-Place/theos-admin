'use client'

import { useMemo, useState } from 'react'
import { Users, Check, X, Info } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { usePermissions } from '@/hooks/usePermissions'
import { useAccesoAReporte } from '@/hooks/useAccesoAReporte'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { leFaltaAlgo, faltantes } from '@/lib/servers/compromisos'
import { textoDeEstudio, type EstudioDeLaPersona } from '@/lib/studies/estudio-actual'
import { VolverAReportes } from '@/components/reportes/VolverAReportes'
import {
  cumplimiento, desglose, hayGenteCompartida, type ServidorDelReporte,
} from '@/lib/reports/servidores-compromisos'
import { ResumenDeCompromisos } from '@/components/servers/ResumenDeCompromisos'

type Servidor = ServidorDelReporte & {
  puestos: string[]
  estudio: EstudioDeLaPersona
}
type Respuesta = {
  alcance: 'global' | 'area' | 'comite'
  comites: Array<{ id: string; name: string; parent_id: string | null }>
  areas: Array<{ id: string; name: string }>
  servidores: Servidor[]
}

/** Las columnas dependen de los nombres de los comités, que llegan con los
 *  datos: la fila trae ids y en pantalla hay que ver el nombre. */
const columnas = (nombreDeComite: (id: string) => string): ColumnDef<Servidor>[] => [
  { key: 'nombre', label: 'Nombre', defaultVisible: true },
  { key: 'puestos', label: 'Puesto(s)', defaultVisible: true, exportValue: s => s.puestos.join(' · ') },
  { key: 'comites', label: 'Comité(s)', defaultVisible: true, exportValue: s => s.comites.map(nombreDeComite).join(' · ') },
  { key: 'asistencia', label: 'Asistencia', defaultVisible: true, exportValue: s => (s.asistencia ? 'Cumple' : 'No cumple') },
  { key: 'estudio', label: 'Estudio', defaultVisible: true, exportValue: s => textoDeEstudio(s.estudio) || 'Ninguno' },
  { key: 'donante', label: 'Donante activo', defaultVisible: true, exportValue: s => (s.donante ? 'Sí' : 'No') },
  { key: 'ultimo', label: 'Último check-in', defaultVisible: true, exportValue: s => s.ultimoCheckin ?? '' },
  { key: 'falta', label: 'Le falta', defaultVisible: true, exportValue: s => faltantes(s).join(', ') },
]

function Barra({ pct }: { pct: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-navy-light/15 overflow-hidden">
        <div className="h-full rounded-full bg-coral" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span className="text-[13px] text-navy-light/80 tabular-nums font-body w-9">{pct === null ? '—' : `${pct}%`}</span>
    </div>
  )
}

export default function ReporteServidoresPage() {
  const { loaded } = usePermissions()
  // REP-11 · La regla sale de ACCESO_POR_REPORTE, igual que el endpoint.
  const { puedeVer } = useAccesoAReporte('servidores')

  const [area, setArea] = useState('')
  const [comite, setComite] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)

  const qs = comite ? `?comite=${comite}` : area ? `?area=${area}` : ''
  const { datos, cargando, error } = useCargaRemota<Respuesta>(
    loaded && puedeVer ? `servidores:${qs}` : '',
    async () => {
      const r = await fetch(`/api/reports/servidores${qs}`)
      if (!r.ok) throw new Error('No se pudo cargar el reporte.')
      return r.json()
    },
  )

  const servidores = useMemo(() => datos?.servidores ?? [], [datos])
  // Los cinco KPIs los calcula <ResumenDeCompromisos/>; estos dos quedan acá
  // porque los usa el resto de la pantalla (el pie del detalle y la nota de
  // gente compartida bajo el desglose).
  const total = useMemo(() => cumplimiento(servidores), [servidores])
  const compartida = useMemo(() => hayGenteCompartida(servidores), [servidores])
  const nombreDeComite = useMemo(() => {
    const m = new Map((datos?.comites ?? []).map(c => [c.id, c.name]))
    return (id: string) => m.get(id) ?? '—'
  }, [datos])
  const COLUMNAS = useMemo(() => columnas(nombreDeComite), [nombreDeComite])

  // En global el desglose es por ÁREA; dentro de un área, por comité.
  const filas = useMemo(() => {
    if (!datos) return []
    const porArea = new Map(datos.comites.map(c => [c.id, c.parent_id ?? '']))
    if (!area && !comite) {
      return desglose(servidores, datos.areas.map(a => ({ id: a.id, nombre: a.name })),
        (s, aId) => s.comites.some(c => porArea.get(c) === aId))
    }
    return desglose(servidores, datos.comites.map(c => ({ id: c.id, nombre: c.name })),
      (s, cId) => s.comites.includes(cId))
  }, [datos, servidores, area, comite])

  const detalle = useMemo(() => {
    const unicos = new Map<string, Servidor>()
    for (const s of servidores) if (!unicos.has(s.member_id)) unicos.set(s.member_id, s)
    const todos = [...unicos.values()]
    return soloPendientes ? todos.filter(leFaltaAlgo) : todos
  }, [servidores, soloPendientes])

  if (!loaded) return null
  if (!puedeVer) {
    return <EmptyState icon={Users} title="Acceso restringido" description="Este reporte es para staff, coordinación de servidores y dirección." />
  }

  const nombreDelAlcance = comite
    ? datos?.comites.find(c => c.id === comite)?.name ?? ''
    : area
      ? datos?.areas.find(a => a.id === area)?.name ?? ''
      : 'Toda la organización'

  return (
    <div className="space-y-4">
      <div>
        <VolverAReportes />
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Servidores y compromisos</h1>
        <p className="text-[13px] text-navy-light/80 font-body mt-1">
          Lo mismo que ve cada encargado en “Mi comité”, pero de toda la organización.
          Las reglas son las mismas: si un comité diera números distintos en los dos lados, es un error.
        </p>
      </div>

      {/* ── Alcance ── */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filtrar por área"
          value={area}
          onChange={e => { setArea(e.target.value); setComite('') }}
          className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        >
          <option value="">Toda la organización</option>
          {datos?.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          aria-label="Filtrar por comité"
          value={comite}
          onChange={e => setComite(e.target.value)}
          className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        >
          <option value="">Todos los comités{area ? ' del área' : ''}</option>
          {datos?.comites.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(area || comite) && (
          <button
            type="button"
            onClick={() => { setArea(''); setComite('') }}
            className="text-[13px] text-coral hover:underline font-body bg-transparent border-0 cursor-pointer"
          >
            Ver todo
          </button>
        )}
      </div>

      {error && <div className="card p-4 text-[13px] text-coral-deep font-body" role="alert">{error}</div>}
      {cargando && <p className="py-8 text-center text-sm text-navy-light/80 font-body">Cargando…</p>}

      {!cargando && datos && (
        <>
          {/* SRV-16 · El MISMO componente que usa "Mi comité". Ver
              ResumenDeCompromisos: dos copias de estos cinco números duran
              hasta que alguien toque una sola. */}
          <ResumenDeCompromisos servidores={servidores} nombreDelAlcance={nombreDelAlcance} />

          {/* ── Desglose ── */}
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3">
            <div>
              <h2 className="text-base font-bold text-navy font-display">
                {area || comite ? 'Por comité' : 'Por área'}
              </h2>
              <p className="text-[13px] text-navy-light/80 font-body">
                Primero el que va más flojo. El reporte existe para encontrar dónde ayudar.
              </p>
            </div>
            {filas.length === 0 ? (
              <EmptyState icon={Users} title="Sin servidores en este alcance" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['', 'Servidores', 'Cumplen todo', 'Asistencia', 'Estudio', 'Donantes'].map((h, i) => (
                        <th key={h || i} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={f.id} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                        <td className="px-3 py-2 text-[13px] text-navy font-body">
                          <button
                            type="button"
                            onClick={() => (area || comite ? setComite(f.id) : setArea(f.id))}
                            className="text-left hover:text-coral hover:underline bg-transparent border-0 cursor-pointer font-body"
                          >
                            {f.nombre}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{f.cumplimiento.total}</td>
                        <td className="px-3 py-2"><Barra pct={f.porcentajes.todo} /></td>
                        <td className="px-3 py-2"><Barra pct={f.porcentajes.asistencia} /></td>
                        <td className="px-3 py-2"><Barra pct={f.porcentajes.estudio} /></td>
                        <td className="px-3 py-2"><Barra pct={f.porcentajes.donante} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {compartida && (
              <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                Las filas suman más que el total porque hay gente que sirve en más de un comité: cuenta en cada uno, y una sola vez arriba.
              </p>
            )}
          </div>

          {/* ── Detalle ── */}
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-navy font-display">Las personas</h2>
                <p className="text-[13px] text-navy-light/80 font-body">
                  {detalle.length.toLocaleString('es-CR')} de {total.total.toLocaleString('es-CR')} · {nombreDelAlcance}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-[13px] text-navy-light font-body">
                  <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} className="accent-coral" />
                  Solo los que tienen algo pendiente
                </label>
                {detalle.length > 0 && (
                  <ExportButton<Servidor>
                    data={detalle} columns={COLUMNAS} allColumns={COLUMNAS}
                    filename={`servidores-compromisos-${nombreDelAlcance.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                )}
              </div>
            </div>

            {detalle.length === 0 ? (
              <EmptyState icon={Users} title={soloPendientes ? 'Nadie tiene pendientes' : 'Sin servidores'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Persona', 'Puesto', 'Comité', 'Asistencia', 'Estudio', 'Donante', 'Último check-in'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((s, i) => (
                      <tr key={s.member_id} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                        <td className="px-3 py-2 text-[13px] text-navy font-body whitespace-nowrap">{s.nombre}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">{s.puestos.join(' · ')}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">
                          {s.comites.map(nombreDeComite).join(' · ')}
                        </td>
                        <td className="px-3 py-2">
                          {s.asistencia
                            ? <Check size={15} strokeWidth={2.5} className="text-teal-deep" aria-label="Asistencia: cumple" />
                            : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label="Asistencia: no cumple" />}
                        </td>
                        <td className="px-3 py-2 text-[13px] font-body">
                          {s.llevandoEstudio || s.dandoEstudio
                            ? <span className="text-navy">{textoDeEstudio(s.estudio)}</span>
                            : s.estudio.ultimo
                              ? <span className="text-navy-light/80">{textoDeEstudio(s.estudio)}</span>
                              : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label="Estudio: nunca ha llevado ninguno" />}
                        </td>
                        <td className="px-3 py-2">
                          {s.donante
                            ? <Check size={15} strokeWidth={2.5} className="text-teal-deep" aria-label="Donante activo" />
                            : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label="No es donante activo" />}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                          {s.ultimoCheckin ? formatDate(s.ultimoCheckin) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
