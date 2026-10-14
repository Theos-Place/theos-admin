'use client'

/**
 * FIN-11 · La bandeja de viajes.
 *
 * Dos pestañas y la misma lista: «Míos» son los expedientes de quien mira;
 * «Por revisar» solo aparece para finanzas y dirección, y nunca trae
 * borradores ajenos — un borrador es un papel a medio llenar y mostrarlo
 * invita a opinar sobre algo que nadie mandó.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plane, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ESTADOS_ABIERTOS, puedePedirViaje, type EstadoDeViaje } from '@/lib/travel/estados-del-viaje'
import { BADGE_DE_ESTADO } from '@/components/travel/badge'
import type { TotalPorMoneda } from '@/lib/travel/presupuesto'

type Fila = {
  id: string; member_id: string; member_name: string; status: EstadoDeViaje
  destino: string; sale_at: string; vuelve_at: string; totales: TotalPorMoneda[]
}

export default function ViajesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Fila[] | null>(null)
  const [verTodos, setVerTodos] = useState(false)
  const [tab, setTab] = useState<'mios' | 'revisar'>('mios')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/travel-requests')
      .then(async r => { if (!r.ok) throw new Error('No se pudieron cargar los viajes.'); return r.json() })
      .then(d => { setItems(d.items); setVerTodos(d.verTodos) })
      .catch((e: Error) => setError(e.message))
  }, [])

  const puedePedir = puedePedirViaje(user?.roles ?? [])
  const mios = (items ?? []).filter(v => v.member_id === user?.member_id)
  const ajenos = (items ?? []).filter(v => v.member_id !== user?.member_id)
  const visibles = tab === 'mios' ? mios : ajenos
  const porRevisar = ajenos.filter(v => ESTADOS_ABIERTOS.includes(v.status)).length

  return (
    <div className="page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-soft/30 shrink-0">
            <Plane size={20} className="text-teal-deep" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy font-display">Viajes y viáticos</h1>
            <p className="text-[13px] text-navy-light/80 font-body">
              Solicitud, presupuesto y aprobación, según el Reglamento de Viajes.
            </p>
          </div>
        </div>
        {puedePedir && (
          <Button href="/viajes/nuevo" variante="primario" tamano="sm" className="self-start">
            <Plus size={14} aria-hidden="true" /> Nuevo viaje
          </Button>
        )}
      </div>

      {verTodos && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Viajes">
          {([['mios', `Míos (${mios.length})`], ['revisar', `Por revisar (${porRevisar})`]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('rounded-full px-3 py-1 text-[13px] font-medium border transition-all font-display',
                tab === k ? 'bg-navy/80 text-white border-navy/80' : 'text-navy-light/80 hover:text-navy border-navy/15')}>
              {label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[13px] text-coral-deep font-body">{error}</p>}

      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {!items ? (
          <p className="px-4 py-6 text-center text-[13px] text-navy-light/80 font-body">Cargando…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={tab === 'mios' ? 'Todavía no has pedido ningún viaje' : 'Nada por revisar'}
            description={tab === 'mios' ? 'Cuando pidas uno, va a aparecer acá con su estado.' : ''}
          />
        ) : (
          <div className="divide-y divide-[var(--outline-variant)]">
            {visibles.map(v => {
              const badge = BADGE_DE_ESTADO[v.status]
              return (
                <Link key={v.id} href={`/viajes/${v.id}`}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-surface-low transition-colors sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-navy font-body truncate">{v.destino}</p>
                    <p className="text-[13px] text-navy-light/80 font-body">
                      {tab === 'revisar' && <>{v.member_name} · </>}
                      {formatDate(v.sale_at)} → {formatDate(v.vuelve_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] text-navy-light/80 font-body">
                      {v.totales.map(t => formatMoney(t.total, t.moneda)).join(' · ') || '—'}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-semibold font-display', badge.cls)}>
                      {badge.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
