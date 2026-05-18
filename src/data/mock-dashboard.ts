export const DASHBOARD_STATS = {
  members: {
    total: 23418,
    active: 22904,
    new_this_month: 147,
    without_cedula: 23,
    duplicates_suggested: 4,
  },
  studies: {
    active_groups: 184,
    students: 612,
    open_registration: 12,
    waitlist_n1: 83,
    closing_soon: 28,
    without_leader: 3,
  },
  events: {
    upcoming_this_month: 8,
    this_week: 3,
    pending_payments: 14,
    near_capacity: 2,
  },
  servers: {
    active: 87,
    committees: 11,
    open_vacancies: 5,
    pending_applications: 8,
  },
  finance: {
    donors_active: 1847,
    pending_refunds: 3,
    income_this_month: 1840000,
  },
  communications: {
    sent_this_month: 14,
    total_recipients: 23418,
    failed: 0,
  },
}

export type ActivityItem = {
  id: string
  actor: string
  actor_initials: string
  action: string
  resource: string
  resource_url: string
  time: string
  time_minutes: number
}

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: '1',
    actor: 'Carlos Araya',
    actor_initials: 'CA',
    action: 'creó el grupo',
    resource: 'Nivel 1 — Rohrmoser',
    resource_url: '/estudios/grupos',
    time: '5 min',
    time_minutes: 5,
  },
  {
    id: '2',
    actor: 'Jennifer Zamora',
    actor_initials: 'JZ',
    action: 'importó 23 donaciones',
    resource: '',
    resource_url: '/finanzas/donaciones',
    time: '12 min',
    time_minutes: 12,
  },
  {
    id: '3',
    actor: 'Admin Theos',
    actor_initials: 'AT',
    action: 'asignó rol "Dirigente" a',
    resource: 'Diego Salazar',
    resource_url: '/accesos',
    time: '1 hora',
    time_minutes: 60,
  },
  {
    id: '4',
    actor: 'Sistema',
    actor_initials: 'SY',
    action: 'envió recordatorio a 143 inscritos del',
    resource: 'Charla Dominical — Pedregal',
    resource_url: '/comunicaciones',
    time: '2 horas',
    time_minutes: 120,
  },
  {
    id: '5',
    actor: 'Laura Vargas',
    actor_initials: 'LV',
    action: 'cerró el grupo',
    resource: 'Nivel 3 — Cartago A',
    resource_url: '/estudios/grupos',
    time: 'Ayer 4:30pm',
    time_minutes: 1050,
  },
  {
    id: '6',
    actor: 'Sofía Fernández',
    actor_initials: 'SF',
    action: 'actualizó el perfil de',
    resource: 'Marcos García Vidal',
    resource_url: '/miembros/uuid-0003',
    time: 'Ayer 2:15pm',
    time_minutes: 1185,
  },
  {
    id: '7',
    actor: 'Marcos García',
    actor_initials: 'MG',
    action: 'registró check-in manual en',
    resource: 'Campamento Theos 2026',
    resource_url: '/eventos',
    time: 'Ayer 11:00am',
    time_minutes: 1320,
  },
  {
    id: '8',
    actor: 'Jennifer Zamora',
    actor_initials: 'JZ',
    action: 'procesó devolución para',
    resource: 'María Rodríguez',
    resource_url: '/finanzas/devoluciones',
    time: 'Hace 2 días',
    time_minutes: 2880,
  },
  {
    id: '9',
    actor: 'Carlos Araya',
    actor_initials: 'CA',
    action: 'publicó vacante en',
    resource: 'Comité de Bienvenida',
    resource_url: '/servidores/vacantes',
    time: 'Hace 3 días',
    time_minutes: 4320,
  },
  {
    id: '10',
    actor: 'Sistema',
    actor_initials: 'SY',
    action: 'detectó 4 posibles duplicados en',
    resource: 'Miembros',
    resource_url: '/miembros',
    time: 'Hace 3 días',
    time_minutes: 4500,
  },
]
