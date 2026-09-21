'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { BookOpen, Info } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { VolverAReportes } from '@/components/reportes/VolverAReportes'
import { ChartCard } from '@/components/reportes/ChartCard'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { ESTUDIOS_REPORTE_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import {
  resumirEstudios, porPlan, serieDeEstudios, aniosConEstudios,
  bloquesDisponibles, filtrarPorBloque,
  type FilaDeEstudios, type FilaPorPlan,
} from '@/lib/reports/estudios'
import {
  CORAL, CORAL_ATENUADO, EJE_TICK, REJILLA, CURSOR_BARRA, ESTILO_TOOLTIP, ETIQUETA_VALOR,
} from '@/lib/reports/paleta'

type FilaSerie = { anio: number; plan_code: string; plan_nombre: string; estudiantes: number }
type Respuesta = { anio: number; filas: FilaDeEstudios[]; serie: FilaSerie[]; nuevasPorEstudio: number }

const COLUMNAS: ColumnDef<FilaPorPlan>[] = [
  { key: 'nombre', label: 'Estudio', defaultVisible: true },
  { key: 'grupos', label: 'Grupos', defaultVisible: true, exportValue: p => String(p.grupos) },
  { key: 'estudiantes', label: 'Estudiantes', defaultVisible: true, exportValue: p => String(p.estudiantes) },
  { key: 'dirigentes', label: 'Dirigentes', defaultVisible: true, exportValue: p => String(p.dirigentes) },
  { key: 'pctFinalizo', label: '% que finalizó', defaultVisible: true, exportValue: p => (p.pctFinalizo === null ? '' : `${p.pctFinalizo}%`) },
  { key: 'edadPromedio', label: 'Edad promedio', defaultVisible: true, exportValue: p => (p.edadPromedio === null ? '' : String(p.edadPromedio)) },
  { key: 'sinEdad', label: 'Sin fecha de nacimiento', defaultVisible: true, exportValue: p => String(p.sinEdad) },
  { key: 'mujeres', label: 'Mujeres', defaultVisible: true, exportValue: p => String(p.mujeres) },
  { key: 'hombres', label: 'Hombres', defaultVisible: true, exportValue: p => String(p.hombres) },
  { key: 'sinGenero', label: 'Sin dato de género', defaultVisible: true, exportValue: p => String(p.sinGenero) },
]

function Kpi({ titulo, valor, pie, info }: { titulo: string; valor: string; pie?: string; info?: string }) {
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
        {titulo}{info && <InfoDelEncabezado texto={info} />}
      </p>
      <p className="text-2xl font-extrabold text-navy font-display tabular-nums mt-0.5">{valor}</p>
      {pie && <p className="text-[13px] text-navy-light/80 font-body">{pie}</p>}
    </div>
  )
}

function Generos({ p }: { p: FilaPorPlan }) {
  const partes = [
    { n: p.mujeres, clase: 'bg-coral' },
    { n: p.hombres, clase: 'bg-navy' },
    { n: p.sinGenero, clase: 'bg-navy-light/25' },
  ].filter(x => x.n > 0)
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-2 w-20 overflow-hidden rounded-full bg-navy-light/10"
        role="img"
        aria-label={`${p.mujeres} mujeres, ${p.hombres} hombres, ${p.sinGenero} sin dato`}
      >
        {partes.map((x, i) => <div key={i} className={x.clase} style={{ width: `${(x.n / p.estudiantes) * 100}%` }} />)}
      </div>
      <span className="text-[13px] text-navy-light/80 tabular-nums font-body whitespace-nowrap">
        {p.mujeres}M · {p.hombres}H{p.sinGenero > 0 && ` · ${p.sinGenero}?`}
      </span>
    </div>
  )
}

const ANIO_ACTUAL = new Date().getUTCFullYear()

export default function ReporteEstudiosPage() {
  const { loaded } = usePermissions()
  const { user } = useAuth()
  const puedeVer = (user?.roles ?? []).some(r => (ESTUDIOS_REPORTE_ROLES as string[]).includes(r))

  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [plan, setPlan] = useState('')
  const [bloque, setBloque] = useState('')

  const { datos, cargando, error } = useCargaRemota<Respuesta>(
    loaded && puedeVer ? `estudios:${anio}` : '',
    async () => {
      const r = await fetch(`/api/reports/estudios?anio=${anio}`)
      if (!r.ok) throw new Error('No se pudo cargar el reporte de estudios.')
      return r.json()
    },
  )

  const todas = useMemo(() => datos?.filas ?? [], [datos])
  const bloques = useMemo(() => bloquesDisponibles(todas), [todas])
  // El bloque recorta ANTES que el plan: la tabla por tipo y los KPI tienen que
  // hablar del mismo universo que el selector de arriba.
  const filas = useMemo(() => filtrarPorBloque(todas, bloque), [todas, bloque])
  const visibles = useMemo(() => (plan ? filas.filter(f => f.plan_code === plan) : filas), [filas, plan])
  const total = useMemo(() => resumirEstudios(visibles), [visibles])
  const tabla = useMemo(() => porPlan(filas), [filas])
  const serie = useMemo(() => serieDeEstudios(datos?.serie ?? [], plan || undefined), [datos, plan])
  const anios = useMemo(() => aniosConEstudios(datos?.serie ?? []), [datos])
  // Al cambiar de año, el bloque del año viejo ya no existe.
  const bloqueVigente = bloques.some(b => b.bloque === bloque) ? bloque : ''
  if (bloqueVigente !== bloque) setBloque('')
  const hayCompartida = tabla.reduce((n, p) => n + p.estudiantes, 0) > resumirEstudios(filas).estudiantes

  if (!loaded) return null
  if (!puedeVer) {
    return <EmptyState icon={BookOpen} title="Acceso restringido" description="Este reporte es para coordinación de estudios, de dirigentes y dirección." />
  }

  return (
    <div className="space-y-4">
      <div>
        <VolverAReportes />
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Estudios</h1>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Cuenta a quien estuvo en un grupo <strong className="text-navy">en curso ese año</strong>, no en uno
          creado ese año: un grupo que arranca en noviembre y cierra en febrero tiene estudiantes en los dos.
        </p>
      </div>

      {/* ── Año y tipo de estudio ── */}
      <div className="flex flex-wrap items-center gap-2">
        {(anios.length ? anios : [ANIO_ACTUAL]).slice(0, 10).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAnio(a)}
            aria-pressed={a === anio}
            className={cn(
              'rounded-full px-3 py-1 text-[13px] transition-colors font-body border tabular-nums',
              a === anio ? 'bg-navy text-white border-navy' : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
            )}
          >
            {a}
          </button>
        ))}
        {/* El bloque lleva su conteo de grupos: en 2026, 199 de 255 grupos no
            tienen bloque, así que elegir uno deja fuera a la mayoría — y eso hay
            que verlo antes de elegir, no después. */}
        <select
          aria-label="Filtrar por bloque"
          value={bloque}
          onChange={e => setBloque(e.target.value)}
          className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        >
          <option value="">Todos los bloques</option>
          {bloques.map(b => (
            <option key={b.bloque} value={b.bloque}>{b.bloque} ({b.grupos})</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo de estudio"
          value={plan}
          onChange={e => setPlan(e.target.value)}
          className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        >
          <option value="">Todos los estudios</option>
          {tabla.map(p => <option key={p.code} value={p.code}>{p.nombre}</option>)}
        </select>
      </div>

      {error && <div className="card p-4 text-[13px] text-coral-deep font-body" role="alert">{error}</div>}
      {cargando && <p className="py-8 text-center text-sm text-navy-light/80 font-body">Cargando…</p>}

      {!cargando && datos && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi titulo="Grupos" valor={total.grupos.toLocaleString('es-CR')} pie={`en curso en ${anio}`} />
            <Kpi
              titulo="Estudiantes"
              valor={total.estudiantes.toLocaleString('es-CR')}
              pie="personas distintas"
              info="Quien llevó dos estudios cuenta UNA vez acá, pero aparece en cada uno de sus estudios en la tabla — por eso las filas suman más que este número."
            />
            <Kpi titulo="Dirigentes" valor={total.dirigentes.toLocaleString('es-CR')} pie="dieron al menos un grupo" />
            <Kpi
              titulo="Finalizaron"
              valor={total.pctFinalizo === null ? '—' : `${total.pctFinalizo}%`}
              pie={`${total.finalizaron} de ${total.matriculas} matrículas`}
              info="Terminaron y aprobaron, sobre el total de matrículas. Quien quedó reprobado llegó al final pero no cuenta acá. OJO con el año en curso: los grupos que todavía no cierran están en el denominador, así que el porcentaje sube cuando cierren."
            />
            <Kpi
              titulo="Llegaron por un estudio"
              valor={datos.nuevasPorEstudio.toLocaleString('es-CR')}
              pie="su primera actividad en Theos"
              info="Personas cuya PRIMERA actividad registrada fue matricularse. Las que ya venían a las charlas y después se matricularon no cuentan acá."
            />
          </div>

          <ChartCard
            title={plan ? `Estudiantes por año · ${tabla.find(p => p.code === plan)?.nombre ?? ''}` : 'Estudiantes por año'}
            subtitle="Personas distintas por año. Tocá una barra para ver ese año."
            empty={!serie.length}
          >
            <ResponsiveContainer>
              <BarChart
                data={serie}
                margin={{ top: 20, right: 8, left: -18, bottom: 0 }}
                onClick={(e) => { const a = Number(e?.activeLabel); if (a) setAnio(a) }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
                <XAxis dataKey="etiqueta" tick={EJE_TICK} />
                <YAxis tick={EJE_TICK} allowDecimals={false} />
                <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={CURSOR_BARRA} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Estudiantes']} />
                <Bar dataKey="estudiantes" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="estudiantes" position="top" {...ETIQUETA_VALOR} formatter={(v) => Number(v ?? 0).toLocaleString('es-CR')} />
                  {serie.map(p => <Cell key={p.anio} fill={p.anio === anio ? CORAL : CORAL_ATENUADO} cursor="pointer" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-navy font-display">
                  Por tipo de estudio · {anio}{bloque && ` · ${bloque}`}
                </h2>
                <p className="text-[13px] text-navy-light/80 font-body">{tabla.length} estudios con gente este año.</p>
              </div>
              {tabla.length > 0 && (
                <ExportButton<FilaPorPlan>
                  data={tabla} columns={COLUMNAS} allColumns={COLUMNAS} filename={`estudios-${anio}`}
                />
              )}
            </div>

            {tabla.length === 0 ? (
              <EmptyState icon={BookOpen} title={`Ningún grupo estuvo en curso en ${anio}`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {['Estudio', 'Grupos', 'Estudiantes', 'Dirigentes', 'Finalizó', 'Edad', 'Género'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.map((p, i) => (
                      <tr key={p.code} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '', plan === p.code ? 'bg-coral/5' : '')}>
                        <td className="px-3 py-2 text-[13px] text-navy font-body whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setPlan(plan === p.code ? '' : p.code)}
                            className="text-left hover:text-coral hover:underline bg-transparent border-0 cursor-pointer font-body"
                          >
                            {p.nombre}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{p.grupos}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{p.estudiantes}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{p.dirigentes}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">
                          {p.pctFinalizo === null ? '—' : `${p.pctFinalizo}%`}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">
                          {p.edadPromedio === null ? '—' : p.edadPromedio}
                          {p.sinEdad > 0 && <span className="text-navy-light/80"> ({p.sinEdad} sin fecha)</span>}
                        </td>
                        <td className="px-3 py-2"><Generos p={p} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hayCompartida && (
              <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                Las filas suman más que el total porque hay gente que llevó más de un estudio: cuenta en cada uno, y una sola vez arriba.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
