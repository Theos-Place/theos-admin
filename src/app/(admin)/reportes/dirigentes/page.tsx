'use client'

/**
 * DIR-7 · Reporte de dirigentes.
 *
 * Los cinco buckets de estado son excluyentes y suman el total, así que la barra
 * de estado se puede leer como una partición. El desglose por estudio y por zona
 * NO suma el total (un dirigente tiene varios códigos y varias zonas) y eso se
 * dice en la nota de cada tarjeta en vez de dejar que el lector saque la cuenta
 * y no le cierre.
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { ChartCard } from '@/components/reportes/ChartCard'
import { cn } from '@/lib/utils'
import type { DirigentesReport, LeaderHistoryPoint } from '@/lib/reports/dirigentes'
import { VolverAReportes } from '@/components/reportes/VolverAReportes'
import {
  JerarquiaDeDirigentes, type Payload as JerarquiaPayload,
} from '@/components/reportes/JerarquiaDeDirigentes'
import { CruceSedeFormacion } from '@/components/reportes/CruceSedeFormacion'
import { EmptyState } from '@/components/shared/EmptyState'
import { Users } from 'lucide-react'
import { useAccesoAReporte } from '@/hooks/useAccesoAReporte'
import {
  NAVY, TEAL, EJE_TICK, ESTILO_TOOLTIP, ETIQUETA_VALOR,
  ETIQUETA_CATEGORIA, anchoDeEjeCategoria,
} from '@/lib/reports/paleta'


const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-CR')

type Payload = DirigentesReport & { ver_matiz: boolean }


/** Comparación contra un punto histórico. Sin punto dice por qué no lo hay:
 *  la serie arrancó el 2026-08-21 y antes de eso no existe el dato. */
function Delta({ label, actual, punto }: { label: string; actual: number; punto: LeaderHistoryPoint | null }) {
  if (!punto) {
    return (
      <div className="rounded-2xl bg-surface-low p-4">
        <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">{label}</p>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Todavía sin dato. La serie empezó a guardarse el 21 de agosto de 2026.
        </p>
      </div>
    )
  }
  const d = actual - punto.activos
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus
  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-wide text-navy-light/80 font-body">{label}</p>
      <p className={cn(
        'mt-1 flex items-center gap-1 text-2xl font-display font-extrabold tracking-[-0.02em]',
        d > 0 ? 'text-success' : d < 0 ? 'text-coral' : 'text-navy',
      )}>
        <Icon size={18} aria-hidden="true" />
        {d > 0 ? '+' : ''}{fmt(d)}
      </p>
      <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
        Eran {fmt(punto.activos)} el {new Date(`${punto.captured_on}T12:00:00`).toLocaleDateString('es-CR', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </p>
    </div>
  )
}

export default function ReporteDirigentesPage() {
  /**
   * REP-11 · Esta pantalla NO TENÍA GATE: cargaba siempre y, si el endpoint
   * decía que no, mostraba "Error cargando el reporte" — que se lee como una
   * falla del sistema, no como una puerta cerrada. Ahora que el reporte está
   * acotado a coordinación de estudios y de dirigentes (decisión 2026-09-30),
   * eso le habría pasado a cinco personas que hoy lo abren.
   */
  const { loaded, puedeVer } = useAccesoAReporte('dirigentes')
  const [report, setReport] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jerarquia, setJerarquia] = useState<JerarquiaPayload | null>(null)
  const [errorJerarquia, setErrorJerarquia] = useState<string | null>(null)

  const fetchReport = useCallback(() => {
    if (!puedeVer) return
    fetch('/api/reports/leaders')
      .then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<Payload> })
      .then(setReport)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [puedeVer])
  useEffect(() => { fetchReport() }, [fetchReport])

  // DIR-9 · Llamada aparte de la de DIR-7: esta NO va por el snapshot
  // nocturno, se calcula al abrir. El reporte se mira justo para decidir a
  // quién asignarle un grupo, y un número de anoche serviría para lo
  // contrario.
  useEffect(() => {
    if (!puedeVer) return
    let vivo = true
    fetch('/api/reports/leaders/jerarquia')
      .then(async r => {
        if (!r.ok) {
          const { mensajeDeLaRespuesta } = await import('@/lib/api/mensaje-del-error')
          throw new Error(await mensajeDeLaRespuesta(r, 'No se pudo cargar el resumen de dirigentes.'))
        }
        return r.json() as Promise<JerarquiaPayload>
      })
      .then(d => { if (vivo) { setJerarquia(d); setErrorJerarquia(null) } })
      .catch(e => { if (vivo) setErrorJerarquia(e instanceof Error ? e.message : 'No se pudo cargar el resumen de dirigentes.') })
    return () => { vivo = false }
  }, [puedeVer])

  if (!loaded) return null
  if (!puedeVer) {
    return (
      <div className="space-y-4">
        <VolverAReportes />
        <EmptyState
          icon={Users}
          title="Acceso restringido"
          description="Este reporte es para la coordinación de estudios y de dirigentes."
        />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-72 rounded-lg bg-surface-card animate-pulse" />
        {error ? <p className="text-sm text-coral font-body">{error}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />)}
          </div>
        )}
      </div>
    )
  }

  // Si el único bucket es "sin zona", no hay desglose que mostrar: una barra
  // sola con el total de activos no dice nada. Mejor la tarjeta vacía con el
  // porqué — hoy nada escribe zone_preference (el formulario de DIR-1 recoge la
  // zona pero es de solo lectura para el coordinador).
  /**
   * DIR-9 · Capacitaciones y campañas SEPARADAS (pedido de Fabiola).
   *
   * Dar Nivel 3 es formación del cuerpo de dirigentes; haber dado
   * Transformados es haber servido en una campaña puntual. Mezclados, una
   * campaña grande infla el conteo y parece que hay más gente formada.
   */
  const capacitaciones = report.capacitados.filter(d => !d.es_campana)
  const campanas = report.capacitados.filter(d => d.es_campana)

  const sinZonas = report.por_zona.length === 0
    || (report.por_zona.length === 1 && report.por_zona[0].zona === 'Sin zona declarada')


  return (
    <div className="space-y-5">
      <div>
        <VolverAReportes />
        <h1 className="mt-1 text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Dirigentes
        </h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Cuántos hay, cuántos están dando estudio y para qué está capacitado el cuerpo de dirigentes.
        </p>
      </div>

      {/*
        DIR-9 · Los titulares viejos (Activos / Dando ahora / Disponibles /
        Designados) SE FUERON, y no por estética: contaban con la taxonomía
        anterior (`is_active` + grupo abierto) mientras la jerarquía cuenta
        con la de DIR-8 (estado_base + disponibilidad). Dejar las dos en la
        misma pantalla mostraría dos cifras distintas de «activos» a medio
        metro una de otra, que es el bug que este reporte vino a arreglar.
      */}
      {jerarquia
        ? <JerarquiaDeDirigentes datos={jerarquia} />
        : errorJerarquia
          ? <p className="text-sm text-coral font-body">{errorJerarquia}</p>
          : <div className="h-64 rounded-2xl bg-surface-card animate-pulse" />}

      {/* Calidad de datos: EST-1 dice que esto no debería existir, así que
          cuando existe hay que verlo. No es una métrica del cuerpo. */}
      {(report.dando_inactivos > 0 || report.dando_sin_ficha > 0) && (
        <div className="rounded-2xl bg-[rgba(233,185,73,0.12)] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#A8821F] font-body">
            <AlertTriangle size={14} aria-hidden="true" /> Datos por revisar
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-navy-light/80 font-body">
            {report.dando_inactivos > 0 && (
              <li>
                {fmt(report.dando_inactivos)} dirigente{report.dando_inactivos === 1 ? '' : 's'} lleva
                {report.dando_inactivos === 1 ? '' : 'n'} un grupo abierto estando inactivo{report.dando_inactivos === 1 ? '' : 's'}.
                La regla dice que eso no debería pasar.
              </li>
            )}
            {report.dando_sin_ficha > 0 && (
              <li>
                {fmt(report.dando_sin_ficha)} persona{report.dando_sin_ficha === 1 ? '' : 's'} lleva
                {report.dando_sin_ficha === 1 ? '' : 'n'} un grupo abierto sin ficha de dirigente, así que
                no aparece{report.dando_sin_ficha === 1 ? '' : 'n'} en los conteos de arriba.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Evolución */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Delta label="Activos vs. hace 3 meses" actual={report.activos} punto={report.evolucion.hace_3_meses} />
        <Delta label="Activos vs. hace 6 meses" actual={report.activos} punto={report.evolucion.hace_6_meses} />
      </div>


      {/* Capacidad por estudio: las dos columnas, que NO son lo mismo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Capacitados por estudio"
          subtitle="Para qué está formado cada dirigente"
          empty={capacitaciones.length === 0}
          height={Math.max(220, capacitaciones.length * 30)}
          footnote="Un dirigente cuenta en cada estudio para el que está capacitado, así que las barras no suman el total. Las campañas van aparte, abajo."
        >
          <ResponsiveContainer>
            <BarChart data={capacitaciones} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={EJE_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={anchoDeEjeCategoria(capacitaciones.map(d => d.name))} tick={ETIQUETA_CATEGORIA} interval={0} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="total" fill={NAVY} radius={[0, 6, 6, 0]} name="Capacitados">
                <LabelList dataKey="total" position="right" style={ETIQUETA_VALOR} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Dispuestos a darlo ahora"
          subtitle="Lo que declaró en su disponibilidad"
          empty={report.disponibles_por_estudio.length === 0}
          height={Math.max(220, report.disponibles_por_estudio.length * 30)}
          footnote="Comparado con la tarjeta de al lado: la diferencia es capacidad que existe y no está ofrecida."
        >
          <ResponsiveContainer>
            <BarChart data={report.disponibles_por_estudio} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={EJE_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={anchoDeEjeCategoria(report.disponibles_por_estudio.map(d => d.name))} tick={ETIQUETA_CATEGORIA} interval={0} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="total" fill={TEAL} radius={[0, 6, 6, 0]} name="Disponibles">
                <LabelList dataKey="total" position="right" style={ETIQUETA_VALOR} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* DIR-9 · Campañas, su propia tarjeta. Solo aparece si hay alguna:
          una tarjeta vacía ocupa el mismo espacio y no dice nada. */}
      {campanas.length > 0 && (
        <ChartCard
          title="Han servido en campañas"
          subtitle="Campañas puntuales, no formación del cuerpo de dirigentes"
          height={Math.max(200, campanas.length * 30)}
          footnote="Separado a propósito de la formación: haber servido en una campaña no capacita para dar un estudio."
        >
          <ResponsiveContainer>
            <BarChart data={campanas} layout="vertical" margin={{ left: 12, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={EJE_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={anchoDeEjeCategoria(campanas.map(d => d.name))} tick={ETIQUETA_CATEGORIA} interval={0} />
              <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="total" fill={TEAL} radius={[0, 6, 6, 0]} name="Sirvieron">
                <LabelList dataKey="total" position="right" style={ETIQUETA_VALOR} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* DIR-9 · El cruce sede × formación, para encontrar huecos. */}
      {jerarquia && <CruceSedeFormacion datos={jerarquia.cruce} nombres={jerarquia.nombres} />}

      {/* Por zona */}
      <ChartCard
        title="Dirigentes activos por zona"
        subtitle="Según la preferencia de zona que declararon"
        empty={sinZonas}
        height={Math.max(240, report.por_zona.length * 30)}
        footnote={sinZonas
          ? undefined
          : 'Quien declaró varias zonas cuenta en todas, así que las barras suman más que el total de activos.'}
      >
        <ResponsiveContainer>
          <BarChart data={report.por_zona} layout="vertical" margin={{ left: 12, right: 32 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={EJE_TICK} allowDecimals={false} />
            <YAxis type="category" dataKey="zona" width={anchoDeEjeCategoria(report.por_zona.map(d => d.zona))} tick={ETIQUETA_CATEGORIA} interval={0} />
            <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="dando_ahora" stackId="z" fill={NAVY} radius={[0, 0, 0, 0]} name="Dando ahora" />
            <Bar dataKey="disponibles_sin_grupo" stackId="z" fill={TEAL} radius={[0, 6, 6, 0]} name="Disponibles">
              <LabelList dataKey="activos" position="right" style={ETIQUETA_VALOR} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
