'use client'

/**
 * FRM-9 (2026-10-29) · Las respuestas que llegaron por el link público sin
 * ficha, con la forma de ligarlas a una persona del padrón.
 *
 * El sistema PROPONE (una ficha con el mismo correo, o si no con el mismo
 * nombre exacto) y alguien confirma con un toque; cuando no hay candidato
 * claro, el buscador de miembros de siempre. Lo pidió Floriana porque las 29
 * inscripciones de Matrimonios no se podían asociar ni desde el evento ni
 * desde las respuestas.
 *
 * Lo usan la pantalla de respuestas del formulario y el detalle del evento.
 */
import { useState } from 'react'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { UserX, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { MemberCombobox, MEMBER_LOOKUP_URL } from '@/components/shared/MemberCombobox'
import { useToast } from '@/components/shared/Toast'
import { formatDate } from '@/lib/format'
import { TEXTO_DEL_MOTIVO, type MotivoDelCandidato } from '@/lib/forms/vinculo-de-respuesta'

export type RespuestaSinFichaItem = {
  id: string
  nombre: string
  email: string | null
  fecha: string
  candidato: { id: string; name: string; cedula: string | null; motivo: MotivoDelCandidato } | null
  /** EVE-14 · Propuesta de nombre y apellidos para «crear ficha». */
  propuesta?: { first_name: string; last_name: string }
}

type Props = {
  formId: string
  /** Título de la tarjeta; el default sirve en el formulario y en el evento. */
  titulo?: string
  descripcion?: string
  /** Tras vincular: la pantalla recarga lo suyo (respuestas, inscritos…). */
  onVinculado?: () => void
}

export function RespuestasSinFicha({ formId, titulo = 'Por el link público, sin ficha', descripcion, onVinculado }: Props) {
  const toast = useToast()
  // LINT-1 · la carga se deriva (useCargaRemota), nada de setState en un efecto.
  const { datos: items, recargar: cargar } = useCargaRemota<RespuestaSinFichaItem[]>(
    formId,
    () => fetch(`/api/forms/${formId}/responses/sin-ficha`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => (Array.isArray(d?.items) ? d.items : [])),
  )
  const [buscando, setBuscando] = useState<string | null>(null) // id de la respuesta con el buscador abierto
  const [ocupado, setOcupado] = useState<string | null>(null)
  // EVE-14 · «Crear ficha nueva»: la respuesta con el formulario abierto y el nombre propuesto, editable.
  const [creando, setCreando] = useState<{ id: string; first_name: string; last_name: string } | null>(null)

  async function vincular(item: RespuestaSinFichaItem, miembro: { id: string; name: string }) {
    if (ocupado) return
    setOcupado(item.id)
    try {
      const res = await fetch(`/api/forms/${formId}/responses/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: miembro.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo vincular.')
      toast(`${item.nombre} quedó ligado/a a la ficha de ${miembro.name}.`, 'success')
      setBuscando(null)
      await cargar()
      onVinculado?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo vincular.', 'error')
    } finally {
      setOcupado(null)
    }
  }

  async function crearFicha() {
    if (!creando || ocupado) return
    const item = items?.find(i => i.id === creando.id)
    if (!item) return
    if (!creando.first_name.trim() || !creando.last_name.trim()) { toast('Falta el nombre o los apellidos.', 'error'); return }
    setOcupado(item.id)
    try {
      const res = await fetch(`/api/forms/${formId}/responses/${item.id}/crear-ficha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: creando.first_name.trim(), last_name: creando.last_name.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.code === 'duplicate' && data?.member?.id) {
        // El correo ya es de alguien: se ofrece vincular a esa ficha en vez de duplicar.
        toast(`${data.error} Se vincula a esa ficha.`, 'info')
        setCreando(null)
        await vincular(item, { id: data.member.id, name: data.member.name })
        return
      }
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo crear la ficha.')
      toast(`Ficha creada para ${item.nombre} y vinculada.`, 'success')
      setCreando(null)
      await cargar()
      onVinculado?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear la ficha.', 'error')
    } finally {
      setOcupado(null)
    }
  }

  if (!items || items.length === 0) return null
  return (
    <section className="rounded-2xl border border-coral/30 bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
      <div className="flex items-start gap-2">
        <UserX size={18} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden="true" />
        <div>
          <h3 className="text-[15px] font-bold text-navy font-display">
            {titulo} ({items.length})
          </h3>
          <p className="text-[13px] text-navy-light/80 font-body">
            {descripcion ?? 'Llenaron el formulario sin entrar al sistema. Si la persona tiene ficha, vinculala: la respuesta y, si es un evento, la inscripción quedan en su historial.'}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {items.map(i => (
          <li key={i.id} className="py-3 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm text-navy font-body">{i.nombre}</span>
              <span className="text-[13px] text-navy-light/80 font-body break-all">
                {i.email ?? 'Sin correo'} · {formatDate(i.fecha)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {i.candidato && (
                <>
                  <span className="text-[13px] text-navy-light font-body">
                    ¿Es <strong className="text-navy">{i.candidato.name}</strong>
                    {i.candidato.cedula ? ` (${i.candidato.cedula})` : ''}? · {TEXTO_DEL_MOTIVO[i.candidato.motivo]}
                  </span>
                  <Button variante="navy" tamano="sm" onClick={() => vincular(i, i.candidato!)} disabled={ocupado === i.id}>
                    {ocupado === i.id ? 'Vinculando…' : 'Sí, vincular'}
                  </Button>
                </>
              )}
              <Button
                variante="secundario" tamano="sm"
                onClick={() => { setCreando(null); setBuscando(b => (b === i.id ? null : i.id)) }}
                aria-expanded={buscando === i.id}
              >
                <Search size={13} aria-hidden /> {i.candidato ? 'Es otra persona…' : 'Buscar su ficha…'}
              </Button>
              {/* EVE-14 · No está en el padrón: se le crea la ficha acá mismo. */}
              <Button
                variante="fantasma" tamano="sm"
                onClick={() => { setBuscando(null); setCreando(c => (c?.id === i.id ? null : { id: i.id, ...(i.propuesta ?? { first_name: i.nombre, last_name: '' }) })) }}
                aria-expanded={creando?.id === i.id}
              >
                <UserPlus size={13} aria-hidden /> Crear ficha nueva
              </Button>
            </div>
            {creando?.id === i.id && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end max-w-2xl rounded-xl bg-surface-low p-3">
                <div>
                  <label htmlFor={`cf-nombre-${i.id}`} className="text-[13px] text-navy-light/80 font-body">Nombre</label>
                  <input id={`cf-nombre-${i.id}`} value={creando.first_name} onChange={e => setCreando({ ...creando, first_name: e.target.value })}
                    className="w-full rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body" />
                </div>
                <div>
                  <label htmlFor={`cf-apellidos-${i.id}`} className="text-[13px] text-navy-light/80 font-body">Apellidos</label>
                  <input id={`cf-apellidos-${i.id}`} value={creando.last_name} onChange={e => setCreando({ ...creando, last_name: e.target.value })}
                    className="w-full rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body" />
                </div>
                <Button variante="navy" tamano="sm" onClick={crearFicha} disabled={ocupado === i.id} className="min-h-[38px]">
                  {ocupado === i.id ? 'Creando…' : 'Crear y vincular'}
                </Button>
                <p className="text-[13px] text-navy-light/80 font-body sm:col-span-3">
                  Se crea con el correo {i.email ?? 'sin correo'} y queda vinculada a esta respuesta{i.email ? '; la cuenta de acceso se crea después, si hace falta' : ''}.
                </p>
              </div>
            )}
            {buscando === i.id && (
              <div className="max-w-md">
                <MemberCombobox
                  dropdown
                  autoFocus
                  placeholder="Buscá por nombre o cédula…"
                  searchUrl={MEMBER_LOOKUP_URL}
                  onSelect={m => vincular(i, { id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
