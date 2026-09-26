'use client'

/**
 * SRV-12 · «Solicitudes de puestos de servicio».
 *
 * QUÉ REEMPLAZA. Esta pantalla era una tabla de vacantes con cambio de estado
 * masivo. Lo que hacía falta es otra cosa: la operación de los primeros de
 * cada mes —mirar lo que pidió cada comité, bajárselo en Excel para repasarlo,
 * y publicarlo de una.
 *
 * AGRUPADA POR COMITÉ y no una lista plana: el repaso se hace comité por
 * comité, que es como está organizada la conversación con los encargados.
 *
 * «PUBLICAR» NO ES SOLO AGREGAR, y por eso pide confirmación diciendo los DOS
 * números: sube lo nuevo y BAJA lo que está en la calle del mes pasado. Lo que
 * baja no se borra —queda desactivado con sus aplicaciones—, y eso también lo
 * dice la confirmación, porque es la pregunta que sigue.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import { ChevronLeft, Loader2, Download, Upload, Users, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { formatDate } from '@/lib/format'
import { VACANCY_STATE_LABEL, VACANCY_STATE_BADGE, isVacancyState } from '@/lib/servers/vacancy-states'
import {
  textoDeConfirmacion, hayAlgoQuePublicar, motivoParaNoPublicar, type PlanDePublicacion,
} from '@/lib/servers/publicacion-mensual'

type Solicitud = {
  id: string
  committee_id: string
  comite: string
  encargados: string[]
  puesto: string
  cupos: number
  estado: string
  published_at: string | null
  solicitada: string
}

export default function SolicitudesDePuestosPage() {
  const { hasRole, loaded, user } = useAuth()
  const toast = useToast()
  useTituloDePantalla('Solicitudes de puestos de servicio', 'Servidores')

  const puedeVer = hasRole(...SERVICE_ADMIN_ROLES, 'solicitudes_puestos')
  // Publicar baja lo que está en la calle: es de la coordinación, no de quien
  // arma las solicitudes.
  const puedePublicar = hasRole(...SERVICE_ADMIN_ROLES)

  const [items, setItems] = useState<Solicitud[] | null>(null)
  const [plan, setPlan] = useState<PlanDePublicacion>({ aPublicar: [], aDesactivar: [] })
  const [confirmando, setConfirmando] = useState(false)
  const [publicando, setPublicando] = useState(false)

  const cargar = useCallback(() => {
    fetch('/api/servers/vacancies/requests')
      .then(r => (r.ok ? r.json() : { items: [], plan: { aPublicar: [], aDesactivar: [] } }))
      .then(d => {
        setItems((d.items ?? []) as Solicitud[])
        setPlan(d.plan ?? { aPublicar: [], aDesactivar: [] })
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => { if (puedeVer) cargar() }, [puedeVer, cargar])

  /** Agrupadas por comité, y dentro por puesto. */
  const porComite = useMemo(() => {
    const m = new Map<string, Solicitud[]>()
    for (const s of items ?? []) {
      const arr = m.get(s.comite) ?? []
      arr.push(s)
      m.set(s.comite, arr)
    }
    return [...m.entries()]
      .map(([comite, filas]) => ({
        comite,
        encargados: filas[0]?.encargados ?? [],
        filas: [...filas].sort((a, b) => a.puesto.localeCompare(b.puesto, 'es')),
        cupos: filas.reduce((s, f) => s + f.cupos, 0),
      }))
      .sort((a, b) => a.comite.localeCompare(b.comite, 'es'))
  }, [items])

  const totalCupos = useMemo(() => (items ?? []).reduce((s, f) => s + f.cupos, 0), [items])

  async function publicar() {
    setPublicando(true)
    try {
      const res = await fetch('/api/servers/vacancies/publish', { method: 'POST' })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo publicar.'))
      const d = await res.json()
      toast(
        `Listo: ${d.publicadas} publicado${d.publicadas !== 1 ? 's' : ''}`
        + (d.desactivadas > 0 ? `, ${d.desactivadas} bajado${d.desactivadas !== 1 ? 's' : ''}` : ''),
        'success',
      )
      setConfirmando(false)
      cargar()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo publicar.', 'error')
    } finally {
      setPublicando(false)
    }
  }

  if (!loaded) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (user && !puedeVer) return <AccessDenied />

  return (
    <div className="space-y-5">
      <Link href="/servidores/vacantes" className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Puestos de Servicio
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy font-display">Solicitudes de puestos de servicio</h1>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            Lo que pidió cada comité en la última ventana. Se revisa y se publica los
            primeros de cada mes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            href="/api/servers/vacancies/requests?formato=xlsx"
            variante="secundario"
            className="inline-flex items-center gap-1.5"
          >
            <Download size={14} aria-hidden="true" /> Descargar Excel
          </Button>
          {puedePublicar && (
            <Button
              onClick={() => setConfirmando(true)}
              disabled={!hayAlgoQuePublicar(plan)}
              title={motivoParaNoPublicar(plan) ?? undefined}
              className="inline-flex items-center gap-1.5"
            >
              <Upload size={14} aria-hidden="true" /> Publicar puestos
            </Button>
          )}
        </div>
      </div>

      {/* El resumen de lo que haría el botón, SIEMPRE a la vista y no solo al
          confirmar: el número que importa es el de los que se bajan. */}
      {/* Por qué el botón está como está, SIEMPRE a la vista: apagado sin
          explicación se lee como que la pantalla está rota. */}
      {puedePublicar && (
        <div className={cn(
          'rounded-2xl p-4 flex items-start gap-2.5',
          hayAlgoQuePublicar(plan)
            ? 'bg-surface-card shadow-[var(--shadow-md)]'
            : 'bg-surface-low',
        )}>
          <Upload size={16} className="mt-0.5 shrink-0 text-navy-light/80" aria-hidden="true" />
          <p className="text-sm text-navy font-body">
            {motivoParaNoPublicar(plan) ?? textoDeConfirmacion(plan)}
          </p>
        </div>
      )}

      {items === null ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-navy-light/80" /></div>
      ) : porComite.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-card">
          <EmptyState
            title="Todavía no hay solicitudes"
            description="Los comités piden sus cupos del 25 al 30 de cada mes."
          />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-navy-light/80 font-body">
            {porComite.length} comité{porComite.length !== 1 ? 's' : ''} · {items.length} puesto
            {items.length !== 1 ? 's' : ''} · <strong className="text-navy">{totalCupos}</strong> cupo
            {totalCupos !== 1 ? 's' : ''} en total
          </p>

          <div className="space-y-4">
            {porComite.map(g => (
              <section key={g.comite} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 border-b border-[var(--outline-variant)]">
                  <div>
                    <h2 className="text-sm font-semibold text-navy font-display">{g.comite}</h2>
                    <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-1.5">
                      <Users size={12} aria-hidden="true" />
                      {g.encargados.length > 0 ? g.encargados.join(', ') : 'Sin encargado registrado'}
                    </p>
                  </div>
                  <span className="text-[13px] text-navy-light/80 font-body">
                    {g.cupos} cupo{g.cupos !== 1 ? 's' : ''}
                  </span>
                </div>
                <ul>
                  {g.filas.map(f => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-[var(--outline-variant)] last:border-0">
                      <span className="text-sm text-navy font-body min-w-0">{f.puesto}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-[13px] text-navy-light/80 font-body">
                          Pedido el {formatDate(f.solicitada)}
                        </span>
                        {isVacancyState(f.estado) && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[13px] font-body', VACANCY_STATE_BADGE[f.estado])}>
                            {VACANCY_STATE_LABEL[f.estado]}
                          </span>
                        )}
                        <span className="text-sm font-bold text-navy font-display tabular-nums w-8 text-right">
                          {f.cupos}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {confirmando && (
        <Modal onClose={() => setConfirmando(false)} titleId="publicar-title">
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-coral mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 id="publicar-title" className="text-lg font-semibold text-navy font-display">
                  Publicar los puestos del mes
                </h2>
                <p className="mt-1 text-sm text-navy-light/80 font-body">
                  {textoDeConfirmacion(plan)}
                </p>
              </div>
            </div>
            <p className="text-[13px] text-navy-light/80 font-body">
              Esto cambia lo que se ve en la página pública de puestos. Queda registrado
              quién lo hizo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmando(false)}
                disabled={publicando}
                className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <Button onClick={() => void publicar()} disabled={publicando}>
                {publicando ? 'Publicando…' : 'Sí, publicar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
