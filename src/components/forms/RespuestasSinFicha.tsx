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
import { UserX, Search } from 'lucide-react'
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
                onClick={() => setBuscando(b => (b === i.id ? null : i.id))}
                aria-expanded={buscando === i.id}
              >
                <Search size={13} aria-hidden /> {i.candidato ? 'Es otra persona…' : 'Buscar su ficha…'}
              </Button>
            </div>
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
