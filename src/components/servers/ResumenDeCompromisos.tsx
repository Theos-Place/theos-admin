'use client'

import { useMemo } from 'react'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'
import { ATTENDANCE_GENERAL_TOOLTIP } from '@/lib/attendance'
import { explicacionDeDonantes } from '@/lib/finance/ventana-de-donante'
import {
  cumplimiento, porcentajes, hayGenteCompartida, type ServidorDelReporte,
} from '@/lib/reports/servidores-compromisos'

/**
 * SRV-16 · Los cinco números de arriba: cuánta gente y qué porcentaje cumple
 * cada compromiso.
 *
 * VIVÍA DENTRO DE LA PANTALLA DE REP-7 y se sacó acá para que "Mi comité"
 * pudiera mostrarlo sin copiarlo. Esa es la razón de que sea un componente y
 * no dos bloques parecidos: el reporte de dirección y la pantalla del
 * encargado tienen que dar EL MISMO número para el mismo comité, y con dos
 * copias eso dura hasta que alguien toque una sola. Ya pasó con el truncado de
 * PostgREST (2026-09-21), que se descubrió justamente porque los dos lados
 * daban distinto.
 *
 * El cálculo tampoco se escribe acá: sale entero de
 * `lib/reports/servidores-compromisos`, que a su vez usa las reglas de
 * `lib/servers/compromisos`. Esto solo lo dibuja.
 */
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

export function ResumenDeCompromisos({
  servidores, nombreDelAlcance,
}: {
  servidores: readonly ServidorDelReporte[]
  /** Qué se está mirando: el nombre del comité, del área, o "Toda la organización". */
  nombreDelAlcance: string
}) {
  const total = useMemo(() => cumplimiento(servidores), [servidores])
  const pcts = useMemo(() => porcentajes(total), [total])
  const compartida = useMemo(() => hayGenteCompartida(servidores), [servidores])
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Kpi
        titulo="Servidores"
        valor={total.total.toLocaleString('es-CR')}
        pie={nombreDelAlcance}
        info={compartida
          ? 'Personas distintas. Quien sirve en varios comités cuenta UNA vez acá, pero aparece en cada uno de sus comités en el desglose — por eso las filas de abajo suman más que este número.'
          : undefined}
      />
      <Kpi titulo="Asistencia" valor={pct(pcts.asistencia)} pie={`${total.asistencia} cumplen`} info={ATTENDANCE_GENERAL_TOOLTIP} />
      <Kpi titulo="En estudio" valor={pct(pcts.estudio)} pie={`${total.estudio} llevando o dando`} />
      <Kpi titulo="Donantes" valor={pct(pcts.donante)} pie={`${total.donante} activos`} info={explicacionDeDonantes(new Date())} />
      <Kpi titulo="Cumplen todo" valor={pct(pcts.todo)} pie={`${total.conPendientes} con algo pendiente`} />
    </div>
  )
}
