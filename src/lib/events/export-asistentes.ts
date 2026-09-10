/**
 * EVE-9 · Las filas del export de asistentes a un evento.
 *
 * Para qué es: cocina y logística. Por eso el export existe — la alergia y la
 * restricción alimenticia se capturan justamente para esta hoja, y hasta ahora
 * no tenían dónde salir.
 *
 * Dos listas alimentan una sola tabla: quién se INSCRIBIÓ (event_registrations)
 * y quién LLEGÓ (event_checkins). Se cruzan por persona porque cocina necesita
 * una fila por ser humano, no una por registro: alguien inscrito que además hizo
 * check-in no come dos veces.
 *
 * La distinción participante/servidor sale de `checked_in_as`. Servir CUENTA
 * como asistir (regla fijada en calidad-checkin.ts), así que un servidor no se
 * omite: aparece con su etiqueta.
 */
import { textoDeRestricciones } from '@/lib/members/restriccion-alimenticia'

export type PersonaDelEvento = {
  member_id: string
  first_name: string | null
  last_name: string | null
  cedula?: string | null
  phone?: string | null
  email?: string | null
  allergies?: string | null
  dietary_restrictions?: readonly string[] | null
}

export type InscripcionParaExport = {
  member_id: string
  payment_status?: string | null
  registered_at?: string | null
}

export type CheckinParaExport = {
  /** id del check-in: es la llave de los invitados, que no tienen ficha. */
  id?: string | null
  member_id: string | null
  /** Un check-in de invitado no trae member_id, solo el nombre escrito a mano.
   *  Igual come, así que igual va en la lista. */
  guest_name?: string | null
  checked_in_at?: string | null
  checked_in_as?: string | null
  sub_event_id?: string | null
}

export type FilaDeAsistente = {
  nombre: string
  cedula: string
  telefono: string
  correo: string
  /** 'Inscrito', 'Asistió' o 'Inscrito y asistió'. */
  estado: string
  /** 'Participante' | 'Servidor' | '—' (no llegó, así que no hay dato). */
  participante_o_servidor: string
  sub_evento: string
  hora_de_llegada: Date | null
  pago: string
  alergias: string
  restriccion_alimenticia: string
}

const ETIQUETA_ASISTENCIA: Record<string, string> = {
  asistente: 'Participante',
  servidor: 'Servidor',
}

const ETIQUETA_PAGO: Record<string, string> = {
  paid: 'Pagado',
  pagado: 'Pagado',
  pending: 'Pendiente',
  pendiente: 'Pendiente',
  exempt: 'Exonerado',
  exonerado: 'Exonerado',
  expired: 'Vencida',
  expirada: 'Vencida',
  cancelled: 'Cancelada',
  cancelada: 'Cancelada',
}

function nombreDe(p: PersonaDelEvento): string {
  const n = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return n || 'Sin nombre'
}

function fecha(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * @param usaInscripcion  `events.requires_registration`. Si el evento no la usa,
 *   la columna de pago no dice 'Pendiente' para todo el mundo: dice 'N/A'. Es la
 *   misma regla que inscripcion-visible.ts aplica en pantalla.
 */
export function filasDeAsistentes(input: {
  personas: readonly PersonaDelEvento[]
  inscripciones: readonly InscripcionParaExport[]
  checkins: readonly CheckinParaExport[]
  subEventos?: ReadonlyMap<string, string>
  usaInscripcion: boolean
}): FilaDeAsistente[] {
  const { personas, inscripciones, checkins, usaInscripcion } = input
  const subEventos = input.subEventos ?? new Map<string, string>()
  const porId = new Map(personas.map(p => [p.member_id, p]))

  const inscripcionPorId = new Map<string, InscripcionParaExport>()
  for (const i of inscripciones) if (!inscripcionPorId.has(i.member_id)) inscripcionPorId.set(i.member_id, i)

  // Clave de agrupación: la ficha si la hay, y si no el propio check-in — un
  // invitado no tiene con qué cruzarse y es una fila suya.
  const claveDe = (c: CheckinParaExport) => c.member_id ?? `invitado:${c.id ?? c.guest_name ?? ''}`

  // Con dos check-ins de la misma persona (pasa: se corrige un sub-evento) vale
  // el PRIMERO — es la hora en que de verdad llegó.
  const checkinPorId = new Map<string, CheckinParaExport>()
  for (const c of checkins) {
    const k = claveDe(c)
    const previo = checkinPorId.get(k)
    if (!previo) { checkinPorId.set(k, c); continue }
    const a = fecha(previo.checked_in_at)?.getTime() ?? Infinity
    const b = fecha(c.checked_in_at)?.getTime() ?? Infinity
    if (b < a) checkinPorId.set(k, c)
  }

  const ids = [...new Set([...inscripcionPorId.keys(), ...checkinPorId.keys()])]
  const filas = ids.map<FilaDeAsistente>(id => {
    const ins = inscripcionPorId.get(id)
    const chk = checkinPorId.get(id)
    const p = porId.get(id)
      ?? { member_id: id, first_name: chk?.guest_name ?? null, last_name: null }
    const esInvitado = !!chk && !chk.member_id
    const estado = ins && chk ? 'Inscrito y asistió'
      : esInvitado ? 'Asistió (invitado, sin ficha)'
      : chk ? 'Asistió'
      : 'Inscrito'
    const pagoCrudo = ins?.payment_status ?? null
    return {
      nombre: nombreDe(p),
      cedula: p.cedula ?? '',
      telefono: p.phone ?? '',
      correo: p.email ?? '',
      estado,
      // Sin check-in no hay dato que reportar, y poner 'Participante' por
      // defecto sería inventarlo.
      participante_o_servidor: chk ? (ETIQUETA_ASISTENCIA[chk.checked_in_as ?? ''] ?? 'Participante') : '—',
      sub_evento: chk?.sub_event_id ? (subEventos.get(chk.sub_event_id) ?? '') : '',
      hora_de_llegada: fecha(chk?.checked_in_at),
      pago: !usaInscripcion ? 'N/A' : pagoCrudo ? (ETIQUETA_PAGO[pagoCrudo] ?? pagoCrudo) : '—',
      alergias: p.allergies?.trim() || '—',
      restriccion_alimenticia: textoDeRestricciones(p.dietary_restrictions),
    }
  })

  // Alfabético: la hoja se lee buscando a una persona, no en orden de llegada.
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** ¿Alguien de esta lista necesita algo especial de cocina? Va en el nombre del
 *  archivo y en un resumen arriba de la hoja, para que no haya que leer 200
 *  filas para descubrir que hay una persona celíaca. */
export function resumenDeCocina(filas: readonly FilaDeAsistente[]): {
  conAlergia: number
  conRestriccion: number
} {
  return {
    conAlergia: filas.filter(f => f.alergias !== '—').length,
    conRestriccion: filas.filter(f => f.restriccion_alimenticia !== '—').length,
  }
}
