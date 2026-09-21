'use client'

import { useMemo } from 'react'
import { Loader2, Users, Info } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import {
  demografiaPorSede, totalDeLaDemografia, type FilaCruda, type DemografiaDeSede,
} from '@/lib/reports/demografia'
import { cn } from '@/lib/utils'

const COLUMNAS: ColumnDef<DemografiaDeSede>[] = [
  { key: 'sede', label: 'Sede', defaultVisible: true },
  { key: 'personas', label: 'Personas', defaultVisible: true, exportValue: d => String(d.personas) },
  { key: 'edadPromedio', label: 'Edad promedio', defaultVisible: true, exportValue: d => (d.edadPromedio === null ? '' : String(d.edadPromedio)) },
  { key: 'edadMediana', label: 'Edad mediana', defaultVisible: true, exportValue: d => (d.edadMediana === null ? '' : String(d.edadMediana)) },
  { key: 'sinEdad', label: 'Sin fecha de nacimiento', defaultVisible: true, exportValue: d => String(d.sinEdad) },
  { key: 'mujeres', label: 'Mujeres', defaultVisible: true, exportValue: d => String(d.mujeres) },
  { key: 'hombres', label: 'Hombres', defaultVisible: true, exportValue: d => String(d.hombres) },
  { key: 'sinGenero', label: 'Sin dato de género', defaultVisible: true, exportValue: d => String(d.sinGenero) },
]

/** La barra apilada H / M / sin dato de una sede. */
function Generos({ d }: { d: DemografiaDeSede }) {
  const partes = [
    { n: d.mujeres, clase: 'bg-coral', etiqueta: 'mujeres' },
    { n: d.hombres, clase: 'bg-navy', etiqueta: 'hombres' },
    { n: d.sinGenero, clase: 'bg-navy-light/25', etiqueta: 'sin dato' },
  ].filter(p => p.n > 0)
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-2 w-28 overflow-hidden rounded-full bg-navy-light/10"
        role="img"
        aria-label={partes.map(p => `${p.n} ${p.etiqueta}`).join(', ')}
      >
        {partes.map(p => (
          <div key={p.etiqueta} className={p.clase} style={{ width: `${(p.n / d.personas) * 100}%` }} />
        ))}
      </div>
      <span className="text-[13px] text-navy-light/80 tabular-nums font-body whitespace-nowrap">
        {d.mujeres}M · {d.hombres}H{d.sinGenero > 0 && ` · ${d.sinGenero}?`}
      </span>
    </div>
  )
}

/**
 * REP-8 · Quiénes asisten a cada sede: cuántos, qué edad y qué género.
 *
 * Sigue la semana elegida si hay una; si no, el año del reporte.
 */
export function DemografiaPorSede({ clave, year }: { clave: string | null; year: number }) {
  const qs = clave ? `semana=${encodeURIComponent(clave)}` : `year=${year}`
  const { datos, cargando, error } = useCargaRemota<{ filas: FilaCruda[] }>(
    `demografia:${qs}`,
    async () => {
      const r = await fetch(`/api/reports/demografia?${qs}`)
      if (!r.ok) throw new Error('No se pudo cargar la demografía.')
      return r.json()
    },
  )

  const filas = useMemo(() => datos?.filas ?? [], [datos])
  const porSede = useMemo(() => demografiaPorSede(filas), [filas])
  const total = useMemo(() => totalDeLaDemografia(filas), [filas])
  const hayCompartida = total.personas > 0 && porSede.reduce((n, s) => n + s.personas, 0) > total.personas

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-navy-light/80">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        <span className="text-sm font-body">Cargando la demografía…</span>
      </div>
    )
  }
  if (error) return <p className="text-[13px] text-coral-deep font-body py-4" role="alert">{error}</p>

  return (
    <div role="tabpanel" aria-label="Demografía" className="space-y-3">
      <p className="text-[13px] text-navy-light/80 font-body">
        Quiénes asistieron {clave ? 'esa semana' : `en ${year}`}, sede por sede. Son{' '}
        <strong className="text-navy">personas</strong> y no check-ins: quien vino ocho veces cuenta una.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { t: 'Personas', v: total.personas.toLocaleString('es-CR'), p: 'distintas en total' },
          { t: 'Edad promedio', v: total.edadPromedio === null ? '—' : String(total.edadPromedio), p: total.sinEdad > 0 ? `${total.sinEdad} sin fecha de nacimiento` : undefined },
          { t: 'Edad mediana', v: total.edadMediana === null ? '—' : String(total.edadMediana) },
          { t: 'Mujeres / Hombres', v: `${total.mujeres} / ${total.hombres}`, p: total.sinGenero > 0 ? `${total.sinGenero} sin dato` : undefined },
        ].map(k => (
          <div key={k.t} className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
            <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">{k.t}</p>
            <p className="text-2xl font-extrabold text-navy font-display tabular-nums mt-0.5">{k.v}</p>
            {k.p && <p className="text-[13px] text-navy-light/80 font-body">{k.p}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-navy font-display">Por sede</h3>
          {porSede.length > 0 && (
            <ExportButton<DemografiaDeSede>
              data={porSede} columns={COLUMNAS} allColumns={COLUMNAS}
              filename={`demografia-${clave ?? year}`}
            />
          )}
        </div>

        {porSede.length === 0 ? (
          <EmptyState icon={Users} title="Nadie hizo check-in en este período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Sede', 'Personas', 'Edad prom.', 'Mediana', 'Género'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porSede.map((d, i) => (
                  <tr key={d.sede} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-3 py-2 text-[13px] text-navy font-body whitespace-nowrap">{d.sede}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{d.personas.toLocaleString('es-CR')}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">
                      {d.edadPromedio === null ? '—' : d.edadPromedio}
                      {d.sinEdad > 0 && <span className="text-navy-light/80"> ({d.sinEdad} sin fecha)</span>}
                    </td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 tabular-nums font-body">{d.edadMediana === null ? '—' : d.edadMediana}</td>
                    <td className="px-3 py-2"><Generos d={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hayCompartida && (
          <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
            Las filas suman más que el total porque hay gente que asistió a más de una sede: cuenta en cada una, y una sola vez arriba.
          </p>
        )}
      </div>
    </div>
  )
}
