// Types live in @/types/event — imported here for internal use, re-exported for consumers.
import type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, MockEvent, EventTypeEntry } from '@/types/event'
export type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, MockEvent, EventTypeEntry }
// Backward-compat alias: PaymentStatus was the original name for EventPaymentStatus in this file.
export type { EventPaymentStatus as PaymentStatus } from '@/types/event'

// Internal alias so helper functions below keep working without changes.
type PaymentStatus = EventPaymentStatus

function makeRegistrations(count: number, prefix: string): EventRegistration[] {
  const names = [
    'José Pérez', 'Ana Salas', 'Luis Vargas', 'María Jiménez', 'Carlos Mora',
    'Sofía Rodríguez', 'Daniel Castro', 'Valeria Rojas', 'Andrés Ulate', 'Camila Soto',
    'Roberto Madrigal', 'Fernanda León', 'Esteban Quirós', 'Laura Chacón', 'Miguel Solano',
    'Isabella Fonseca', 'Sebastián Oviedo', 'Gabriela Araya', 'Pablo Méndez', 'Karen Brenes',
    'Diego Monge', 'Natalia Vindas', 'Fabian Zamora', 'Daniela Espinoza', 'Christian Badilla',
    'Paola Gutiérrez', 'Marco Hernández', 'Stephanie Cruz', 'Josué Calvo', 'Alondra Torres',
    'Ricardo Benavides', 'Andrea Aguilar', 'Víctor Salazar', 'Monica Bolaños', 'Alejandro Mora',
    'Patricia Villalobos', 'David Núñez', 'Silvia Picado', 'Felipe Porras', 'Lucía Alvarado',
    'Jonathan Blanco', 'Melissa Sandoval', 'Eduardo Gamboa', 'Tatiana Segura', 'Manuel Montes',
    'Priscilla Varela', 'Julio Bonilla', 'Adriana Mena', 'Rodrigo Paniagua', 'Karina Vásquez',
    'Gerardo Fernández', 'Xiomara Bolaños', 'Alexis Campos', 'Rebeca Ureña', 'Wilbert Alfaro',
    'Cristina Morales', 'Omar Camacho', 'Jessica Contreras', 'Arnoldo Elizondo', 'Wendy Barrantes',
    'Herbert Fuentes', 'Cindy Obando', 'Edwin Murillo', 'Yessenia Trejos', 'Bruno Cordero',
    'Karla Gómez', 'Marco Leiva', 'Diana Angulo', 'Ernesto Solís', 'Ileana Céspedes',
    'Ronny Quesada', 'Tatiana Ramírez', 'Harold Montero', 'Yerlan Vargas', 'Nancy Chaves',
    'Bryan Coto', 'Alexandra Méndez', 'Mauricio Barboza', 'Kathia Ramírez', 'Arturo Hidalgo',
    'Flor Godínez', 'Leonard Granados', 'Vanessa Sequeira', 'Anthony Argueta', 'Miriam Bonilla',
    'Álvaro Vindas', 'Ingrid Alfaro', 'Danilo Caballero', 'Adriana Quirós', 'Steven Acosta',
    'Maricela Piedra', 'Joselyn Loría', 'Franklin Prado', 'Yolanda Gutiérrez', 'Cesar Azofeifa',
  ]
  const statuses: PaymentStatus[] = ['paid', 'paid', 'paid', 'pending', 'exempted']
  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    member_id: `${prefix}-m-${i + 1}`,
    member_name: names[i % names.length],
    payment_status: statuses[i % statuses.length],
    registered_at: `2026-0${Math.floor(i / 30) + 3}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  }))
}

function makeCheckins(count: number, prefix: string, subEventIds: string[] | null): EventCheckin[] {
  const names = [
    'José Pérez', 'Ana Salas', 'Luis Vargas', 'María Jiménez', 'Carlos Mora',
    'Sofía Rodríguez', 'Daniel Castro', 'Valeria Rojas', 'Andrés Ulate', 'Camila Soto',
    'Roberto Madrigal', 'Fernanda León', 'Esteban Quirós', 'Laura Chacón', 'Miguel Solano',
    'Isabella Fonseca', 'Sebastián Oviedo', 'Gabriela Araya', 'Pablo Méndez', 'Karen Brenes',
    'Diego Monge', 'Natalia Vindas', 'Fabian Zamora', 'Daniela Espinoza', 'Christian Badilla',
    'Paola Gutiérrez', 'Marco Hernández', 'Stephanie Cruz', 'Josué Calvo', 'Alondra Torres',
    'Ricardo Benavides', 'Andrea Aguilar', 'Víctor Salazar', 'Monica Bolaños', 'Alejandro Mora',
    'Patricia Villalobos', 'David Núñez', 'Silvia Picado', 'Felipe Porras', 'Lucía Alvarado',
    'Jonathan Blanco', 'Melissa Sandoval', 'Eduardo Gamboa', 'Tatiana Segura', 'Manuel Montes',
    'Priscilla Varela', 'Julio Bonilla', 'Adriana Mena', 'Rodrigo Paniagua', 'Karina Vásquez',
    'Gerardo Fernández', 'Xiomara Bolaños', 'Alexis Campos', 'Rebeca Ureña', 'Wilbert Alfaro',
    'Cristina Morales', 'Omar Camacho', 'Jessica Contreras', 'Arnoldo Elizondo', 'Wendy Barrantes',
    'Herbert Fuentes', 'Cindy Obando', 'Edwin Murillo', 'Yessenia Trejos', 'Bruno Cordero',
    'Karla Gómez', 'Marco Leiva', 'Diana Angulo', 'Ernesto Solís', 'Ileana Céspedes',
    'Ronny Quesada', 'Tatiana Ramírez', 'Harold Montero', 'Yerlan Vargas', 'Nancy Chaves',
    'Bryan Coto', 'Alexandra Méndez', 'Mauricio Barboza', 'Kathia Ramírez', 'Arturo Hidalgo',
    'Flor Godínez', 'Leonard Granados', 'Vanessa Sequeira', 'Anthony Argueta', 'Miriam Bonilla',
    'Álvaro Vindas', 'Ingrid Alfaro', 'Danilo Caballero', 'Adriana Quirós', 'Steven Acosta',
    'Maricela Piedra', 'Joselyn Loría', 'Franklin Prado', 'Yolanda Gutiérrez', 'Cesar Azofeifa',
  ]
  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    id: `${prefix}-c-${i + 1}`,
    member_id: `${prefix}-m-${i + 1}`,
    member_name: names[i % names.length],
    attendance_type: (i % 6 === 0 ? 'server' : 'participant') as AttendanceType,
    sub_event_id: subEventIds ? subEventIds[i % subEventIds.length] : null,
    checked_at: `2026-05-${String((i % 10) + 1).padStart(2, '0')}T${String(17 + (i % 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`,
  }))
}

const CHARLA_SUB_EVENTS: SubEvent[] = [
  { id: 'kids', name: 'Kids', max_capacity: 80 },
  { id: 'teens', name: 'Teens', max_capacity: 50 },
]

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  charla:       { label: 'Charla',       color: 'navy' },
  campamento:   { label: 'Campamento',   color: 'teal' },
  social:       { label: 'Social',       color: 'coral' },
  capacitacion: { label: 'Capacitación', color: 'amber' },
}

/** Config de un tipo de evento, con fallback para tipos custom/desconocidos
 *  (el catálogo de la BD permite tipos que no están en EVENT_TYPE_CONFIG; sin
 *  este fallback, leerles .color/.label rompía la página de eventos). */
export function eventTypeConfig(type: string): { label: string; color: string } {
  return EVENT_TYPE_CONFIG[type as EventType] ?? { label: type || 'Evento', color: 'navy' }
}

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  upcoming:    { label: 'Próximo',      color: 'teal' },
  in_progress: { label: 'En curso',     color: 'coral' },
  finished:    { label: 'Finalizado',   color: 'navy' },
  cancelled:   { label: 'Cancelado',    color: 'red' },
  archived:    { label: 'Archivado',    color: 'gray' },
}
