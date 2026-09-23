import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { formatBirthday, formatDateNumeric } from '@/lib/format'
import { partesDeFecha } from '@/lib/fecha/partes-de-fecha'

// Fila aplanada de servidor, compartida entre el listado general y el detalle de comité.
export type FlatServer = {
  member_id: string
  name: string
  initials: string
  position: string
  start_date: string
  status: 'active' | 'inactive'
  committee: string
  area: string
  leader_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
}

export function calcularAntiguedad(startDate: string): string {
  if (!startDate) return '—'
  // QA-1/M1: `start_date` es columna `date`. Con `new Date` una fecha del día 1
  // retrocede al mes anterior en Costa Rica y la antigüedad sale un mes larga.
  const start = partesDeFecha(startDate)
  if (!start) return '—'
  const now = new Date()
  const months = (now.getFullYear() - start.anio) * 12 + (now.getMonth() + 1 - start.mes)
  if (months < 12) return `${months} mes${months !== 1 ? 'es' : ''}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years} año${years !== 1 ? 's' : ''}, ${rem} mes${rem !== 1 ? 'es' : ''}` : `${years} año${years !== 1 ? 's' : ''}`
}

export const SERVER_COLUMNS: ColumnDef<FlatServer>[] = [
  { key: 'name',       label: 'Nombre',             defaultVisible: true, alwaysVisible: true },
  { key: 'position',   label: 'Puesto de servicio', defaultVisible: true },
  { key: 'committee',  label: 'Comité',             defaultVisible: true },
  { key: 'area',       label: 'Área',               defaultVisible: true },
  {
    key: 'start_date', label: 'Fecha de inicio', defaultVisible: true,
    exportValue: s => formatDateNumeric(s.start_date),
  },
  {
    key: 'seniority', label: 'Antigüedad', defaultVisible: true,
    exportValue: s => calcularAntiguedad(s.start_date),
  },
  {
    key: 'status', label: 'Estado', defaultVisible: false,
    exportValue: s => (s.status === 'active' ? 'Activo' : 'Inactivo'),
  },
  { key: 'leader_name', label: 'Líder del comité', defaultVisible: false },
  // Columnas nuevas — ocultas por defecto.
  { key: 'email', label: 'Email del servidor', defaultVisible: false, exportValue: s => s.email ?? '' },
  {
    key: 'birth_date', label: 'Fecha de cumpleaños', defaultVisible: false,
    // Con `new Date(...)` pelado, todo el archivo salía con la fecha de la
    // víspera: UTC-6 corre la medianoche UTC al día anterior (2026-09-21).
    exportValue: s => formatBirthday(s.birth_date),
  },
  { key: 'phone', label: 'Teléfono / WhatsApp', defaultVisible: false, exportValue: s => s.phone ?? '' },
]
