'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { useAuth } from '@/hooks/useAuth'
import { resolveRefundScope } from '@/lib/auth/refunds-scope'
import { sumByCurrency } from '@/lib/money'
import { AmountDisplay, TotalsDisplay } from '@/components/finance/AmountDisplay'
import { type Refund, type RefundStatus } from '@/types/finance'
import { toDomainRefund } from '@/lib/finance/adapter'
import type { DbRefund } from '@/lib/supabase/queries/finance'
import { refundKindLabel, REFUND_KINDS, kindHasPlan, type RefundKind } from '@/lib/finance/refund-kind'
import { FilterChips } from '@/components/shared/FilterChips'
import { useToast } from '@/components/shared/Toast'
import { formatDate, formatMoney } from '@/lib/format'

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const cfg: Record<RefundStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Pendiente',   color: '#E9B949', bg: 'rgba(233,185,73,0.15)'  },
    processing: { label: 'En proceso',  color: '#3B7579', bg: 'rgba(81,157,162,0.12)'  },
    completed:  { label: 'Completada',  color: '#3DB97A', bg: 'rgba(61,185,122,0.12)'  },
    rejected:   { label: 'Rechazada',   color: '#C43635', bg: 'rgba(239,85,84,0.10)'   },
    convertida_donacion: { label: 'Convertida en donación', color: '#7C5EC2', bg: 'rgba(155,127,212,0.15)' },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium"
      style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}

export default function DevolucionesPage() {
  const { user, loaded: authLoaded } = useAuth()
  const scope = resolveRefundScope({
    roles: user?.roles ?? [],
    managedEventIds: user?.managed_event_ids ?? [],
  })
  // FIN-6: fetch propio en vez de useFinance porque ahora la cola lleva FILTROS
  // server-side (tipo y plan) y necesita saber si esta persona puede resolver
  // (finanzas) o solo ver y comentar (responsable del origen).
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [canResolve, setCanResolve] = useState(false)
  const [kindFilter, setKindFilter] = useState<'all' | RefundKind>('all')
  const [planFilter, setPlanFilter] = useState<'all' | string>('all')
  const [reloadKey, setReloadKey] = useState(0)
  const refetch = () => { setReloadKey(k => k + 1); return Promise.resolve() }

  // `loading` se DERIVA (qué pedimos vs qué ya cargó) en vez de setearse dentro
  // del efecto: así el estado solo se toca en callbacks y no hay renders en
  // cascada.
  const queryKey = `${kindFilter}|${planFilter}|${reloadKey}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== queryKey

  useEffect(() => {
    let alive = true
    const u = new URLSearchParams()
    if (kindFilter !== 'all') u.set('kind', kindFilter)
    if (planFilter !== 'all') u.set('plan_id', planFilter)
    fetch(`/api/finance/refunds?${u.toString()}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => {
        if (!alive) return
        setRefunds(((d.refunds ?? []) as DbRefund[]).map(toDomainRefund))
        setCanResolve(!!d.can_resolve)
      })
      .catch(() => { if (alive) setRefunds([]) })
      .finally(() => { if (alive) setLoadedKey(queryKey) })
    return () => { alive = false }
  }, [kindFilter, planFilter, queryKey])

  // Planes presentes en la cola: el filtro por plan solo tiene sentido con los
  // tipos que salen de un plan, y solo con los que realmente hay.
  const planesEnCola = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of refunds) if (r.plan_id && r.plan_name) m.set(r.plan_id, r.plan_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [refunds])

  const [completeTarget, setCompleteTarget] = useState<Refund | null>(null)
  // FIN-6 (4): conversión en donación, con confirmación explícita del monto.
  const [convertTarget, setConvertTarget] = useState<Refund | null>(null)
  const [converting, setConverting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)
  const [completionDate, setCompletionDate] = useState('')
  const [completionConf, setCompletionConf] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const toast = useToast()

  // FASE FUTURA: devoluciones automáticas por pasarela (tarjeta) y SINPE
  // directo no existen aún — hoy TODO se procesa manualmente (tiquetes de
  // miembros por comprobante o registrados a mano), en una sola cola.
  const REFUND_METHOD_LABEL: Record<string, string> = {
    comprobante: 'Comprobante', cash: 'Efectivo', scholarship: 'Beca', sinpe: 'SINPE', card: 'Tarjeta',
  }

  const stats = useMemo(() => ({
    pending:    refunds.filter(r => r.status === 'pending').length,
    processing: refunds.filter(r => r.status === 'processing').length,
    completed:  refunds.filter(r => r.status === 'completed').length,
    // INT-3: por moneda; una devolución en euros no se suma con una en colones.
    totalAmount: sumByCurrency(refunds.filter(r => r.status === 'completed')),
  }), [refunds])

  async function handleComplete() {
    if (!completeTarget || !completionDate || !completionConf.trim()) return
    const target = completeTarget
    const body = {
      status: 'completed',
      processed_date: completionDate,
      confirmation: completionConf.trim(),
    }
    setCompleteTarget(null)
    setCompletionDate('')
    setCompletionConf('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await refetch()
      toast(`Devolución completada para ${target.member_name}`, 'success')
    } catch {
      toast('No se pudo completar la devolución. Intentá de nuevo.', 'error')
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return
    const target = rejectTarget
    const body = { status: 'rejected', reject_reason: rejectReason.trim() }
    setRejectTarget(null)
    setRejectReason('')
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await refetch()
      toast(`Devolución rechazada para ${target.member_name}`, 'success')
    } catch {
      toast('No se pudo rechazar la devolución. Intentá de nuevo.', 'error')
    }
  }

  async function handleConvert() {
    if (!convertTarget || converting) return
    const target = convertTarget
    setConverting(true)
    try {
      const res = await fetch(`/api/finance/refunds/${target.id}/convert-to-donation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // El monto confirmado viaja para que el server rechace la conversión si
        // cambió desde que se abrió la pantalla.
        body: JSON.stringify({ confirm_amount: target.amount }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo convertir la devolución.')
      setConvertTarget(null)
      await refetch()
      toast(`Convertida en donación: ${formatMoney(target.amount, target.currency)} de ${target.member_name}.`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo convertir la devolución.', 'error')
    } finally {
      setConverting(false)
    }
  }

  // FIN-6: la página ya no es solo de finanzas — también entra el responsable
  // del origen. El gate real es el 403 del GET; esto es UX.
  if (!authLoaded) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/80">Cargando…</p>
      </div>
    )
  }
  if (scope.access === 'none') return <AccessDenied />

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-3 bg-navy shadow-[var(--shadow-md)]"
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.10)]">
            <ArrowLeftRight size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-white font-display font-extrabold tracking-[-0.02em]">Devoluciones</h1>
            <p className="text-[13px] text-white/80 mt-0.5 font-body">
              Gestión de reembolsos y devoluciones
            </p>
          </div>
        </div>

        {/* FIN-6: filtros por tipo (derivado del pago) y, si el tipo sale de un
            plan, por plan de estudio. Antes la cola no tenía ningún filtro. */}
        <div className="space-y-2">
          <FilterChips
            ariaLabel="Filtrar por tipo"
            activeKey={kindFilter}
            onSelect={k => { setKindFilter(k as 'all' | RefundKind); setPlanFilter('all') }}
            chips={[
              { key: 'all', label: 'Todos los tipos' },
              ...REFUND_KINDS.map(k => ({ key: k, label: refundKindLabel(k) })),
            ]}
          />
          {kindHasPlan(kindFilter) && planesEnCola.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="plan-filter" className="text-[13px] text-navy-light/80 font-body">Estudio:</label>
              <select
                id="plan-filter"
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value)}
                className="rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              >
                <option value="all">Todos</option>
                {planesEnCola.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          {!canResolve && (
            <p className="text-[13px] text-navy-light/80 font-body">
              Ves las devoluciones de lo que tenés a cargo y podés comentarlas. Resolverlas es de finanzas.
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pendientes',    value: stats.pending,    color: '#E9B949' },
            { label: 'En proceso',    value: stats.processing, color: '#3B7579' },
            { label: 'Completadas',   value: stats.completed,  color: '#3DB97A' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
              <p className="text-[11px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">{label}</p>
              <p className="text-4xl font-extrabold font-display" style={{ color }}>{value}</p>
            </div>
          ))}
          <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[11px] uppercase tracking-widest mb-2 font-display text-[rgba(22,20,64,0.60)]">Total devuelto</p>
            <p className="text-xl font-extrabold font-display text-navy">
              <TotalsDisplay totals={stats.totalAmount} defaultHidden={false} />
            </p>
          </div>
        </div>

        {/* Cola única de devoluciones (todas se procesan manualmente hoy). */}
        <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--outline-variant)]">
            <p className="text-sm font-bold font-display text-navy">
              Devoluciones
            </p>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium bg-[rgba(239,85,84,0.10)] text-coral">
              Proceso manual
            </span>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {['Miembro', 'Concepto', 'Monto', 'Método', 'Motivo', 'Estado', 'Solicitada', 'Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] uppercase tracking-widest font-display text-[rgba(22,20,64,0.60)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refunds.map((r, i) => (
                  <tr key={r.id} className={`border-b border-[var(--outline-variant)] hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(22,20,64,0.01)]'}`}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">{r.member_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-body text-navy">{r.entity_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium font-body text-navy">
                        <AmountDisplay amount={r.amount} currency={r.currency} defaultHidden={false} />
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{REFUND_METHOD_LABEL[r.method] ?? r.method}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body">{r.reason}</p>
                    </td>
                    <td className="px-5 py-3.5"><RefundStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] whitespace-nowrap text-[rgba(22,20,64,0.55)] font-body">{formatDate(r.requested_at)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {canResolve && (r.status === 'pending' || r.status === 'processing') && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setCompleteTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap border-[rgba(61,185,122,0.30)] text-[#3DB97A] font-body"
                          >
                            Completar
                          </button>
                          <button
                            onClick={() => setRejectTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                          >
                            Rechazar
                          </button>
                          {/* FIN-6 (4): la persona no quiere el reembolso. */}
                          <button
                            onClick={() => setConvertTarget(r)}
                            className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap border-[rgba(155,127,212,0.35)] text-[#7C5EC2] font-body"
                          >
                            Convertir en donación
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {refunds.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">{loading ? 'Cargando…' : 'Sin devoluciones'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="md:hidden">
            {refunds.map((r, i) => (
              <li
                key={r.id}
                className="px-4 py-3 space-y-2.5"
                style={i < refunds.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium font-body text-navy truncate">{r.member_name}</p>
                    <p className="text-[13px] text-[rgba(22,20,64,0.55)] font-body truncate">{r.entity_name}</p>
                    {r.reason && <p className="text-[13px] text-[rgba(22,20,64,0.60)] font-body mt-0.5">{r.reason}</p>}
                    <p className="text-[13px] text-[rgba(22,20,64,0.45)] font-body mt-0.5">Solicitada {formatDate(r.requested_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[13px] font-medium font-body text-navy">
                      <AmountDisplay amount={r.amount} currency={r.currency} defaultHidden={false} />
                    </p>
                    <RefundStatusBadge status={r.status} />
                  </div>
                </div>
                {(r.status === 'pending' || r.status === 'processing') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setCompleteTarget(r)}
                      className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap border-[rgba(61,185,122,0.30)] text-[#3DB97A] font-body"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => setRejectTarget(r)}
                      className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors whitespace-nowrap border-[rgba(239,85,84,0.30)] text-coral font-body"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {refunds.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[rgba(22,20,64,0.35)] font-body">{loading ? 'Cargando…' : 'Sin devoluciones'}</li>
            )}
          </ul>
        </div>
      </div>

      {/* Complete modal */}
      {completeTarget && (
        <Modal onClose={() => setCompleteTarget(null)} titleId="completar-devolucion" width={448}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="completar-devolucion" className="text-sm font-bold font-display text-navy">Marcar devolución completada</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">
                Devolución de <strong>{formatMoney(completeTarget.amount, completeTarget.currency)}</strong> a <strong>{completeTarget.member_name}</strong>
              </p>
              <div>
                <label htmlFor="fecha-de-transferencia" className="text-[13px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Fecha de transferencia</label>
                <input id="fecha-de-transferencia" type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
              <div>
                <label htmlFor="numero-de-confirmacion" className="text-[13px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Número de confirmación</label>
                <input id="numero-de-confirmacion" type="text" value={completionConf} onChange={e => setCompletionConf(e.target.value)}
                  placeholder="ej. SINPE-2026-05-DV-99123"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
              <button onClick={() => setCompleteTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
                Cancelar
              </button>
              <button onClick={handleComplete}
                disabled={!completionDate || !completionConf.trim()}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-[#3DB97A] font-body disabled:opacity-40 disabled:cursor-not-allowed">
                Confirmar
              </button>
            </div>
        </Modal>
      )}

      {/* FIN-6 (4): confirmación de la conversión, con el monto a la vista.
          Contabilidad confirmó la mecánica (2026-08-21). */}
      {convertTarget && (
        <Modal onClose={() => !converting && setConvertTarget(null)} titleId="convertir-donacion" width={448}>
          <div className="p-6 space-y-4">
            <p id="convertir-donacion" className="text-base font-bold text-navy font-display">
              Convertir en donación
            </p>
            <p className="text-sm text-navy-light/80 font-body">
              <strong className="text-navy">{convertTarget.member_name}</strong> no quiere el reembolso:
              el monto queda como donación a su nombre.
            </p>
            <div className="rounded-xl border border-outline px-3 py-2.5">
              <p className="text-[13px] uppercase tracking-wider text-navy-light/80 font-display">Monto</p>
              <p className="text-2xl font-bold text-navy font-display">
                {formatMoney(convertTarget.amount, convertTarget.currency)}
              </p>
            </div>
            <ul className="space-y-1 text-[13px] text-navy-light/80 font-body list-disc pl-5">
              <li>Se crea la donación con la fecha de hoy, ligada a la persona.</li>
              <li>La devolución queda resuelta como <strong className="text-navy">convertida en donación</strong> (no se borra).</li>
              <li>El pago original deja de contar como cobrado, para no contar la plata dos veces.</li>
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConvertTarget(null)}
                disabled={converting}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors disabled:opacity-50 font-body"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-body bg-[#7C5EC2]"
              >
                {converting ? 'Convirtiendo…' : `Convertir ${formatMoney(convertTarget.amount, convertTarget.currency)} en donación`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)} titleId="rechazar-devolucion" width={448}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline-variant)]">
              <p id="rechazar-devolucion" className="text-sm font-bold font-display text-navy">Rechazar devolución</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] font-body text-[rgba(22,20,64,0.70)]">
                Rechazando devolución de <strong>{rejectTarget.member_name}</strong>
              </p>
              <div>
                <label htmlFor="motivo-del-rechazo" className="text-[13px] uppercase tracking-widest mb-1.5 block font-display text-[rgba(22,20,64,0.60)]">Motivo del rechazo</label>
                <textarea id="motivo-del-rechazo" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  rows={3} placeholder="Explicá el motivo..."
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none border-[var(--outline-variant)] font-body text-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 border-[var(--outline-variant)]">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-full border py-2.5 text-sm border-[var(--outline-variant)] font-body text-[rgba(22,20,64,0.70)]">
                Cancelar
              </button>
              <button onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 rounded-full py-2.5 text-sm text-white bg-coral font-body disabled:opacity-40 disabled:cursor-not-allowed">
                Rechazar
              </button>
            </div>
        </Modal>
      )}

    </>
  )
}
