import { type ColumnDef } from '@/components/shared/ColumnSelector'

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
  const start = new Date(startDate)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
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
    exportValue: s => (s.start_date ? new Date(s.start_date).toLocaleDateString('es-CR') : '—'),
  },
  {
    key: 'seniority', label: 'Antigüedad', defaultVisible: true,
    exportValue: s => calcularAntiguedad(s.start_date),
  },
  {
    key: 'status', label: 'Estado', defaultVisible: true,
    exportValue: s => (s.status === 'active' ? 'Activo' : 'Inactivo'),
  },
  { key: 'leader_name', label: 'Líder del comité', defaultVisible: false },
  // Columnas nuevas — ocultas por defecto.
  { key: 'email', label: 'Email del servidor', defaultVisible: false, exportValue: s => s.email ?? '' },
  {
    key: 'birth_date', label: 'Fecha de cumpleaños', defaultVisible: false,
    exportValue: s => (s.birth_date ? new Date(s.birth_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'long' }) : ''),
  },
  { key: 'phone', label: 'Teléfono / WhatsApp', defaultVisible: false, exportValue: s => s.phone ?? '' },
]
