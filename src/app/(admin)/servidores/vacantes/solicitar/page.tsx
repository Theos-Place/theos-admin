'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronLeft, Minus, Plus, ShoppingCart, Check, CalendarClock, Lock, Loader2, FilePlus2 } from 'lucide-react'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Modal } from '@/components/shared/Modal'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  isVacancyRequestWindowOpen, textoDeLaVentana,
} from '@/lib/servers/request-window'

/**
 * SRV-11 · «Solicitar puestos de servicio» (antes «Solicitar vacantes»).
 *
 * LO QUE SE FUE, y por qué: el bloque «Detalles de la vacante» —horario,
 * compromiso, ubicación, expiración, destacada, notas— pedía en cada solicitud
 * datos que YA ESTÁN en la ficha del puesto, en la página del comité. El líder
 * los volvía a escribir de memoria cada mes y quedaban tres versiones del
 * mismo horario. Ahora la solicitud es solo la CANTIDAD; los detalles se
 * consultan con «ver detalles», que abre la ficha en solo lectura.
 */
type FlatPosition = {
  id: string
  title: string
  is_active: boolean | null
  area: { id: string; name: string } | null
  /** Solo para el modal de consulta: no se editan desde acá. */
  description?: string | null
  functions?: string | null
  profile?: string | null
  skills?: string | null
  study_requirement?: string | null
  location?: string | null
}

type Committee = { id: string; name: string }

function SolicitarVacantesContent() {
  const params = useSearchParams()
  const preselectedCommittee = params.get('comite') ?? ''
  const { hasRole } = useAuth()

  const [scope, setScope] = useState<{ all: boolean; ids: string[] } | null>(null)
  const [positions, setPositions] = useState<FlatPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [committeeElegido, setCommitteeId] = useState(preselectedCommittee)
  const [cart, setCart] = useState<Record<string, number>>({}) // position_id → cantidad

  /** El puesto cuya ficha se está consultando (solo lectura). */
  const [detalle, setDetalle] = useState<FlatPosition | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sin `status`: desde SRV-15 toda solicitud entra igual —lista para
  // publicar—, la mande quien la mande. Acá había una rama de «ya quedaron
  // publicados» para los roles administrativos, que es justo lo que se quitó.
  const [saved, setSaved] = useState<{ rows: number; slots: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/servers/manageable-committees').then(r => (r.ok ? r.json() : Promise.reject())),
      fetch('/api/servers/positions').then(r => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([sc, pos]: [{ all: boolean; ids: string[] }, FlatPosition[]]) => {
        setScope(sc)
        setPositions(Array.isArray(pos) ? pos : [])
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  // Comités con al menos un puesto activo, según el alcance del usuario.
  const committees = useMemo<Committee[]>(() => {
    const m = new Map<string, string>()
    for (const p of positions) {
      if (p.is_active === false || !p.area) continue
      if (!scope?.all && !(scope?.ids ?? []).includes(p.area.id)) continue
      m.set(p.area.id, p.area.name)
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [positions, scope])

  /**
   * LA VENTANA (SRV-11): del 25 al 30 de cada mes. Se le muestra a TODO EL
   * MUNDO, esté abierta o cerrada, con la fecha concreta — antes solo había un
   * tooltip que decía la regla y la regla a veces mentía (febrero cierra el 28).
   *
   * El cierre solo BLOQUEA al líder de comité, no a quien administra
   * servidores: esa excepción ya existía y se conserva a propósito. Alguien
   * tiene que poder arreglar una solicitud fuera de fecha, y el servidor
   * aplica exactamente la misma regla (no es que la pantalla lo esconda).
   */
  //
  // La exención sale de los ROLES y no de `scope.all`, que es la trampa: desde
  // SRV-11 `solicitudes_puestos` también ve todos los comités —llena la
  // solicitud en lugar del líder— y con la regla vieja se habría saltado la
  // ventana de regalo. El servidor usa exactamente el mismo criterio.
  const isLeader = !hasRole(...SERVICE_ADMIN_ROLES)
  const windowOpen = isVacancyRequestWindowOpen()
  const textoVentana = textoDeLaVentana()
  const canSend = !isLeader || windowOpen

  // Si el líder gestiona un solo comité, queda fijo y bloqueado.
  // DERIVADO en vez de forzado a estado con un efecto: si el líder gestiona un
  // solo comité, ese es el que vale y el estado local ni se consulta.
  // El candado es por ALCANCE: quien gestiona un solo comité lo tiene fijo.
  // No se usa `isLeader`, que ahora significa otra cosa (si está exento de la
  // ventana), y usarlo le habría puesto el selector a quien tiene uno solo.
  const lockedCommittee = !scope?.all && committees.length === 1 ? committees[0] : null
  const committeeId = lockedCommittee?.id ?? committeeElegido

  const committeePositions = useMemo(
    () => positions
      .filter(p => p.is_active !== false && p.area?.id === committeeId)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [positions, committeeId],
  )

  const totalSlots = useMemo(() => Object.values(cart).reduce((s, n) => s + n, 0), [cart])

  const setQty = useCallback((positionId: string, delta: number) => {
    setCart(prev => {
      const next = Math.max(0, (prev[positionId] ?? 0) + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[positionId]
      else copy[positionId] = next
      return copy
    })
  }, [])

  // Al cambiar de comité, limpiamos el carrito (los puestos son de otro comité).
  function onCommitteeChange(id: string) {
    setCommitteeId(id)
    setCart({})
    setError(null)
  }

  async function submit() {
    if (saving || totalSlots === 0 || !committeeId || !canSend) return
    setSaving(true)
    setError(null)
    try {
      const items = Object.entries(cart).map(([position_id, quantity]) => ({ position_id, quantity }))
      const res = await fetch('/api/servers/vacancies/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Solo comité y cantidades: los detalles del puesto ya viven en su
        // ficha y no se vuelven a escribir en cada solicitud.
        body: JSON.stringify({ committee_id: committeeId, items }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar la solicitud.')
      setSaved({ rows: data.rows, slots: data.slots })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60 text-navy-light/80">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (loadError || (scope && !scope.all && committees.length === 0)) {
    return <AccessDenied />
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <div>
            <p className="text-xl font-bold text-navy font-display">
              Solicitud enviada
            </p>
            <p className="mt-1 text-sm text-navy-light/80 font-body">
              {saved.slots} cupo{saved.slots !== 1 ? 's' : ''} en {saved.rows} puesto{saved.rows !== 1 ? 's' : ''}.
              {' '}Salen a la página pública en la publicación de principios de mes.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => { setSaved(null); setCart({}) }}
              className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Solicitar más
            </button>
            <Link
              href="/servidores/vacantes/solicitudes"
              className="rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
            >
              Ver solicitudes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Volver */}
      <Link
        href="/servidores/vacantes"
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-navy-light transition-colors font-body"
      >
        <ChevronLeft size={15} /> Puestos de Servicio
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-navy px-5 sm:px-6 py-5 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl text-white font-display font-extrabold tracking-[-0.02em]">
          Solicitar puestos de servicio
        </h1>
        <p className="mt-1 text-sm text-white/80 font-body">
          Sumá cuántas personas necesitás en cada puesto de tu comité. Los detalles del
          puesto ya están guardados: acá solo va la cantidad.
        </p>
      </div>

      {/* La ventana, arriba y SIEMPRE visible. Antes era un tooltip junto al
          botón de enviar: había que llegar hasta abajo y pasar el mouse para
          enterarse de que estaba cerrado. */}
      <div className={cn(
        'rounded-2xl p-4 flex items-start gap-2.5',
        windowOpen ? 'bg-surface-card shadow-[var(--shadow-md)]' : 'bg-coral/5 border border-coral/20',
      )}>
        <CalendarClock size={16} className={cn('mt-0.5 shrink-0', windowOpen ? 'text-navy-light/80' : 'text-coral')} aria-hidden="true" />
        <div>
          <p className="text-sm text-navy font-body">{textoVentana}</p>
          {!windowOpen && !isLeader && (
            <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
              La ventana está cerrada, pero como administrás servidores podés enviar igual.
            </p>
          )}
        </div>
      </div>

      {/* Sección 1: Comité */}
      <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">Comité</p>
        {lockedCommittee ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-surface-low px-3.5 py-2.5">
            <Lock size={14} className="text-navy-light/80" />
            <span className="text-sm font-medium text-navy font-body">{lockedCommittee.name}</span>
          </div>
        ) : (
          <select
            value={committeeId}
            onChange={e => onCommitteeChange(e.target.value)}
            aria-label="Seleccionar comité"
            className="w-full sm:max-w-md rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
          >
            <option value="">Seleccionar comité…</option>
            {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </section>

      {/* Sección 2: Puestos del comité (carrito) */}
      {committeeId && (
        <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
              Puestos del comité
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 text-[13px] text-navy-light/80 font-body">
              <ShoppingCart size={13} /> {totalSlots} cupo{totalSlots !== 1 ? 's' : ''}
            </span>
          </div>

          {committeePositions.length === 0 ? (
            <p className="text-sm text-navy-light/80 font-body py-6 text-center">
              Este comité no tiene puestos activos.
            </p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {committeePositions.map(p => {
                const qty = cart[p.id] ?? 0
                return (
                  <li
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
                      qty > 0 ? 'border-coral/40 bg-coral/5' : 'border-[var(--outline-variant)]',
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-navy font-body truncate">{p.title}</span>
                      <button
                        type="button"
                        onClick={() => setDetalle(p)}
                        className="text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body underline"
                      >
                        Ver detalles
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, -1)}
                        disabled={qty === 0}
                        aria-label={`Restar un cupo de ${p.title}`}
                        className="h-10 w-10 rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-navy-light hover:bg-surface-low active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="w-8 text-center text-base font-bold text-navy font-display tabular-nums" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, 1)}
                        aria-label={`Sumar un cupo a ${p.title}`}
                        className="h-10 w-10 rounded-full bg-coral/15 text-coral-deep flex items-center justify-center hover:bg-coral/25 active:scale-95 transition"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Enviar */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm text-navy-light/80 font-body">
          Total: <strong className="text-navy">{totalSlots}</strong> cupo{totalSlots !== 1 ? 's' : ''}
        </span>
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <button
            type="button"
            onClick={submit}
            disabled={saving || totalSlots === 0 || !committeeId || !canSend}
            title={!canSend ? textoVentana : undefined}
            className={cn(
              'rounded-full px-5 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2',
              saving || totalSlots === 0 || !committeeId || !canSend
                ? 'bg-navy-light/20 cursor-not-allowed'
                : 'bg-coral shadow-[var(--shadow-pulse-sm)] hover:bg-coral-deep',
            )}
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar solicitud'}
          </button>
          {!canSend && (
            <p className="text-[13px] text-coral font-body text-center sm:text-right max-w-xs">
              {textoVentana}
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-coral font-body">{error}</p>}

      <p className="text-[13px] text-navy-light/80 font-body flex items-center gap-1.5">
        <FilePlus2 size={13} /> ¿No existe el puesto que buscás?{' '}
        <Link href="/servidores/puestos/solicitar" className="text-coral hover:underline">Solicitalo acá</Link>.
      </p>

      {/* La ficha del puesto, SOLO LECTURA. Se consulta, no se edita: el
          detalle vive en la página del comité y tener dos lugares donde
          cambiarlo es tener dos versiones del mismo dato. */}
      {detalle && (
        <Modal onClose={() => setDetalle(null)} titleId="detalle-puesto-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="detalle-puesto-title" className="text-lg font-semibold text-navy font-display">
                {detalle.title}
              </h2>
              <p className="text-sm text-navy-light/80 font-body mt-0.5">
                {detalle.area?.name ?? 'Sin comité'}
              </p>
            </div>
            <dl className="space-y-3">
              {([
                ['Descripción', detalle.description],
                ['Funciones', detalle.functions],
                ['Perfil', detalle.profile],
                ['Habilidades', detalle.skills],
                ['Estudio requerido', detalle.study_requirement],
                ['Ubicación', detalle.location],
              ] as Array<[string, string | null | undefined]>)
                .filter(([, v]) => !!v?.trim())
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">{k}</dt>
                    <dd className="text-sm text-navy font-body whitespace-pre-line">{v}</dd>
                  </div>
                ))}
            </dl>
            {![detalle.description, detalle.functions, detalle.profile, detalle.skills,
               detalle.study_requirement, detalle.location].some(v => v?.trim()) && (
              <p className="text-sm text-navy-light/80 font-body">
                Este puesto todavía no tiene detalles escritos. Se completan en la página
                del comité.
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setDetalle(null)}
                className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function SolicitarVacantesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--fg-muted)]">Cargando…</div>}>
      <SolicitarVacantesContent />
    </Suspense>
  )
}
