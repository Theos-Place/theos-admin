// Estados del flujo de solicitud de cupos del comité (vacancies).
// Flujo lineal: creado → enviado_lider → aprobado / denegado.
// Módulo puro — usable en cliente y servidor.

export const VACANCY_STATES = ['creado', 'enviado_lider', 'aprobado', 'denegado'] as const
export type VacancyState = (typeof VACANCY_STATES)[number]

export const VACANCY_STATE_LABEL: Record<VacancyState, string> = {
  creado: 'Creado',
  enviado_lider: 'Enviado a líder',
  aprobado: 'Aprobado',
  denegado: 'Denegado',
}

/** Clases de badge (consistentes con la paleta navy/coral/teal del sistema). */
export const VACANCY_STATE_BADGE: Record<VacancyState, string> = {
  creado: 'bg-navy-light/10 text-navy-light/70',
  enviado_lider: 'bg-teal-deep/10 text-teal-deep',
  aprobado: 'bg-teal-soft/30 text-teal-deep',
  denegado: 'bg-coral/10 text-coral',
}

export function isVacancyState(v: string): v is VacancyState {
  return (VACANCY_STATES as readonly string[]).includes(v)
}
