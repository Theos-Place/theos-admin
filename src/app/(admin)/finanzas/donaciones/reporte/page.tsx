'use client'

/**
 * DON-3 parte B · «Donantes y montos».
 *
 * Vive en FINANZAS y no en /reportes porque los montos de donación son
 * confidenciales: /reportes lo abren roles de métricas.
 *
 * LO QUE CONTESTA: cuánta GENTE sostiene esto —no cuántos depósitos
 * entraron—, cuánto por moneda, y de qué sedes viene. Los donantes sin sede
 * salen como categoría propia porque son los que no aparecen por ninguna
 * charla, y eso es justamente lo que Meli quiere ver.
 *
 * LA DECISIÓN DE DISEÑO MÁS IMPORTANTE DE ESTA PANTALLA: cuando no hay
 * montos registrados NO se escribe «₡0». Medido el 2026-10-05, en producción
 * las 15 276 donaciones tienen monto cero o nulo —los importes todavía no se
 * importaron (DON-3 parte A)—. Un «₡0» en una pantalla de finanzas se lee
 * como «no entró plata», que es una afirmación falsa sobre algo delicado. Se
 * dice que faltan, y los conteos de personas —que sí son reales— se muestran
 * igual.
 */

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft, Download, Loader2, Heart, AlertTriangle } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import {
  totalesEnTexto, SIN_SEDE, type ReporteDeDonantes,
} from '@/lib/finance/reporte-de-donantes'
import { nombreDelMes } from '@/lib/servers/resumen-del-mes'

type Vista = 'anio' | 'mes' | 'sede'

const dinero = (m: number, c: string) => formatMoney(m, c)

function Contenido() {
  useTituloDePantalla('Donantes y montos', 'Finanzas')
  const toast = useToast()
  const [datos, setDatos] = useState<ReporteDeDonantes | null>(null)
  const [vista, setVista] = useState<Vista>('anio')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => {
    let vivo = true
    const u = new URLSearchParams()
    if (desde) u.set('desde', desde)
    if (hasta) u.set('hasta', hasta)
    fetch(`/api/finance/donaciones/reporte?${u.toString()}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (vivo) setDatos(d as ReporteDeDonantes) })
      .catch(() => { if (vivo) toast('No se pudo cargar el reporte.', 'error') })
    return () => { vivo = false }
  }, [desde, hasta, toast])

  if (!datos) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }

  const urlExport = () => {
    const u = new URLSearchParams({ export: '1' })
    if (desde) u.set('desde', desde)
    if (hasta) u.set('hasta', hasta)
    return `/api/finance/donaciones/reporte?${u.toString()}`
  }

  const filas = vista === 'sede'
    ? datos.porSede.map(s => ({ clave: s.sede, etiqueta: s.sede, ...s }))
    : (vista === 'anio' ? datos.porAnio : datos.porMes).map(p => ({
      clave: p.periodo,
      etiqueta: vista === 'mes' ? nombreDelMes(p.periodo) : p.periodo,
      ...p,
    }))
  const maxDonantes = Math.max(1, ...filas.map(f => f.donantes))

  return (
    <div className="space-y-5">
      <Link href="/finanzas/donaciones" className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Donaciones
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy font-display">Donantes y montos</h1>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            Cuánta gente sostiene esto, cuánto por moneda y de qué sedes viene.
          </p>
        </div>
        <Button href={urlExport()} variante="secundario" className="inline-flex items-center gap-1.5">
          <Download size={14} aria-hidden="true" /> Descargar Excel
        </Button>
      </div>

      {/* El aviso va ARRIBA de todo y en rojo: sin él, la pantalla parecería
          decir que no entró plata. */}
      {!datos.hayMontos && datos.total.donaciones > 0 && (
        <div className="rounded-2xl bg-coral/8 ring-1 ring-coral/30 p-4 flex items-start gap-2.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden="true" />
          <p className="text-sm text-navy font-body">
            <strong>Todavía no hay montos registrados.</strong> Las {datos.total.donaciones.toLocaleString('es-CR')}
            {' '}donaciones del rango están sin importe — eso se carga aparte (DON-3 parte A).
            Los conteos de personas de abajo <strong>sí son reales</strong>; los totales de
            plata van a aparecer cuando entren los montos.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="don-desde" className="mb-1 block text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
            Desde
          </label>
          <input id="don-desde" type="date" value={desde} max={hasta || undefined}
            onChange={e => { setDatos(null); setDesde(e.target.value) }}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body" />
        </div>
        <div>
          <label htmlFor="don-hasta" className="mb-1 block text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
            Hasta
          </label>
          <input id="don-hasta" type="date" value={hasta} min={desde || undefined}
            onChange={e => { setDatos(null); setHasta(e.target.value) }}
            className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body" />
        </div>
        {(desde || hasta) && (
          <button type="button"
            onClick={() => { setDatos(null); setDesde(''); setHasta('') }}
            className="rounded-xl px-2.5 py-2 text-[13px] text-navy-light/80 hover:text-navy hover:bg-surface-low transition-colors font-body">
            Limpiar
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-sm text-navy font-body">
          <strong>{datos.total.donantes.toLocaleString('es-CR')} personas</strong> donaron,
          en {datos.total.donaciones.toLocaleString('es-CR')} donaciones
          {datos.hayMontos && <> · <strong>{totalesEnTexto(datos.total.totales, dinero)}</strong></>}
        </p>
        {datos.hayMontos && datos.total.sinMonto > 0 && (
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            {/* Las sin monto NO suman cero: cero afirmaría que entró una
                donación de nada. */}
            {datos.total.sinMonto.toLocaleString('es-CR')} donaciones sin monto registrado,
            fuera de ese total.
          </p>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Agrupar el reporte">
        {([['anio', 'Por año'], ['mes', 'Por mes'], ['sede', 'Por sede']] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={vista === k}
            onClick={() => setVista(k)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-all duration-150 font-display',
              vista === k
                ? 'bg-navy text-white border-navy'
                : 'text-navy-light/80 hover:text-navy hover:bg-surface-low border-transparent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filas.length === 0 ? (
        <EmptyState icon={Heart} title="No hay donaciones en ese rango" />
      ) : (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[vista === 'sede' ? 'Sede del donante' : 'Período', 'Donantes', '', 'Donaciones', 'Totales'].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.clave} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-4 py-2.5 text-[13px] text-navy font-body whitespace-nowrap">
                      {f.etiqueta}
                      {f.clave === SIN_SEDE && (
                        <span className="block text-[11px] text-navy-light/80">
                          sin asistencias registradas
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-navy font-body tabular-nums">{f.donantes}</td>
                    <td className="px-4 py-2.5 w-40">
                      <span className="block h-3 rounded bg-coral/70"
                        style={{ width: `${Math.max(2, (f.donantes / maxDonantes) * 100)}%` }} />
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body tabular-nums">{f.donaciones}</td>
                    <td className="px-4 py-2.5 text-[13px] text-navy font-body whitespace-nowrap">
                      {totalesEnTexto(f.totales, dinero) || '—'}
                      {f.sinMonto > 0 && (
                        <span className="block text-[11px] text-navy-light/80">
                          {f.sinMonto} sin monto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[13px] text-navy-light/80 font-body">
        {/* Se dice explícito porque invita a restar y encontrar un descuadre
            que no existe. */}
        Los <strong>donantes</strong> de cada fila son personas únicas de esa fila: no suman
        el total, porque quien donó en dos meses cuenta en los dos. Los <strong>montos</strong>
        {' '}van por moneda y nunca se suman entre sí.
      </p>
    </div>
  )
}

export default function ReporteDeDonantesPage() {
  return (
    <FinanceGuard>
      <Suspense fallback={<div className="py-16 text-center text-sm text-navy-light/80 font-body">Cargando…</div>}>
        <Contenido />
      </Suspense>
    </FinanceGuard>
  )
}
