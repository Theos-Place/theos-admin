'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, Cell, LabelList, ComposedChart, Line,
} from 'recharts'
import { ReportShell } from '@/components/reportes/ReportShell'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ChartCard } from '@/components/reportes/ChartCard'
import { UpdatingBadge } from '@/components/reportes/UpdatingBadge'
import { Tabs } from '@/components/shared/Tabs'
import { ALL_SEDES, type CharlaReport } from '@/lib/reports/charla-attendance'
import { NO_SEDE, type GrowthReport } from '@/lib/reports/member-growth'
import { SemanaDetallePanel } from '@/components/reports/SemanaDetallePanel'
import { ListasDeLaSemana } from '@/components/reports/ListasDeLaSemana'
import { DemografiaPorSede } from '@/components/reports/DemografiaPorSede'
import { leerClaveDeSemana } from '@/lib/reports/semana-detalle'
import { rangoDeSemana } from '@/lib/reports/rango-de-semana'
import { unirSeries } from '@/lib/reports/comparar-series'
import { useSearchParams } from 'next/navigation'
import type { DetalleDeSemana } from '@/lib/reports/semana-detalle'
import {
  CORAL, CORAL_ATENUADO, PARCIAL_RELLENO, PARCIAL_BORDE, NAVY, GRIS, TEAL_CLARO,
  COLORES_POR_ANIO, EJE_TICK, REJILLA, CURSOR_BARRA,
  ESTILO_TOOLTIP, ETIQUETA_VALOR, ETIQUETA_CATEGORIA,
  anchoDeEjeCategoria, margenParaEtiquetas,
} from '@/lib/reports/paleta'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function ReporteAsistenciaPage() {
  const [report, setReport] = useState<CharlaReport | null>(null)
  const [growth, setGrowth] = useState<GrowthReport | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sede, setSede] = useState<string>(ALL_SEDES)
  // La semana abierta vive en la URL, no en un estado suelto: así el enlace se
  // puede compartir y el back del navegador vuelve al año. Se lee con el hook
  // y no con un efecto, que dispararía un render en cascada.
  const params = useSearchParams()
  const [semanaLocal, setSemanaLocal] = useState<string | null>(null)
  const semanaSel = leerClaveDeSemana(semanaLocal ?? params.get('semana'))
  // El resultado se guarda CON su clave de semana y el resto se deriva. Así el
  // efecto no tiene que resetear nada al cambiar de semana —eso dispara
  // renders en cascada— y nunca se muestra el dato de una semana bajo el
  // título de otra.
  const [resultado, setResultado] = useState<{ clave: string; detalle: DetalleDeSemana | null; error: string | null } | null>(null)
  const [tab, setTab] = useState<'asistencia' | 'crecimiento' | 'demografia'>('asistencia')
  // Comparación de dos sedes en el mismo gráfico. La serie comparada se guarda
  // CON su clave (sede|año) por la misma razón que el detalle de semana: así no
  // se muestra la serie de una sede bajo el rótulo de otra mientras carga.
  const [comparar, setComparar] = useState<string>('')
  const [serieComp, setSerieComp] = useState<{ clave: string; puntos: { week: number; total: number; partial: boolean }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((y: number | null, s: string) => {
    setLoading(true); setError(null)
    const qs = new URLSearchParams()
    if (y) qs.set('year', String(y))
    if (s) qs.set('sede', s)
    const q = qs.toString()
    Promise.all([
      fetch(`/api/reports/charla-attendance?${q}`).then(r => { if (!r.ok) throw new Error('Error cargando el reporte'); return r.json() as Promise<CharlaReport> }),
      fetch(`/api/reports/member-growth?${q}`).then(r => { if (!r.ok) throw new Error('Error cargando crecimiento'); return r.json() as Promise<GrowthReport> }),
    ])
      .then(([d, g]) => {
        setReport(d)
        setGrowth(g)
        setYear(d.year)
        setSede(d.sede)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(null, ALL_SEDES) }, [load])

  // Serie de la sede con la que se compara. Se pide al mismo endpoint cambiando
  // `sede`: no hace falta nada nuevo en el servidor.
  const claveComp = comparar && report ? `${comparar}|${report.year}` : null
  useEffect(() => {
    // Sin comparación no se limpia el estado: `hayComparacion` compara la
    // clave, así que una serie vieja ahí no se muestra. Limpiarla sería un
    // setState síncrono dentro del efecto, que dispara renders en cascada.
    if (!claveComp) return
    let vivo = true
    const [s2, y2] = claveComp.split('|')
    fetch(`/api/reports/charla-attendance?year=${y2}&sede=${encodeURIComponent(s2)}`)
      .then(r => (r.ok ? r.json() as Promise<CharlaReport> : Promise.reject(new Error('no'))))
      .then(d => { if (vivo) setSerieComp({ clave: claveComp, puntos: d.weekly }) })
      .catch(() => { if (vivo) setSerieComp(null) })
    return () => { vivo = false }
  }, [claveComp])

  // El detalle de la semana se pide UNA vez acá y lo comparten el panel y el
  // gráfico de sedes: dos fetch del mismo dato podrían mostrar números
  // distintos si el snapshot cambia entre uno y otro.
  const claveSemana = semanaSel ? `${semanaSel.year}-W${String(semanaSel.week).padStart(2, '0')}` : null
  const claveConSede = claveSemana ? `${claveSemana}|${sede}` : null
  useEffect(() => {
    if (!claveSemana || !claveConSede) return
    let vivo = true
    const qs = new URLSearchParams({ semana: claveSemana })
    if (sede && sede !== ALL_SEDES) qs.set('sede', sede)
    fetch(`/api/reports/charla-attendance?${qs}`)
      .then(async r => {
        if (r.ok) return r.json()
        const b = await r.json().catch(() => null)
        throw new Error(b?.error ?? 'No se pudo cargar la semana.')
      })
      .then(d => { if (vivo) setResultado({ clave: claveConSede, detalle: d, error: null }) })
      .catch(e => { if (vivo) setResultado({ clave: claveConSede, detalle: null, error: e.message }) })
    return () => { vivo = false }
  }, [claveSemana, claveConSede, sede])

  const listo = !!claveConSede && resultado?.clave === claveConSede
  const detalle = listo ? resultado!.detalle : null
  const errorSemana = listo ? resultado!.error : null
  const cargandoSemana = !!claveConSede && !listo

  function onYear(y: number) { setYear(y); load(y, sede); setSemana(null); setComparar('') }
  function onSede(s: string) {
    setSede(s); load(year, s)
    // La comparación se limpia al cambiar la sede principal: dejarla pegada
    // mostraría dos series que ya no son las que se eligieron.
    setComparar('')
  }

  /** REP-2 · La semana abierta va en la URL (?semana=2026-W37) para poder
   *  mandar el enlace. Se lee de ahí, no de un estado suelto, así el back del
   *  navegador vuelve al año como cualquiera esperaría. */
  function abrirSemana(week: number) {
    if (!report) return
    const clave = `${report.year}-W${String(week).padStart(2, '0')}`
    // REP-8 · Tocar la MISMA semana la cierra. Antes solo se podía salir con
    // "Volver al año", que está arriba del todo y se pierde de vista apenas se
    // baja al detalle.
    setSemana(claveSemana === clave ? null : clave)
  }
  function setSemana(clave: string | null) {
    setSemanaLocal(clave)
    const url = new URL(window.location.href)
    if (clave) url.searchParams.set('semana', clave)
    else url.searchParams.delete('semana')
    window.history.pushState(null, '', url)
  }

  // Carga inicial: skeleton.
  if (!report || !growth) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 rounded-lg bg-surface-card animate-pulse" />
        {error ? (
          <p className="text-sm text-coral font-body">{error}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
            <div className="hidden lg:block h-64 rounded-2xl bg-surface-card animate-pulse" />
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />)}
              </div>
              <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
              <div className="h-72 rounded-2xl bg-surface-card animate-pulse" />
            </div>
          </div>
        )}
      </div>
    )
  }

  const sedeLabel = report.sede === ALL_SEDES ? 'todas las sedes' : report.sede
  // Con una semana abierta, el ranking de sedes es el de ESA semana.
  const rankingSemanal = !!semanaSel && !!detalle
  const rankingAMostrar = rankingSemanal
    ? detalle!.porSede.map(s => ({ sede: s.sede, total: s.total }))
    : report.sedeRanking
  const hasPartialWeek = report.weekly.some(w => w.partial)
  // Card de promedio semanal del año seleccionado (cambia con el pill).
  const selectedCard = report.annualCards.find(c => c.year === report.year)

  // Serie del gráfico: la principal sola, o unida con la comparada.
  const hayComparacion = !!comparar && serieComp?.clave === claveComp
  // Siempre la misma forma, con o sin comparación: así los <Cell> y el <Line>
  // leen un único tipo y no hay que ramificar el gráfico.
  const datosSemanales = unirSeries(report?.weekly ?? [], hayComparacion ? serieComp!.puntos : [])

  // ── Asistencia semanal: semana a destacar + línea fantasma del año anterior ──
  const isCurrentYear = report.year === new Date().getFullYear()
  // Para el año en curso destacamos la última semana con datos (la "actual");
  // para años cerrados, la semana pico del período.
  const peakWeek = report.weekly.reduce<{ week: number; total: number } | null>(
    (best, w) => (!best || w.total > best.total ? { week: w.week, total: w.total } : best), null)
  const latestWeek = report.weekly.length ? report.weekly[report.weekly.length - 1].week : null
  const highlightWeek = isCurrentYear ? latestWeek : peakWeek?.week ?? null
  const prevYear = report.year - 1
  // Intervalo de etiquetas del eje X: ~12 visibles como máximo (cada 2 / cada 4).
  const xTickInterval = report.weekly.length > 28 ? 3 : 1

  // ── Mini-KPIs (todo del payload actual, sin métricas nuevas) ──
  const totalYear = selectedCard?.total ?? 0
  const bestWeek = peakWeek?.total ?? 0
  const sedeLeader = report.sedeRanking[0] ?? null

  // Datos de gráficos
  const monthlyData = report.monthly.map(m => {
    const row: Record<string, number | string | null> = { month: MONTHS[m.month - 1] }
    for (const y of report.monthlyYears) row[String(y)] = m.values[y]
    return row
  })
  const growthMonthlyData = growth.monthly.map(m => ({ month: MONTHS[m.month - 1], total: m.total }))
  const topSede = growth.bySede.find(s => s.sede !== NO_SEDE)
  const sinSede = growth.bySede.find(s => s.sede === NO_SEDE)?.total ?? 0
  const growthTotal = growth.bySede.reduce((acc, s) => acc + s.total, 0)
  const sinSedePct = growthTotal > 0 ? Math.round((sinSede / growthTotal) * 1000) / 10 : 0
  // "Sin sede" es una categoría especial: va al final del gráfico, no entre sedes.
  const bySedeOrdered = [
    ...growth.bySede.filter(s => s.sede !== NO_SEDE),
    ...growth.bySede.filter(s => s.sede === NO_SEDE),
  ]

  return (
    <div className={loading ? 'opacity-60 transition-opacity pointer-events-none' : 'transition-opacity'}>
      <UpdatingBadge show={loading} />
      <ReportShell
        title="Crecimiento y Asistencia"
        description="Personas nuevas y check-ins a charlas por sede. La fecha de alta es la primera señal de la persona (perfil, check-in o matrícula) y la sede se deriva de la asistencia."
        years={report.years}
        year={report.year}
        onYear={onYear}
        sedes={report.sedes}
        sede={report.sede}
        onSede={onSede}
        sedeCounts={Object.fromEntries(report.sedeRanking.map(s => [s.sede, s.total]))}
        totalCount={report.sedeRanking.reduce((acc, s) => acc + s.total, 0)}
      >
        {/* Pestañas: separan las dos secciones del reporte para acortar la página. */}
        <Tabs
          tabs={[
            { key: 'asistencia', label: 'Asistencia' },
            { key: 'crecimiento', label: 'Crecimiento' },
            { key: 'demografia', label: 'Demografía' },
          ]}
          active={tab}
          onChange={k => setTab(k as 'asistencia' | 'crecimiento' | 'demografia')}
        />

        {/* ───────────────────────── Asistencia ───────────────────────── */}
        {tab === 'asistencia' && (
          <div role="tabpanel" aria-label="Asistencia" className="space-y-3">
            {/* Card de promedio semanal (año del pill) + mini-KPIs a la izquierda
                (1/5) y el gráfico semanal a la derecha (4/5). */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-1 space-y-3">
                {selectedCard && (
                  <KpiCard
                    label={`Promedio semanal ${selectedCard.year}`}
                    value={selectedCard.weeklyAvg}
                    sublabel={`${selectedCard.total.toLocaleString('es-CR')} check-ins`}
                    changePct={selectedCard.changePct}
                    highlight
                  />
                )}
                {/* Mini-KPIs compactos: aprovechan el espacio al lado del gráfico. */}
                <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)] space-y-2.5">
                  <MiniStat label="Total del año" value={totalYear.toLocaleString('es-CR')} />
                  <MiniStat label="Mejor semana" value={bestWeek.toLocaleString('es-CR')} sub="check-ins" />
                  <MiniStat label="Sede líder" value={sedeLeader ? sedeLeader.sede : '—'} sub={sedeLeader ? `${sedeLeader.total.toLocaleString('es-CR')} check-ins` : undefined} />
                  <MiniStat
                    label={`Vs. ${prevYear}`}
                    value={selectedCard?.changePct != null ? `${selectedCard.changePct > 0 ? '+' : ''}${selectedCard.changePct}%` : '—'}
                    tone={selectedCard?.changePct == null ? 'muted' : selectedCard.changePct >= 0 ? 'up' : 'down'}
                  />
                </div>
              </div>
              <div className="lg:col-span-4">
                <ChartCard
                  title={`Asistencia semanal — ${report.year}`}
                  subtitle={`Check-ins por semana (${sedeLabel}). Línea punteada navy = promedio del año.`}
                  empty={report.weekly.length === 0}
                  height={230}
                  footnote={`Tocá una barra para ver esa semana sola.${hasPartialWeek ? ' Las barras en tono claro son semanas parciales (feriado o pocos días con charlas), no caídas reales.' : ''}`}
                >
                  <ResponsiveContainer>
                    <ComposedChart data={datosSemanales} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
                      {/* REP-4: el tick muestra el lunes ("14 set"), no el
                          número ISO. Con ~52 puntos no cabe el rango completo;
                          ese va en el tooltip. */}
                      <XAxis
                        dataKey="week" interval={xTickInterval} tick={EJE_TICK} tickLine={false} axisLine={false}
                        tickFormatter={(w) => rangoDeSemana(report.year, Number(w), report.year).etiquetaCorta}
                      />
                      <YAxis tick={EJE_TICK} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={ESTILO_TOOLTIP}
                        formatter={(v, _n, p) => [Number(v), (p?.payload as { partial?: boolean })?.partial ? 'Check-ins (semana parcial)' : 'Check-ins']}
                        labelFormatter={(l) => rangoDeSemana(report.year, Number(l), report.year).conNumero}
                      />
                      <ReferenceLine y={report.weeklyAvg} stroke={NAVY} strokeDasharray="5 4" strokeWidth={1.5} />
                      <Bar
                        dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}
                        cursor="pointer"
                        onClick={(d: unknown) => {
                          const w = (d as { week?: number } | undefined)?.week
                          if (typeof w === 'number') abrirSemana(w)
                        }}
                      >
                        {/* Los Cell se mapean desde datosSemanales, NO desde
                            report.weekly: Recharts los aplica POR POSICIÓN, y al
                            comparar la serie unida puede tener semanas que la
                            principal no tiene. Con la lista corta, los colores
                            se corrían y una semana parcial pintaba a otra. */}
                        {datosSemanales.map(w => {
                          // TRES estados y no dos. La SELECCIONADA manda sobre
                          // todo —es la que la persona acaba de tocar y la que
                          // está mostrando el panel de abajo— y va en navy, que
                          // no se confunde con ningún tono de coral.
                          // La semana parcial se marca con relleno claro Y borde
                          // punteado: solo con el relleno no llegaba a 3:1 y se
                          // perdía contra el blanco de la tarjeta.
                          const activa = w.week === semanaSel?.week
                          return (
                            <Cell
                              key={w.week}
                              fill={activa ? NAVY : w.partial ? PARCIAL_RELLENO : w.week === highlightWeek ? CORAL : CORAL_ATENUADO}
                              stroke={activa ? NAVY : w.partial ? PARCIAL_BORDE : undefined}
                              strokeWidth={activa ? 2 : w.partial ? 1.5 : undefined}
                              strokeDasharray={!activa && w.partial ? '3 2' : undefined}
                            />
                          )
                        })}
                      </Bar>
                      {/* La sede comparada va como línea punteada teal: se lee
                          encima de las barras sin competir con el coral, y el
                          punteado la distingue de la línea de promedio (navy).
                          `connectNulls={false}`: donde esa sede no tuvo datos la
                          línea se corta, en vez de inventar una recta. */}
                      {hayComparacion && (
                        <Line
                          type="monotone" dataKey="comparado" name={comparar}
                          stroke={TEAL_CLARO} strokeWidth={2} strokeDasharray="5 4"
                          dot={false} connectNulls={false} isAnimationActive={false}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                  {/* Comparar con otra sede. Solo tiene sentido con UNA sede
                      elegida: contra "todas" la línea sería un subconjunto de
                      las barras y no compara nada. */}
                  {sede !== ALL_SEDES && report.sedes.length > 1 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <label htmlFor="comparar-sede" className="text-[13px] text-navy-light/80 font-body">
                        Comparar con
                      </label>
                      <select
                        id="comparar-sede"
                        value={comparar}
                        onChange={e => setComparar(e.target.value)}
                        className="rounded-xl border border-outline bg-surface-card px-2.5 py-1 text-[13px] text-navy font-body"
                      >
                        <option value="">— ninguna —</option>
                        {report.sedes.filter(s => s !== sede).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {hayComparacion && (
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 font-body">
                          <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: TEAL_CLARO }} />
                          {comparar}
                        </span>
                      )}
                    </div>
                  )}
                </ChartCard>
                {semanaSel && (
                  <div className="mt-4">
                    <SemanaDetallePanel
                      year={semanaSel.year}
                      week={semanaSel.week}
                      detalle={detalle}
                      cargando={cargandoSemana}
                      error={errorSemana}
                      onVolver={() => setSemana(null)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Comparativos lado a lado en desktop. */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Comparación por sede */}
              {/* Sigue la semana elegida: preguntar "¿cómo nos fue esta
                  semana?" y tener al lado el acumulado del año era leer dos
                  cosas distintas creyendo que eran la misma. */}
              <ChartCard
                title={rankingSemanal
                  ? `Comparación por sede — ${rangoDeSemana(semanaSel!.year, semanaSel!.week, semanaSel!.year).etiqueta}`
                  : `Comparación por sede — ${report.year}`}
                subtitle={rankingSemanal
                  ? 'Check-ins de esa semana por sede. La sede seleccionada se resalta.'
                  : 'Check-ins del año por sede. La sede seleccionada se resalta.'}
                empty={rankingAMostrar.length === 0}
                height={Math.max(180, rankingAMostrar.length * 26)}
              >
                <ResponsiveContainer>
                  {/* El eje se ancha según el nombre más largo para que cada
                      sede quepa en UNA línea, y el total se imprime al final de
                      la barra: en tablet no hay hover y comparar dos sedes
                      obligaba a pasar por encima de cada una. */}
                  <BarChart
                    layout="vertical" data={rankingAMostrar}
                    margin={{ top: 4, right: margenParaEtiquetas(rankingAMostrar.map(s => s.total)), left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} horizontal={false} />
                    <XAxis type="number" tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category" dataKey="sede"
                      width={anchoDeEjeCategoria(rankingAMostrar.map(s => s.sede))}
                      tick={ETIQUETA_CATEGORIA} tickLine={false} axisLine={false} interval={0}
                    />
                    <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Check-ins']} cursor={CURSOR_BARRA} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {rankingAMostrar.map(s => (
                        <Cell key={s.sede} fill={report.sede !== ALL_SEDES && s.sede === report.sede ? CORAL : NAVY} />
                      ))}
                      <LabelList
                        dataKey="total" position="right"
                        formatter={(v) => Number(v).toLocaleString('es-CR')}
                        style={ETIQUETA_VALOR}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Comparativo por año y mes */}
              <ChartCard
                title="Comparativo por año y mes"
                subtitle={`Promedio semanal por mes — últimos ${report.monthlyYears.length} año(s) (${sedeLabel}).`}
                empty={report.monthlyYears.length === 0}
                height={210}
                footnote="El mes en curso es un promedio de las semanas completas hasta hoy."
              >
                <ResponsiveContainer>
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
                    <XAxis dataKey="month" tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <YAxis tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={ESTILO_TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-body)' }} />
                    {report.monthlyYears.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={COLORES_POR_ANIO[i % COLORES_POR_ANIO.length]} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}

        {/* ───────────────────────── Crecimiento ───────────────────────── */}
        {tab === 'crecimiento' && (
          <div role="tabpanel" aria-label="Crecimiento" className="space-y-3">
            <p className="text-[13px] text-navy-light/80 font-body">
              Crecimiento <strong className="text-navy-light/90">bruto</strong> (solo altas, no se restan bajas). “Nuevo” = la primera vez que sabemos de la persona: su perfil, su primer check-in o su primera matrícula, lo que haya pasado antes. Objetivo #1 del año: crecer en sedes.
            </p>

            {/* KPIs de crecimiento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label={`Personas nuevas ${growth.year}`}
                value={growth.totalNew.toLocaleString('es-CR')}
                sublabel={growth.partialPeriod ? `Bruto · vs. mismo período ${growth.year - 1}` : 'Crecimiento bruto'}
                changePct={growth.changePct}
                highlight
              />
              <KpiCard
                label="Sede con más nuevos"
                value={topSede ? topSede.sede : '—'}
                sublabel={topSede ? `${topSede.total.toLocaleString('es-CR')} personas` : 'Sin datos'}
              />
              <KpiCard
                label="Sin sede"
                value={sinSede.toLocaleString('es-CR')}
                sublabel={`${sinSedePct}% del total · sin asistencia a charlas`}
                info="Personas sin asistencia a charlas registrada. Probablemente ingresaron por estudios bíblicos sin haber asistido a charlas. No es un error de datos."
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Crecimiento por sede */}
              <ChartCard
                title={`Personas nuevas por sede — ${growth.year}`}
                subtitle="Personas nuevas por sede. La sede seleccionada se resalta."
                empty={growth.bySede.length === 0}
                height={Math.max(180, bySedeOrdered.length * 26)}
                footnote='Sede = la de mayor asistencia a charlas. “Sin sede” (al final) = sin asistencia registrada.'
              >
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical" data={bySedeOrdered}
                    margin={{ top: 4, right: margenParaEtiquetas(bySedeOrdered.map(s => s.total)), left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} horizontal={false} />
                    <XAxis type="number" tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category" dataKey="sede"
                      width={anchoDeEjeCategoria(bySedeOrdered.map(s => s.sede))}
                      tick={ETIQUETA_CATEGORIA} tickLine={false} axisLine={false} interval={0}
                    />
                    <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} cursor={CURSOR_BARRA} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {bySedeOrdered.map(s => (
                        <Cell key={s.sede} fill={growth.sede !== ALL_SEDES && s.sede === growth.sede ? CORAL : s.sede === NO_SEDE ? GRIS : NAVY} />
                      ))}
                      <LabelList
                        dataKey="total" position="right"
                        formatter={(v) => Number(v).toLocaleString('es-CR')}
                        style={ETIQUETA_VALOR}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Tendencia de nuevos por mes */}
              <ChartCard
                title={`Nuevos por mes — ${growth.year}`}
                subtitle={`Ritmo de captación de personas nuevas (${sedeLabel}).`}
                empty={growth.totalNew === 0}
                height={210}
                footnote="Cuenta cada persona en el mes de su primera señal: perfil, primer check-in o primera matrícula. No es la fecha en que se creó la ficha — a quien entró por un import se le creó meses después."
              >
                <ResponsiveContainer>
                  <BarChart data={growthMonthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} vertical={false} />
                    <XAxis dataKey="month" tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <YAxis tick={EJE_TICK} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v) => [Number(v).toLocaleString('es-CR'), 'Personas nuevas']} />
                    <Bar dataKey="total" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}

        {/* REP-8 · Quiénes asisten a cada sede. Sigue la semana elegida si hay
            una; si no, el año del reporte. */}
        {tab === 'demografia' && <DemografiaPorSede clave={claveSemana} year={report.year} />}

        {/* REP-8 · Las listas de la semana van AL FINAL y arrancan colapsadas:
            abiertas y arriba, empujaban todos los gráficos fuera de la pantalla
            apenas se elegía una semana. */}
        {tab === 'asistencia' && semanaSel && (
          <div className="mt-4">
            <ListasDeLaSemana clave={claveSemana} />
          </div>
        )}
      </ReportShell>
    </div>
  )
}

/** Mini-KPI compacto para la columna lateral del gráfico semanal. */
function MiniStat({ label, value, sub, tone = 'default' }: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'up' | 'down' | 'muted'
}) {
  const valueColor = tone === 'up' ? 'text-teal-deep' : tone === 'down' ? 'text-coral' : tone === 'muted' ? 'text-navy-light/80' : 'text-navy'
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[13px] text-navy-light/80 font-body">{label}</p>
      <p className={`text-sm font-extrabold tabular-nums font-display leading-none text-right ${valueColor}`}>
        {value}
        {sub && <span className="block text-[11px] font-normal text-navy-light/80 font-body mt-0.5">{sub}</span>}
      </p>
    </div>
  )
}
