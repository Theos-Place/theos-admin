'use client'

// "Encargados de este evento" (FRM-1 parte B, 2026-08-06): la persona que
// organiza una actividad gestiona TODO lo de ESE evento —inscripciones,
// check-in, edición— y su formulario, sin tener el módulo de eventos y sin
// alcanzar a ningún otro evento.
//
// Se administra acá, en la configuración del evento. El formulario del evento
// HEREDA el permiso: no hay que darlo dos veces. API: /api/events/[id]/managers.
import { useState, useEffect } from 'react'
import { Loader2, Trash2, UserPlus, ShieldCheck } from 'lucide-react'
import { MemberCombobox, MEMBER_LOOKUP_URL, type MemberHit } from '@/components/shared/MemberCombobox'
import { useToast } from '@/components/shared/Toast'
import { formatDate } from '@/lib/format'

type Grant = {
  id: string
  member_id: string
  member_name: string
  member_email: string | null
  granted_by_name: string | null
  granted_at: string
}

export function EventManagersPanel({ eventId }: { eventId: string }) {
  const toast = useToast()
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // Recarga desde el servidor. `reloadKey` la dispara después de agregar a
  // alguien (el alta devuelve la fila, pero la lista se relee para traer el
  // nombre de quien dio el acceso, que lo resuelve el server).
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let alive = true
    fetch(`/api/events/${eventId}/managers`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) { setGrants(Array.isArray(d) ? d : []); setLoading(false) } })
      .catch(() => { if (alive) { setGrants([]); setLoading(false) } })
    return () => { alive = false }
  }, [eventId, reloadKey])

  async function add(m: MemberHit) {
    setBusy(m.id)
    try {
      const res = await fetch(`/api/events/${eventId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: m.id }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo nombrar al encargado')
      setReloadKey(k => k + 1)
      toast(`${m.first_name} quedó a cargo de este evento`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo nombrar al encargado', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function remove(g: Grant) {
    setBusy(g.member_id)
    try {
      const res = await fetch(`/api/events/${eventId}/managers?member_id=${g.member_id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo quitar al encargado')
      setGrants(prev => prev.filter(x => x.member_id !== g.member_id))
      toast(`${g.member_name} ya no está a cargo de este evento`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo quitar al encargado', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-navy-light/80 font-body max-w-prose">
        Estas personas gestionan <strong>este evento y solo este</strong>: inscripciones,
        check-in, edición del evento y su formulario con las respuestas. No entran al resto
        de los eventos ni al módulo completo.
      </p>

      <div>
        <label className="text-[13px] text-navy-light/80 mb-1 block font-body" htmlFor="form-access-search">
          Nombrar a alguien encargado
        </label>
        {/* Buscador compartido de gestión, no /api/members: ese exige el módulo
            miembros y el rol 'forms' no lo tiene (bug 2026-08-04). */}
        <MemberCombobox
          dropdown
          placeholder="Buscá por nombre o cédula…"
          searchUrl={MEMBER_LOOKUP_URL}
          excludeIds={grants.map(g => g.member_id)}
          onSelect={add}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-navy-light/80 font-body">
          <Loader2 size={14} className="animate-spin" /> Cargando encargados…
        </div>
      ) : grants.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl bg-surface-low px-4 py-3">
          <UserPlus size={15} className="text-navy-light/80 shrink-0 mt-0.5" />
          <p className="text-[13px] text-navy-light/80 font-body">
            Nadie está a cargo todavía. Quien tenga el módulo de eventos (dirección,
            staff, comunicaciones o encargado de eventos) ya gestiona este evento.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--outline-variant)] rounded-xl bg-surface-low overflow-hidden">
          {grants.map(g => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <ShieldCheck size={15} className="text-teal-deep shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-navy font-body font-medium">{g.member_name}</p>
                <p className="truncate text-[13px] text-navy-light/80 font-body">
                  {g.member_email ?? 'Sin correo'}
                  {' · a cargo desde '}{formatDate(g.granted_at)}
                  {g.granted_by_name ? ` · lo nombró ${g.granted_by_name}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(g)}
                disabled={busy === g.member_id}
                aria-label={`Quitar a ${g.member_name} de los encargados`}
                className="shrink-0 rounded-full p-2 text-navy-light/80 hover:bg-coral/10 hover:text-coral transition-colors disabled:opacity-50"
              >
                {busy === g.member_id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
