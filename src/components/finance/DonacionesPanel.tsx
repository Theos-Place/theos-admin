'use client'

import { useState, useEffect } from 'react'
import { Heart, Upload, Search, AlertTriangle, Check, Plus, BarChart2, Download } from 'lucide-react'
import { BotonMostrarMontos } from '@/components/finance/BotonMostrarMontos'
import {
  PESTANA, BARRA, BARRA_IZQ, BARRA_DER, GRUPO_FILTRO, ETIQUETA_FILTRO, CAMPO, CAMPO_FECHA, BOTON_SECUNDARIO, BOTON_PRIMARIO, BOTON_ACENTO,
  TARJETAS, TARJETA, TARJETA_ETIQUETA, TARJETA_VALOR, VALOR_NEUTRO, VALOR_DINERO,
  CAJA_TABLA, TH, TD, FILA, CELDA, CELDA_FUERTE, CARGAR_MAS,
} from '@/components/finance/reporte-ui'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { AgregarDonacionModal } from '@/components/finance/AgregarDonacionModal'
import { FilterChips } from '@/components/shared/FilterChips'
import { AmountDisplay, TotalsDisplay } from '@/components/finance/AmountDisplay'
import { toCurrency, type MoneyTotals } from '@/lib/money'
import { useDonations, urlDeDonaciones } from '@/hooks/useDonations'
import { toDomainDonation } from '@/lib/finance/adapter'
import type { Donation } from '@/types/finance'
import type { DbDonation } from '@/lib/supabase/queries/finance'
import { TOAST_MS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { generateCSV } from '@/lib/export'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'
import { explicacionDeDonantes } from '@/lib/finance/ventana-de-donante'

type StatusFilter = 'all' | 'identified' | 'unidentified'

/**
 * DON-4 · La gestión de donaciones, como pestaña del reporte de finanzas.
 *
 * Era la pantalla /finanzas/donaciones. Floriana (2026-10-14): «podría
 * incluirse en el primer tab del reporte y así eliminar la pantalla, sin
 * perder ninguna funcionalidad». Acá está TODO lo que hacía: stats, búsqueda
 * paginada (de 50 en 50), rango, identificar las sin identificar, alta
 * manual, importar, el reporte de donantes y el CSV del resultado filtrado.
 */
export function DonacionesPanel() {
  const [revealAll, setRevealAll] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // Debounce de la búsqueda (server-side): no refetch por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const params = { search, status: statusFilter, from: dateFrom, to: dateTo }
  // Lo dice el servidor: null en un monto es «restringido» para quien no
  // tiene finanzas, y «no conocido» para quien sí (2026-10-14).
  const { donations, total, stats, filteredSum, amountsVisible, loading, error, hasMore, loadMore, refetch } =
    useDonations(params)

  const [showUnidentifiedModal, setShowUnidentifiedModal] = useState(false)
  // DON-2 · alta manual de una donación.
  const [agregando, setAgregando] = useState(false)
  const [unidentified, setUnidentified] = useState<Donation[]>([])
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkConfirm, setLinkConfirm] = useState<{ donationId: string; memberId: string; memberName: string } | null>(null)
  const [toast, setToast] = useState('')
  const [exportando, setExportando] = useState(false)

  // El modal carga las donaciones sin identificar aparte (no están en la lista
  // paginada salvo que el filtro sea 'unidentified').
  useEffect(() => {
    if (!showUnidentifiedModal) return
    let alive = true
    fetch('/api/finance/donations?status=unidentified&pageSize=200')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { donations: DbDonation[] } | null) => {
        if (alive && d) setUnidentified((d.donations ?? []).map(toDomainDonation))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [showUnidentifiedModal])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), TOAST_MS)
  }

  const uniqueDonors = stats?.unique_donors ?? 0
  const activeDonors = stats?.active_donors ?? 0
  const totalThisMonth = stats?.total_this_month ?? null
  const unidentifiedCount = stats?.unidentified_count ?? 0
  const unidentifiedTotal = stats?.unidentified_total ?? null

  async function handleLink(donationId: string, memberId: string, memberName: string) {
    setUnidentified(prev => prev.filter(d => d.id !== donationId))
    setLinkingId(null)
    try {
      const res = await fetch(`/api/finance/donations/${donationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast(`Donación vinculada a ${memberName}`)
      refetch()
    } catch (err) {
      console.error('No se pudo vincular la donación:', err)
      showToast('No se pudo vincular la donación. Intentá de nuevo.')
      refetch()
    }
  }

  /** El CSV sale con TODO lo que cumple los filtros, no solo lo cargado en
   *  pantalla: el reporte viejo exportaba el rango completo y eso no se pierde. */
  async function exportarCSV() {
    setExportando(true)
    try {
      const r = await fetch(urlDeDonaciones(params, { all: true }))
      if (!r.ok) throw new Error('No se pudo exportar')
      const d = (await r.json()) as { donations: DbDonation[] }
      const filas = (d.donations ?? []).map(toDomainDonation)
      generateCSV(
        // INT-3: el monto NUNCA sale sin su moneda.
        ['ID', 'Miembro', 'Cédula', 'Fecha', 'Monto', 'Moneda', 'Lote', 'Estado'],
        filas.map(x => [x.id, x.member_name, x.member_cedula, x.donation_date, x.amount, toCurrency(x.currency), x.source_file, x.is_identified ? 'Identificado' : 'Sin identificar']),
        'reporte-donaciones',
      )
    } catch {
      showToast('No se pudo exportar. Intentá de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <>
      <div className={PESTANA}>
        {/* Acciones. Orden pedido por Floriana (2026-10-14): a la izquierda el
            rango, Agregar e Importar; a la derecha Donantes y montos, Mostrar
            montos y Exportar — igual que en las otras dos pestañas. */}
        <div className={BARRA}>
          <div className={BARRA_IZQ}>
            <label className={GRUPO_FILTRO}>
              <span className={ETIQUETA_FILTRO}>Desde</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Donaciones desde" className={CAMPO_FECHA} />
            </label>
            <label className={GRUPO_FILTRO}>
              <span className={ETIQUETA_FILTRO}>Hasta</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Donaciones hasta" className={CAMPO_FECHA} />
            </label>
            <button type="button" onClick={() => setAgregando(true)} className={BOTON_SECUNDARIO}>
              <Plus size={14} aria-hidden /> Agregar donación
            </button>
            <Link href="/finanzas/donaciones/importar" className={BOTON_ACENTO}>
              <Upload size={14} aria-hidden /> Importar donaciones
            </Link>
          </div>
          <div className={BARRA_DER}>
            {/* DON-3B · El reporte de donantes y montos. */}
            <Link href="/finanzas/donaciones/reporte" className={BOTON_SECUNDARIO}>
              <BarChart2 size={14} aria-hidden /> Donantes y montos
            </Link>
            <BotonMostrarMontos visibles={revealAll} onCambio={() => setRevealAll(r => !r)} />
            <button type="button" onClick={exportarCSV} disabled={exportando} className={BOTON_PRIMARIO}>
              <Download size={14} aria-hidden /> {exportando ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className={TARJETAS}>
          {[
            // Pedido de Floriana (2026-10-14): que cada número diga a qué se refiere.
            { label: 'Donantes identificados', value: uniqueDonors, isAmount: false,
              info: 'Personas distintas que alguna vez donaron y a las que se les pudo identificar (la donación está vinculada a su ficha). Cuenta toda la historia, no un período, y cada persona una sola vez aunque haya donado muchas veces.' },
            { label: 'Total donado este mes', value: totalThisMonth, isAmount: true, info: null },
            // FIN-1/FIN-10: la ventana vive en ventana-de-donante.ts y en
            // refresh_donor_flags(); la explicación sale de ahí, no a mano.
            { label: 'Donantes activos', value: activeDonors, isAmount: false, info: explicacionDeDonantes(new Date()) },
          ].map(({ label, value, isAmount, info }) => (
            <div key={label} className={TARJETA}>
              <p className={TARJETA_ETIQUETA}>
                {label}{info && <InfoDelEncabezado texto={info} />}
              </p>
              {isAmount
                ? <p className={`${TARJETA_VALOR} ${VALOR_DINERO}`}>
                    {/* INT-3: una línea por moneda; con una sola se ve igual que antes. */}
                    <TotalsDisplay totals={value as MoneyTotals | null} defaultHidden={false} revealed={revealAll} />
                  </p>
                : <p className={`${TARJETA_VALOR} ${VALOR_NEUTRO}`}>{(value as number).toLocaleString('es-CR')}</p>
              }
            </div>
          ))}
        </div>

        {/* Sin identificar */}
        {unidentifiedCount > 0 && (
          <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[rgba(233,185,73,0.10)] border border-[rgba(233,185,73,0.25)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-[#E9B949] shrink-0 mt-[1px]" />
              <div>
                <p className="text-[13px] font-semibold font-body text-[#9B7200]">
                  {unidentifiedCount} donación{unidentifiedCount !== 1 ? 'es' : ''} sin identificar — <TotalsDisplay totals={unidentifiedTotal} defaultHidden={false} revealed={revealAll} /> en total
                </p>
                <p className="text-[13px] mt-0.5 text-[#9B7200] font-body">
                  Vinculalas manualmente a un miembro para que queden registradas correctamente.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnidentifiedModal(true)}
              className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all bg-[rgba(233,185,73,0.20)] text-[#9B7200] font-body border border-[rgba(233,185,73,0.30)]"
            >
              Resolver manualmente →
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`${CAMPO} flex flex-1 min-w-48 items-center gap-2`}>
            <Search size={14} className="text-navy-light/80 shrink-0" />
            <input
              type="search"
              placeholder="Buscar por nombre o cédula..."
              aria-label="Buscar por nombre o cédula"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none font-body text-navy"
            />
          </div>
          <FilterChips
            ariaLabel="Filtrar por estado de identificación"
            activeKey={statusFilter}
            onSelect={k => setStatusFilter(k as StatusFilter)}
            chips={[
              { key: 'all', label: 'Todos' },
              { key: 'identified', label: 'Identificado' },
              { key: 'unidentified', label: 'No identificado' },
            ]}
          />
        </div>

        {/* Tabla */}
        <div className={CAJA_TABLA}>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Cédula', 'Fecha', 'Monto', 'Lote importación', 'Estado'].map(h => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donations.map(d => (
                  <tr key={d.id} className={FILA}>
                    <td className={TD}>
                      <p className={`text-[13px] font-medium font-body ${d.is_identified ? 'text-navy' : 'text-coral-deep'}`}>{d.member_name || 'Sin identificar'}</p>
                    </td>
                    <td className={TD}><p className={CELDA}>{d.member_cedula}</p></td>
                    <td className={TD}><p className={`${CELDA} whitespace-nowrap`}>{formatDate(d.donation_date)}</p></td>
                    <td className={TD}>
                      <p className={CELDA_FUERTE}>
                        <AmountDisplay amount={d.amount} currency={d.currency} revealed={revealAll} restricted={!amountsVisible} />
                      </p>
                    </td>
                    <td className={TD}><p className={CELDA}>{d.source_file}</p></td>
                    <td className={TD}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium ${d.is_identified ? 'bg-success/10 text-[#1E6B42]' : 'bg-coral/10 text-coral-deep'}`}>
                        {d.is_identified ? 'Identificado' : 'Sin identificar'}
                      </span>
                    </td>
                  </tr>
                ))}
                {donations.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6}>
                      {error
                        ? <ErrorState message={error} onRetry={refetch} />
                        : <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="md:hidden">
            {donations.map((d, i) => (
              <li key={d.id} className="px-4 py-3 flex items-center gap-3"
                style={i < donations.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-medium font-body truncate ${d.is_identified ? 'text-navy' : 'text-coral-deep'}`}>{d.member_name || 'Sin identificar'}</p>
                  <p className="text-[13px] text-navy-light/80 font-body truncate">{d.member_cedula} · {formatDate(d.donation_date)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[13px] font-medium font-body text-navy">
                    <AmountDisplay amount={d.amount} currency={d.currency} revealed={revealAll} restricted={!amountsVisible} />
                  </p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${d.is_identified ? 'bg-success/10 text-[#1E6B42]' : 'bg-coral/10 text-coral-deep'}`}>
                    {d.is_identified ? 'Identificado' : 'Sin identificar'}
                  </span>
                </div>
              </li>
            ))}
            {donations.length === 0 && !loading && (
              <li>
                {error
                  ? <ErrorState message={error} onRetry={refetch} />
                  : <EmptyState icon={Heart} title="No hay donaciones que coincidan con los filtros" />}
              </li>
            )}
          </ul>
        </div>

        {/* Paginación / contador */}
        {donations.length > 0 && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-navy-light/80 font-body">
              Mostrando {donations.length.toLocaleString('es-CR')} de {total.toLocaleString('es-CR')} donaciones
              {filteredSum != null && (
                <> · Total filtrado: <TotalsDisplay totals={filteredSum} defaultHidden={false} revealed={revealAll} /></>
              )}
            </p>
            {hasMore && (
              <button onClick={loadMore} disabled={loading}
                className={CARGAR_MAS}>
                {loading ? 'Cargando…' : 'Cargar 50 más'}
              </button>
            )}
          </div>
        )}
      </div>

      {showUnidentifiedModal && (
        <Modal onClose={() => { setShowUnidentifiedModal(false); setLinkingId(null) }} titleId="donaciones-sin-identificar" width={576}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
            <p id="donaciones-sin-identificar" className="text-sm font-bold font-display text-navy">
              Donaciones sin identificar ({unidentifiedCount})
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {unidentified.map(d => (
              <div key={d.id} className="border-b px-6 py-4 space-y-3 border-[var(--outline-variant)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium font-body text-navy">
                      {formatDate(d.donation_date)} — <AmountDisplay amount={d.amount} currency={d.currency} defaultHidden={false} restricted={!amountsVisible} />
                    </p>
                    <p className="text-[13px] text-navy-light/80 font-body">{d.source_file}</p>
                  </div>
                  <button onClick={() => setLinkingId(linkingId === d.id ? null : d.id)}
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-all bg-[rgba(81,157,162,0.10)] text-teal-ink font-body border border-[rgba(81,157,162,0.20)]">
                    {linkingId === d.id ? 'Cancelar' : 'Vincular a miembro'}
                  </button>
                </div>
                {linkingId === d.id && (
                  <MemberCombobox autoFocus pageSize={6} placeholder="Buscar miembro por nombre o cédula..."
                    onSelect={m => setLinkConfirm({ donationId: d.id, memberId: m.id, memberName: `${m.first_name} ${m.last_name}`.trim() })} />
                )}
              </div>
            ))}
            {unidentified.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-navy-light/80 font-body">No hay donaciones sin identificar.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Confirmación de vínculo: reasigna la donación al miembro (sin deshacer en la UI). */}
      {linkConfirm && (
        <Modal onClose={() => setLinkConfirm(null)} titleId="vincular-donacion-titulo" width={400}>
          <div className="p-5 space-y-4">
            <h3 id="vincular-donacion-titulo" className="font-semibold text-navy font-display">Vincular donación</h3>
            <p className="text-sm text-navy-light/80 font-body">
              ¿Vincular esta donación a <strong>{linkConfirm.memberName}</strong>? La donación quedará identificada a su nombre.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { handleLink(linkConfirm.donationId, linkConfirm.memberId, linkConfirm.memberName); setLinkConfirm(null) }}
                className="flex-1 rounded-full bg-teal-deep px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity font-body">
                Vincular
              </button>
              <button onClick={() => setLinkConfirm(null)}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body">
          <Check size={15} className="text-success-deep" />
          {toast}
        </div>
      )}
      {agregando && (
        <AgregarDonacionModal onClose={() => setAgregando(false)} onCreada={() => refetch()} />
      )}
    </>
  )
}
