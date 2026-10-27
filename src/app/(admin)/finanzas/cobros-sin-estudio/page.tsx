'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Unlink, Loader2, Download } from 'lucide-react'
import { RangoDeFechas, Buscador } from '@/components/finance/BarraDeReporte'
import { BotonMostrarMontos } from '@/components/finance/BotonMostrarMontos'
import { AmountDisplay } from '@/components/finance/AmountDisplay'
import {
  BARRA, BARRA_IZQ, BARRA_DER, BOTON_PRIMARIO,
  TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO, VALOR_PENDIENTE,
} from '@/components/finance/reporte-ui'
import { descargarExcel, enRango } from '@/lib/finance/descargar-excel'
import { cn } from '@/lib/utils'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { hasModulePermission } from '@/lib/auth/roles'
import { formatDate } from '@/lib/format'
import {
  gravedadDe, queHacerCon, pideAccion, estaResuelto, type CobroHuerfano, type Gravedad,
} from '@/lib/finance/cobros-huerfanos'

/**
 * MAT-3 · Cobros de estudio que se quedaron sin estudio.
 *
 * Existen porque las FK de `payments` hacia la matrícula y el grupo son ON
 * DELETE SET NULL: borrar el grupo no borra el cobro, lo deja apuntando a
 * nada. Deja de salir en la pantalla del estudio y no vuelve a aparecer en
 * ningún lado. Los nueve que se encontraron el 2026-10-12 salieron porque
 * alguien los fue a buscar a mano; esta pantalla es para no depender de eso.
 *
 * El borrado ya no los crea (ver `lib/studies/borrar-grupo`), pero los que
 * hay siguen ahí y los que puedan aparecer por otro camino también.
 */
/**
 * PAG-6 · Dice «Cancelado» y no «Pagado» porque esta pantalla es de
 * FINANZAS: ahí «cancelar» es pagar. En «Mis pagos» el mismo estado se
 * escribe «Pagado», porque para la persona «cancelado» significa que se lo
 * anularon — lo contrario. Decisión de Floriana, confirmada el 2026-10-13.
 */
const ETIQUETA: Record<Gravedad, { texto: string; clase: string }> = {
  pagado:    { texto: 'Cancelado',   clase: 'bg-coral/10 text-coral-deep' },
  sin_dueno: { texto: 'Sin dueño',   clase: 'bg-coral/10 text-coral-deep' },
  pendiente: { texto: 'Pendiente',   clase: 'bg-teal/15 text-navy' },
  anulado:   { texto: 'Anulado',     clase: 'bg-navy-light/10 text-navy-light/80' },
  devuelto:  { texto: 'Devuelto',    clase: 'bg-navy-light/10 text-navy-light/80' },
}

export default function CobrosSinEstudioPage() {
  const { user, loaded } = useAuth()
  const puede = hasModulePermission(user?.roles ?? [], 'finanzas', 'view')

  const [items, setItems] = useState<CobroHuerfano[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Rango por la fecha en que el cobro quedó SUELTO, búsqueda y montos
  // ocultables: el orden de los reportes de finanzas (2026-10-19).
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [revealAll, setRevealAll] = useState(false)
  // Lo resuelto (anulado, devuelto o con crédito) no se muestra: la pantalla
  // es para lo que falta por hacer (Floriana, 2026-10-27). Se puede abrir.
  const [verResueltos, setVerResueltos] = useState(false)
  const resueltos = useMemo(() => items.filter(estaResuelto).length, [items])
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return items.filter(c => (verResueltos || !estaResuelto(c))
      && enRango(c.huerfanoDesde, desde, hasta)
      && (!q || (c.persona ?? '').toLowerCase().includes(q) || (c.concepto ?? '').toLowerCase().includes(q)))
  }, [items, desde, hasta, busqueda, verResueltos])

  useEffect(() => {
    if (!puede) return
    let vivo = true
    fetch('/api/finance/orphan-charges')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los cobros.')))
      .then(d => { if (vivo) setItems(d.items ?? []) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [puede])

  if (!loaded) return null
  if (!puede) return <AccessDenied />

  const porResolver = visibles.filter(pideAccion)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy font-display">Cobros sin estudio</h1>
        <p className="text-sm text-navy-light/80 font-body mt-1">
          Cobros de matrícula o folletos que quedaron sueltos al borrarse su grupo o su
          matrícula. No aparecen en la pantalla del estudio ni en la ficha del grupo, así que
          esta es la única forma de verlos.
        </p>
      </div>

      <div className={BARRA}>
        <div className={BARRA_IZQ}>
          <RangoDeFechas id="suelto" etiqueta="Suelto desde" desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        </div>
        <div className={BARRA_DER}>
          <BotonMostrarMontos visibles={revealAll} onCambio={() => setRevealAll(r => !r)} />
          <button type="button" disabled={visibles.length === 0} className={BOTON_PRIMARIO}
            onClick={() => void descargarExcel('cobros-sin-estudio', ['Estado', 'Persona', 'Monto', 'Moneda', 'Concepto', 'Suelto desde', 'Qué hacer'],
              visibles.map(c => [ETIQUETA[gravedadDe(c)].texto, c.persona ?? '', c.monto, c.currency ?? 'CRC', c.concepto ?? '',
                c.huerfanoDesde ? formatDate(c.huerfanoDesde) : '', queHacerCon(c)]))}>
            <Download size={14} aria-hidden /> Descargar Excel
          </button>
        </div>
      </div>

      {!cargando && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={TARJETA}>
            <p className={TARJETA_ETIQUETA}>Piden acción</p>
            <p className={cn(TARJETA_VALOR, VALOR_PENDIENTE)}>{porResolver.length}</p>
          </div>
          <div className={TARJETA}>
            <p className={TARJETA_ETIQUETA}>Ya resueltos</p>
            <p className={cn(TARJETA_VALOR, VALOR_NEUTRO)}>{resueltos}</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              Anulados, devueltos o convertidos en crédito.{' '}
              {resueltos > 0 && (
                <button type="button" onClick={() => setVerResueltos(v => !v)} className="underline hover:text-navy">
                  {verResueltos ? 'Ocultarlos' : 'Verlos'}
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      {!cargando && items.length > 0 && (
        <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por persona o concepto…" />
      )}

      {cargando ? (
        <div className="flex items-center gap-2 py-12 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span className="text-sm font-body">Buscando…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-coral-deep font-body" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Unlink}
          title="Ningún cobro quedó suelto"
          description="Todos los cobros de estudio cuelgan de su matrícula y su grupo, que es como tiene que ser."
        />
      ) : !verResueltos && items.every(estaResuelto) ? (
        <EmptyState
          icon={Unlink}
          title="Nada pide acción"
          description={`Los ${resueltos} cobros sueltos que hay ya están anulados, devueltos o convertidos en crédito.`}
        />
      ) : (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                {['Persona', 'Monto', 'Concepto', 'Suelto desde', 'Qué hacer'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 whitespace-nowrap font-display">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(c => {
                const g = gravedadDe(c)
                return (
                  <tr key={c.id} className="border-b border-[var(--outline-variant)] hover:bg-surface-low transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-display tracking-wide ${ETIQUETA[g].clase}`}>
                        {ETIQUETA[g].texto}
                      </span>
                      <span className="block mt-1 text-[13px] text-navy font-body">
                        {c.persona ?? 'Sin persona asignada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-navy font-body whitespace-nowrap">
                      <AmountDisplay amount={c.monto} currency={c.currency ?? 'CRC'} defaultHidden={false} revealed={revealAll} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{c.concepto ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">
                      {c.huerfanoDesde ? formatDate(c.huerfanoDesde) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body max-w-[320px]">
                      {queHacerCon(c)}
                    </td>
                  </tr>
                )
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-[13px] text-navy-light/80 font-body">Ningún cobro con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[13px] text-navy-light/80 font-body">
        Desde el 2026-10-12 un grupo con cobros sin cancelar no se puede borrar, así que la
        lista no debería crecer. Si crece, avisá: significa que hay otro camino.{' '}
        <Link href="/finanzas/pagos" className="underline hover:text-navy">Ir a pagos</Link>
      </p>
    </div>
  )
}
