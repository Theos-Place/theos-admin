'use client'

import { useOrg } from '@/lib/org'
import { SummaryRow } from './shared'
import { formatCRC } from '@/lib/format'

type SubEventInput = { id: string; name: string; max_capacity: string }

interface EventSummaryProps {
  name: string
  selectedTypeName: string | undefined
  organizing_committee_ids: string[]
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  is_virtual: boolean
  virtual_link: string
  location: string
  location_map_url: string
  is_recurring: boolean
  sub_events: SubEventInput[]
  requires_registration: boolean
  max_capacity: string
  requires_payment: boolean
  payment_amount: string
}

function fmt(date: string, time: string): string {
  if (!date) return '—'
  return new Date(`${date}T${time || '00:00'}`).toLocaleString('es-CR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Box de resumen que se va llenando con lo que se captura en cada paso. */
export function EventSummary(p: EventSummaryProps) {
  const { adminCommittees } = useOrg()
  const committeeNames = p.organizing_committee_ids
    .map(id => adminCommittees.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ')

  return (
    <div className="card py-5 px-6 w-full lg:sticky lg:top-4">
      <div className="card-title mb-4">Resumen del evento</div>
      <div className="space-y-1">
        <SummaryRow label="Nombre" value={p.name || '—'} />
        <SummaryRow label="Tipo" value={p.selectedTypeName ?? '—'} />
        <SummaryRow label={p.organizing_committee_ids.length > 1 ? 'Comités' : 'Comité'} value={committeeNames || '—'} />
        <SummaryRow label="Inicio" value={fmt(p.start_date, p.start_time)} />
        <SummaryRow label="Fin" value={fmt(p.end_date, p.end_time)} />
        <SummaryRow label="Lugar" value={p.is_virtual ? 'Virtual' : p.location || '—'} />
        {p.is_virtual && p.virtual_link && (
          <SummaryRow
            label="Link"
            value={<a href={p.virtual_link} target="_blank" rel="noopener noreferrer" className="text-coral underline">Ver reunión</a>}
          />
        )}
        {p.location_map_url && !p.is_virtual && (
          <SummaryRow
            label="Mapa"
            value={<a href={p.location_map_url} target="_blank" rel="noopener noreferrer" className="text-coral underline">Ver enlace</a>}
          />
        )}
        <SummaryRow label="Recurrente" value={p.is_recurring ? 'Sí' : 'No'} />
        <SummaryRow
          label="Sub-eventos"
          value={p.sub_events.length > 0 ? p.sub_events.map(s => s.name).join(', ') : 'Ninguno'}
        />
        <SummaryRow
          label="Inscripción"
          value={p.requires_registration ? `Sí${p.max_capacity ? ` · Cap. ${p.max_capacity}` : ''}` : 'No requerida'}
        />
        <SummaryRow
          label="Cobro"
          value={p.requires_payment && p.payment_amount ? `${formatCRC(Number(p.payment_amount))}` : 'Gratuito'}
        />
      </div>
    </div>
  )
}
