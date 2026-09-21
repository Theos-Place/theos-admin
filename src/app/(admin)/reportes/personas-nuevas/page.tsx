'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { UserPlus, PhoneOff } from 'lucide-react'
import { ChartCard } from '@/components/reportes/ChartCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { calcAge, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  resumenDeNuevos, filtrarNuevos, serieMensual, serieAnual,
  ETIQUETA_DE_CANAL, type PersonaNueva, type Canal, type FiltrosDeNuevos,
} from '@/lib/reports/personas-nuevas'
import {
  CORAL, CORAL_ATENUADO, NAVY, EJE_TICK, REJILLA, CURSOR_BARRA, ESTILO_TOOLTIP,
} from '@/lib/reports/paleta'

type FilaSerie = { anio: number; mes: number; canal: string; n: number }

function Kpi({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">{titulo}</p>
      <p className="text-2xl font-extrabold text-navy font-display tabular-nums mt-0.5">{valor}</p>
      {pie && <p className="text-[13px] text-navy-light/80 font-body">{pie}</p>}
    </div>
  )
}

const COLUMNAS = (conTelefono: boolean): ColumnDef<PersonaNueva>[] => {
  const base: ColumnDef<PersonaNueva>[] = [
    { key: 'nombre', label: 'Nombre', defaultVisible: true },
    { key: 'edad', label: 'Edad', defaultVisible: true, exportValue: p => (p.birth_date ? String(calcAge(p.birth_date)) : '') },
    { key: 'fecha', label: 'Primera actividad', defaultVisible: true, exportValue: p => p.fecha },
    { key: 'canal', label: 'Entró por', defaultVisible: true, exportValue: p => ETIQUETA_DE_CANAL[p.canal] },
    { key: 'origen', label: 'Dónde', defaultVisible: true },
    { key: 'volvio', label: 'Volvió (8 semanas)', defaultVisible: true, exportValue: p => (p.volvio ? 'Sí' : 'No') },
    { key: 'seMatriculo', label: 'Se matriculó', defaultVisible: true, exportValue: p => (p.seMatriculo ? 'Sí' : 'No') },
    { key: 'esServidor', label: 'Servidor', defaultVisible: true, exportValue: p => (p.esServidor ? 'Sí' : 'No') },
  ]
  if (conTelefono) base.push({ key: 'phone', label: 'Teléfono / WhatsApp', defaultVisible: true, exportValue: p => p.phone ?? '' })
  return base
}

const HOY = new Date()
const MES_ACTUAL = `${HOY.getUTCFullYear()}-${String(HOY.getUTCMonth() + 1).padStart(2, '0')}`

export default function PersonasNuevasPage() {
  const [mes, setMes] = useState(MES_ACTUAL)
  const [filtros, setFiltros] = useState<FiltrosDeNuevos>({ canal: '', servidor: null })

  const serie = useCargaRemota<{ serie: FilaSerie[] }>(
    'personas-nuevas-serie',
    async () => {
      const r = await fetch('/api/reports/personas-nuevas')
      if (!r.ok) throw new Error('No se pudo cargar la serie.')
      return r.json()
    },
  )
  const detalle = useCargaRemota<{ mes: string; puedeVerContacto: boolean; personas: PersonaNueva[] }>(
    `personas-nuevas:${mes}`,
    async () => {
      const r = await fetch(`/api/reports/personas-nuevas?mes=${mes}`)
      if (!r.ok) throw new Error('No se pudo cargar el detalle del mes.')
      return r.json()
    },
  )

  const filas = useMemo(() => serie.datos?.serie ?? [], [serie.datos])
  const mensual = useMemo(() => serieMensual(filas, HOY, 24), [filas])
  const anual = useMemo(() => serieAnual(filas), [filas])

  const personas = useMemo(() => detalle.datos?.personas ?? [], [detalle.datos])
  const visibles = useMemo(() => filtrarNuevos(personas, filtros), [personas, filtros])
  const resumen = useMemo(() => resumenDeNuevos(visibles), [visibles])
  const cols = useMemo(() => COLUMNAS(detalle.datos?.puedeVerContacto ?? false), [detalle.datos?.puedeVerContacto])

  const origenes = useMemo(
    () => [...new Set(personas.map(p => p.origen).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [personas],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Personas nuevas</h1>
        <p className="text-[13px] text-navy-light/80 font-body mt-1">
          Alguien es nuevo cuando registra su <strong className="text-navy">primera actividad</strong>: la primera charla,
          la primera matrícula o la primera inscripción a un evento — lo que haya pasado antes.{' '}
          No es la fecha en que se creó la ficha: hay 9.181 fichas sin ninguna actividad, en su mayoría de la carga de CCB,
          y una ficha no es una persona que llegó.
        </p>
      </div>

      {/* ── KPIs del mes y filtro activos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi titulo="Nuevos" valor={resumen.total.toLocaleString('es-CR')} pie={mes} />
        <Kpi
          titulo="Edad promedio"
          valor={resumen.edadPromedio === null ? '—' : String(resumen.edadPromedio)}
          pie={resumen.sinEdad > 0 ? `${resumen.sinEdad} sin fecha de nacimiento` : undefined}
        />
        <Kpi titulo="Edad mediana" valor={resumen.edadMediana === null ? '—' : String(resumen.edadMediana)} />
        <Kpi
          titulo="Volvieron"
          valor={resumen.pctVolvieron === null ? '—' : `${resumen.pctVolvieron}%`}
          pie={`${resumen.volvieron} en las 8 semanas siguientes`}
        />
        <Kpi
          titulo="Ya sirven"
          valor={resumen.servidores.toLocaleString('es-CR')}
          pie={resumen.pctSeMatricularon !== null ? `${resumen.seMatricularon} se matricularon` : undefined}
        />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Personas nuevas por mes"
          subtitle="Últimos 24 meses. Tocá una barra para ver ese mes abajo."
          empty={!filas.length}
        >
          <ResponsiveContainer>
            <BarChart data={mensual} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
              <XAxis dataKey="etiqueta" tick={EJE_TICK} interval="preserveStartEnd" />
              <YAxis tick={EJE_TICK} allowDecimals={false} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={CURSOR_BARRA} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} />
              <Bar dataKey="n" name="Nuevos" radius={[4, 4, 0, 0]} onClick={(d: { payload?: { periodo: string } }) => d.payload && setMes(d.payload.periodo)}>
                {mensual.map(p => (
                  <Cell key={p.periodo} fill={p.periodo === mes ? CORAL : CORAL_ATENUADO} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por año" subtitle="Desde 2020, la vista larga." empty={!anual.length}>
          <ResponsiveContainer>
            <BarChart data={anual} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
              <XAxis dataKey="etiqueta" tick={EJE_TICK} />
              <YAxis tick={EJE_TICK} allowDecimals={false} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={CURSOR_BARRA} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} />
              <Bar dataKey="n" name="Nuevos" fill={NAVY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Detalle del mes ── */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-navy font-display">Quiénes llegaron en {mes}</h2>
            <p className="text-[13px] text-navy-light/80 font-body">
              {resumen.total.toLocaleString('es-CR')} de {personas.length.toLocaleString('es-CR')} con los filtros puestos ·{' '}
              {resumen.porCanal.map(c => `${ETIQUETA_DE_CANAL[c.canal]}: ${c.n}`).join(' · ') || 'sin nadie'}
            </p>
          </div>
          {visibles.length > 0 && (
            <ExportButton<PersonaNueva>
              data={visibles} columns={cols} allColumns={cols}
              filename={`personas-nuevas-${mes}`}
            />
          )}
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por dónde entró"
            value={filtros.origen ?? ''}
            onChange={e => setFiltros(f => ({ ...f, origen: e.target.value }))}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
          >
            <option value="">Todas las charlas y estudios</option>
            {origenes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            aria-label="Filtrar por canal de entrada"
            value={filtros.canal ?? ''}
            onChange={e => setFiltros(f => ({ ...f, canal: e.target.value as Canal | '' }))}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
          >
            <option value="">Entró por cualquier lado</option>
            <option value="charla">Charla</option>
            <option value="estudio">Estudio</option>
            <option value="evento">Evento</option>
          </select>
          <select
            aria-label="Filtrar por si ya sirve"
            value={filtros.servidor === null || filtros.servidor === undefined ? '' : filtros.servidor ? 'si' : 'no'}
            onChange={e => setFiltros(f => ({ ...f, servidor: e.target.value === '' ? null : e.target.value === 'si' }))}
            className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
          >
            <option value="">Sirvan o no</option>
            <option value="si">Solo los que sirven</option>
            <option value="no">Solo los que no sirven</option>
          </select>
          <input
            type="number" min={0} max={120} placeholder="Edad desde"
            aria-label="Edad mínima"
            value={filtros.edadMin ?? ''}
            onChange={e => setFiltros(f => ({ ...f, edadMin: e.target.value === '' ? null : Number(e.target.value) }))}
            className="w-28 rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
          />
          <input
            type="number" min={0} max={120} placeholder="Edad hasta"
            aria-label="Edad máxima"
            value={filtros.edadMax ?? ''}
            onChange={e => setFiltros(f => ({ ...f, edadMax: e.target.value === '' ? null : Number(e.target.value) }))}
            className="w-28 rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
          />
        </div>

        {(filtros.edadMin != null || filtros.edadMax != null) && resumen.sinEdad === 0 && personas.some(p => !p.birth_date) && (
          <p className="text-[13px] text-navy-light/80 font-body">
            Con un filtro de edad quedan fuera quienes no tienen fecha de nacimiento: no se puede afirmar su edad.
          </p>
        )}

        {detalle.datos && !detalle.datos.puedeVerContacto && (
          <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
            <PhoneOff size={13} className="mt-0.5 shrink-0" aria-hidden />
            Tu rol ve el reporte pero no el directorio, así que la descarga va sin teléfonos.
          </p>
        )}

        {detalle.cargando ? (
          <p className="py-8 text-center text-sm text-navy-light/80 font-body">Cargando el mes…</p>
        ) : detalle.error ? (
          <p className="text-[13px] text-coral-deep font-body py-4" role="alert">{detalle.error}</p>
        ) : visibles.length === 0 ? (
          <EmptyState icon={UserPlus} title="Nadie nuevo con esos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {cols.map(c => (
                    <th key={String(c.key)} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((p, i) => (
                  <tr key={p.member_id} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-3 py-2 text-[13px] text-navy font-body whitespace-nowrap">{p.nombre}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body tabular-nums">
                      {p.birth_date ? calcAge(p.birth_date) : '—'}
                    </td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{formatDate(p.fecha)}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">{ETIQUETA_DE_CANAL[p.canal]}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">{p.origen}</td>
                    <td className="px-3 py-2 text-[13px] font-body">
                      {p.volvio ? <span className="text-teal-deep">Sí</span> : <span className="text-navy-light/80">No</span>}
                    </td>
                    <td className="px-3 py-2 text-[13px] font-body">
                      {p.seMatriculo ? <span className="text-teal-deep">Sí</span> : <span className="text-navy-light/80">No</span>}
                    </td>
                    <td className="px-3 py-2 text-[13px] font-body">
                      {p.esServidor ? <span className="text-teal-deep">Sí</span> : <span className="text-navy-light/80">No</span>}
                    </td>
                    {detalle.datos?.puedeVerContacto && (
                      <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{p.phone ?? '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
