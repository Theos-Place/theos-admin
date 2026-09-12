'use client'

/**
 * Becas ASIGNADAS (las que salen de aprobar una solicitud), con su estado y la
 * acción de moverlas a otro estudio.
 *
 * Por qué existe: finanzas no tenía dónde ver estas becas. La pestaña de
 * cupones pide `?kind=generica` y la de solicitudes muestra la SOLICITUD, no la
 * beca que salió de ella. Una beca aprobada y nunca usada era invisible — que
 * es justo lo que pasó cuando el grupo de Romanos se llenó con dos becas
 * vivas apuntando ahí.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { GraduationCap, Loader2, ArrowRightLeft, Search, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { usePublicEvents } from '@/hooks/useEvents'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney } from '@/lib/format'
import { formatDiscount } from '@/lib/finance/payment-breakdown'
import {
  FILTROS_USO, filtrarPorUso, conteosPorUso, ETIQUETA_USO, BADGE_USO, usoDeLaBeca,
  type FiltroUso,
} from '@/lib/finance/uso-de-beca'
import { planearMovimiento, avisoDelCambio, MENSAJE_BLOQUEO, type BecaParaMover } from '@/lib/finance/cambio-de-destino-beca'

export type BecaAsignada = {
  id: string
  kind: 'asignada' | 'generica'
  member_id: string | null
  member_name: string | null
  entity_type: 'study_plan' | 'event'
  plan_id: string | null
  event_id: string | null
  entity_name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  currency?: string | null
  status: 'active' | 'used' | 'revoked'
  used_at: string | null
  used_count: number
  created_at: string
  email_sent_at: string | null
}

type Destino = { id: string; nombre: string; cost: number | null; currency: string | null }

export function BecasAsignadasTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast()
  const [becas, setBecas] = useState<BecaAsignada[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroUso>('sin_usar')

  // El setState va DESPUÉS del await, no en el cuerpo del efecto: hacerlo
  // sincrónico dispara el render en cascada que marca react-hooks.
  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/scholarships/coupons?kind=asignada')
      setBecas(r.ok ? ((await r.json())?.items ?? []) : [])
    } catch {
      setBecas([])
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])
  const recargar = useCallback(() => { setCargando(true); cargar() }, [cargar])

  // Los conteos se cuentan sobre la lista COMPLETA: si dependieran del filtro
  // activo, las otras pastillas mostrarían cero.
  const conteo = useMemo(() => conteosPorUso(becas), [becas])
  const visibles = useMemo(() => filtrarPorUso(becas, filtro), [becas, filtro])

  const [mover, setMover] = useState<BecaAsignada | null>(null)

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {FILTROS_USO.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-all font-display',
              filtro === f.id ? 'bg-navy text-white border-navy' : 'text-navy-light/80 hover:text-navy border-transparent hover:border-navy/20',
            )}
          >
            {f.label}
            <span className={cn('ml-1.5', filtro === f.id ? 'text-white/80' : 'text-navy-light/80')}>{conteo[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)] mt-4">
        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-navy-light/80 font-body inline-flex items-center gap-2 justify-center w-full">
            <Loader2 size={15} className="animate-spin" /> Cargando…
          </p>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={becas.length === 0 ? 'No hay becas asignadas' : `No hay becas ${ETIQUETA_USO[filtro === 'todas' ? 'sin_usar' : filtro].toLowerCase()}`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Persona', 'Destino', 'Descuento', 'Estado', 'Aprobada', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((b, idx) => {
                  const uso = usoDeLaBeca(b)
                  return (
                    <tr key={b.id} className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
                      <td className="px-4 py-3 text-sm font-medium text-navy font-body">{b.member_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{b.entity_name}</td>
                      <td className="px-4 py-3 text-sm text-navy font-body whitespace-nowrap">
                        {formatDiscount(b.discount_type, b.discount_value, b.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display whitespace-nowrap', BADGE_USO[uso])}>
                          {ETIQUETA_USO[uso]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{formatDate(b.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && uso === 'sin_usar' && (
                          <button
                            onClick={() => setMover(b)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 text-navy px-3 py-1 text-[13px] hover:bg-navy/5 transition-colors font-body whitespace-nowrap"
                          >
                            <ArrowRightLeft size={13} /> Mover a otro estudio
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mover && (
        <MoverBecaModal
          beca={mover}
          onClose={() => setMover(null)}
          onDone={(msg) => { setMover(null); toast(msg, 'success'); recargar() }}
          onError={(msg) => toast(msg, 'error')}
        />
      )}
    </>
  )
}

/** Elegir el destino nuevo y avisarle a la persona. */
function MoverBecaModal({ beca, onClose, onDone, onError }: {
  beca: BecaAsignada
  onClose: () => void
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  // usePublicEvents: el rol 'becas' puede no tener el módulo de eventos y aun
  // así necesita listar destinos (mismo criterio que la pantalla de cupón nuevo).
  const { events } = usePublicEvents()
  const { studyTypes } = useStudyPlans()
  const [tipo, setTipo] = useState<'study_plan' | 'event'>('study_plan')
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<Destino | null>(null)
  const [motivo, setMotivo] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const PLANES: Destino[] = useMemo(
    () => studyTypes
      .filter(p => !p.is_archived && p.requires_payment && p.plan_id)
      .map(p => ({ id: p.plan_id!, nombre: `${p.code ?? ''} — ${p.name}`.trim(), cost: p.cost, currency: p.currency ?? 'CRC' })),
    [studyTypes],
  )
  const EVENTOS: Destino[] = useMemo(
    () => events.filter(e => e.requires_payment)
      .map(e => ({ id: e.id, nombre: e.name, cost: e.payment_amount ?? null, currency: 'CRC' })),
    [events],
  )
  const lista = tipo === 'study_plan' ? PLANES : EVENTOS
  const resultados = useMemo(() => {
    if (elegido) return []
    const t = q.trim().toLowerCase()
    return (t ? lista.filter(e => e.nombre.toLowerCase().includes(t)) : lista).slice(0, 8)
  }, [q, elegido, lista])

  // La misma regla que corre el servidor, para no ofrecer un movimiento que va
  // a rebotar y para mostrar el aviso ANTES de confirmar.
  const becaParaRegla: BecaParaMover = {
    kind: beca.kind, status: beca.status, entity_type: beca.entity_type,
    plan_id: beca.plan_id, event_id: beca.event_id,
    discount_type: beca.discount_type, discount_value: beca.discount_value,
    currency: beca.currency ?? 'CRC', used_count: beca.used_count,
  }
  const plan = elegido
    ? planearMovimiento(becaParaRegla, { entity_type: tipo, id: elegido.id, nombre: elegido.nombre, currency: elegido.currency, cost: elegido.cost })
    : null
  const aviso = elegido && plan
    ? avisoDelCambio(becaParaRegla, { entity_type: tipo, id: elegido.id, nombre: elegido.nombre, currency: elegido.currency, cost: elegido.cost }, plan)
    : null

  async function confirmar() {
    if (!elegido || !plan?.ok || guardando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/scholarships/${beca.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mover',
          entity_type: tipo,
          plan_id: tipo === 'study_plan' ? elegido.id : null,
          event_id: tipo === 'event' ? elegido.id : null,
          motivo: motivo.trim() || null,
          notificar,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo mover la beca.')
      onDone(notificar
        ? `Beca movida a ${d.entity_name}. Se le avisó por correo.`
        : `Beca movida a ${d.entity_name}.`)
    } catch (e) {
      setGuardando(false)
      onError(e instanceof Error ? e.message : 'No se pudo mover la beca.')
    }
  }

  return (
    <Modal onClose={onClose} titleId="mover-beca-title" width={520}>
      <div className="p-6 space-y-5">
        <div>
          <h2 id="mover-beca-title" className="text-base font-bold text-navy font-display">Mover la beca a otro estudio</h2>
          <p className="text-[13px] text-navy-light/80 mt-1 font-body">
            {beca.member_name} · {formatDiscount(beca.discount_type, beca.discount_value, beca.currency)} · hoy aplica a <strong className="text-navy">{beca.entity_name}</strong>
          </p>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-widest mb-2 block font-display text-navy-light/80">Destino nuevo</span>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([['study_plan', 'Estudio'], ['event', 'Evento']] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setTipo(v); setElegido(null); setQ('') }}
                className={cn('rounded-xl p-2.5 text-sm font-medium border transition-all font-body',
                  tipo === v ? 'border-coral bg-coral/5 text-coral' : 'border-outline bg-surface-low text-navy/80')}>
                {l}
              </button>
            ))}
          </div>

          {elegido ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-outline bg-surface-low px-3 py-2.5">
              <span className="text-sm text-navy font-body">
                {elegido.nombre}
                {elegido.cost != null && <span className="text-navy-light/80"> · {formatMoney(elegido.cost, elegido.currency)}</span>}
              </span>
              <button onClick={() => { setElegido(null); setQ('') }} aria-label="Cambiar destino" className="text-navy-light/80 hover:text-navy">
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" aria-hidden />
                <input
                  value={q} onChange={e => setQ(e.target.value)}
                  aria-label="Buscar estudio o evento"
                  placeholder={tipo === 'study_plan' ? 'Buscar un estudio…' : 'Buscar un evento…'}
                  className="w-full rounded-xl border border-outline bg-surface-card pl-9 pr-3 py-2.5 text-sm text-navy font-body"
                />
              </div>
              <ul className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-outline divide-y divide-[var(--outline-variant)]">
                {resultados.length === 0 && (
                  <li className="px-3 py-3 text-[13px] text-navy-light/80 font-body">Nada que coincida.</li>
                )}
                {resultados.map(d => (
                  <li key={d.id}>
                    <button onClick={() => setElegido(d)} className="w-full text-left px-3 py-2.5 text-sm text-navy hover:bg-surface-low transition-colors font-body">
                      {d.nombre}
                      {d.cost != null && <span className="text-navy-light/80"> · {formatMoney(d.cost, d.currency)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {plan && !plan.ok && (
          <p className="rounded-xl bg-coral-soft/20 px-3 py-2.5 text-[13px] text-coral-deep font-body">{MENSAJE_BLOQUEO[plan.error]}</p>
        )}
        {aviso && (
          <p className="rounded-xl bg-[rgba(233,185,73,0.15)] px-3 py-2.5 text-[13px] text-navy font-body">{aviso}</p>
        )}

        <div>
          <label htmlFor="motivo-mover" className="text-[11px] uppercase tracking-widest mb-2 block font-display text-navy-light/80">
            Por qué se mueve (va en el correo)
          </label>
          <input
            id="motivo-mover" value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="El grupo de Romanos se llenó."
            className="w-full rounded-xl border border-outline bg-surface-card px-3 py-2.5 text-sm text-navy font-body"
          />
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-navy font-body">
          <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)} className="mt-0.5" />
          <span>
            Avisarle por correo
            <span className="block text-navy-light/80">Ya recibió un correo que nombra {beca.entity_name}: sin este aviso va a buscar ese estudio.</span>
          </span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!elegido || !plan?.ok || guardando}
            className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-50"
          >
            {guardando ? 'Moviendo…' : 'Mover la beca'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
