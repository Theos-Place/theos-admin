/** FIN-11 · Cómo se ve cada estado. En un solo lugar: la bandeja, el detalle
 *  y el historial tienen que llamarle igual a lo mismo. */
import type { EstadoDeViaje } from '@/lib/travel/estados-del-viaje'

export const BADGE_DE_ESTADO: Record<EstadoDeViaje, { label: string; cls: string }> = {
  borrador:              { label: 'Borrador',       cls: 'bg-surface-low text-navy-light/80' },
  enviada:               { label: 'Enviada',        cls: 'bg-coral/10 text-coral-deep' },
  en_revision:           { label: 'En revisión',    cls: 'bg-[rgba(233,185,73,0.15)] text-[#7F6210]' },
  por_corregir:          { label: 'Por corregir',   cls: 'bg-[rgba(233,185,73,0.15)] text-[#7F6210]' },
  aprobada:              { label: 'Aprobada',       cls: 'bg-success/12 text-success-deep' },
  rechazada:             { label: 'Rechazada',      cls: 'bg-surface-low text-navy-light/80' },
  cancelada:             { label: 'Cancelada',      cls: 'bg-surface-low text-navy-light/80' },
  anticipo_entregado:    { label: 'Anticipo dado',  cls: 'bg-teal-soft/30 text-teal-deep' },
  en_viaje:              { label: 'En viaje',       cls: 'bg-teal-soft/30 text-teal-deep' },
  liquidacion_pendiente: { label: 'Falta liquidar', cls: 'bg-coral/10 text-coral-deep' },
  liquidada:             { label: 'Liquidada',      cls: 'bg-success/12 text-success-deep' },
  cerrada:               { label: 'Cerrada',        cls: 'bg-surface-low text-navy-light/80' },
}
