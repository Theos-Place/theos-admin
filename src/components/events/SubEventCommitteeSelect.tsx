'use client'

import { useOrg } from '@/lib/org'

type Props = {
  value: string | null
  onChange: (id: string | null) => void
  id?: string
}

/**
 * CHK-4 · Qué comité opera esta estación del evento.
 *
 * Es UNO solo, no una lista como los comités organizadores del evento: un
 * subevento es una estación con un equipo. Si dos comités la operaran, son dos
 * subeventos.
 *
 * "El del evento" (null) es el default y el caso normal — la mayoría de los
 * subeventos los atiende la misma gente de la charla. Elegir uno acá solo hace
 * falta cuando la estación la lleva otro comité, como Youth dentro de la charla
 * de una sede: sin eso, esa gente no puede hacer check-in.
 */
export function SubEventCommitteeSelect({ value, onChange, id }: Props) {
  const { adminCommittees } = useOrg()
  return (
    <select
      id={id}
      aria-label="Comité que opera el sub-evento"
      className="w-full rounded-xl border border-[var(--outline-variant)] bg-surface px-3 py-2 text-[13px] text-navy font-body"
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">Lo opera el comité del evento</option>
      {adminCommittees.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
