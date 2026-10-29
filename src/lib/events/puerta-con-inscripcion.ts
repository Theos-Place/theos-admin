/**
 * EVE-15 (2026-10-29) · La puerta de un evento que REQUIERE inscripción.
 *
 * Tres cosas que la fila necesita saber al instante, todas puras:
 *  · si la persona que se seleccionó está inscrita (y cómo);
 *  · quiénes se inscribieron por el link público, sin ficha, para poder
 *    encontrarlos por nombre y marcarles la llegada contra esa inscripción;
 *  · los conteos: inscritos presentes, inscritos ausentes y los que llegaron
 *    sin inscripción.
 *
 * Nada de esto bloquea: la puerta decide, el sistema avisa y deja marca.
 */

/** Inscripción por el link público (form_responses sin member_id). */
export type Invitado = { id: string; nombre: string; email: string | null }

export type CheckinDeLaPuerta = {
  member_id?: string | null
  form_response_id?: string | null
  sin_inscripcion?: boolean | null
}

/** Minúsculas, sin tildes, espacios colapsados. */
export function normalizarNombre(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

export type EstadoDeInscripcion =
  | { estado: 'inscrito' }
  | { estado: 'no_inscrito' }
  /** El evento no pide inscripción: no hay nada que avisar. */
  | { estado: 'no_aplica' }

export function estadoDeInscripcion(
  event: { requires_registration: boolean },
  memberId: string,
  inscritos: ReadonlyArray<{ member_id: string }>,
): EstadoDeInscripcion {
  if (!event.requires_registration) return { estado: 'no_aplica' }
  return inscritos.some(r => r.member_id === memberId) ? { estado: 'inscrito' } : { estado: 'no_inscrito' }
}

/** Invitados cuyo nombre contiene lo escrito (2+ letras), sin tildes ni mayúsculas. */
export function buscarInvitados(invitados: ReadonlyArray<Invitado>, query: string): Invitado[] {
  const q = normalizarNombre(query)
  if (q.length < 2) return []
  return invitados.filter(i => normalizarNombre(i.nombre).includes(q))
}

/**
 * ¿Hay UNA ficha con exactamente ese nombre? Se sugiere el vínculo, no se
 * aplica: con cero o con dos no se dice nada (regla de AGENTS.md para cruzar
 * por nombre). Devuelve el candidato o null.
 */
export function sugerirVinculo<T extends { id: string; name: string }>(
  invitado: Invitado, miembros: ReadonlyArray<T>,
): T | null {
  const n = normalizarNombre(invitado.nombre)
  if (!n) return null
  const iguales = miembros.filter(m => normalizarNombre(m.name) === n)
  return iguales.length === 1 ? iguales[0] : null
}

export type ConteosDeLaPuerta = {
  inscritos: number
  presentes: number
  ausentes: number
  sinInscripcion: number
}

/**
 * Presente = inscrito con ficha que tiene check-in por member_id, o invitado
 * con check-in por form_response_id. Lo que llega sin inscripción se cuenta
 * aparte: un check-in con `sin_inscripcion`, o uno de miembro que no figura
 * entre los inscritos (el flag lo pone el servidor, pero se calcula también
 * por si una fila vieja no lo trae).
 */
export function conteosDeLaPuerta(input: {
  inscritos: ReadonlyArray<{ member_id: string }>
  invitados: ReadonlyArray<{ id: string }>
  checkins: ReadonlyArray<CheckinDeLaPuerta>
}): ConteosDeLaPuerta {
  const idsInscritos = new Set(input.inscritos.map(r => r.member_id))
  const idsInvitados = new Set(input.invitados.map(i => i.id))
  const presentesMiembros = new Set<string>()
  const presentesInvitados = new Set<string>()
  let sinInscripcion = 0
  for (const c of input.checkins) {
    if (c.member_id && idsInscritos.has(c.member_id)) { presentesMiembros.add(c.member_id); continue }
    if (c.form_response_id && idsInvitados.has(c.form_response_id)) { presentesInvitados.add(c.form_response_id); continue }
    if (c.sin_inscripcion || c.member_id) sinInscripcion++
  }
  const inscritos = idsInscritos.size + idsInvitados.size
  const presentes = presentesMiembros.size + presentesInvitados.size
  return { inscritos, presentes, ausentes: inscritos - presentes, sinInscripcion }
}

/** Cómo llegó cada check-in a un evento con inscripción, para listas y CSV. */
export type OrigenDeCheckin = 'inscrito' | 'por_el_link' | 'sin_inscripcion'

export function origenDeCheckin(
  c: CheckinDeLaPuerta, inscritos: ReadonlySet<string>,
): OrigenDeCheckin {
  if (c.form_response_id && !c.member_id) return 'por_el_link'
  if (c.sin_inscripcion) return 'sin_inscripcion'
  if (c.member_id && inscritos.has(c.member_id)) return 'inscrito'
  if (c.form_response_id) return 'inscrito'
  return 'sin_inscripcion'
}

export const TEXTO_DE_ORIGEN: Record<OrigenDeCheckin, string> = {
  inscrito: 'Inscrito/a',
  por_el_link: 'Por el link, sin ficha',
  sin_inscripcion: 'Sin inscripción',
}

/** Los check-ins que llegaron sin inscripción, para la lista del evento. */
export function llegaronSinInscripcion<T extends CheckinDeLaPuerta>(
  checkins: ReadonlyArray<T>, inscritos: ReadonlyArray<{ member_id: string }>,
): T[] {
  const ids = new Set(inscritos.map(r => r.member_id))
  return checkins.filter(c => origenDeCheckin(c, ids) === 'sin_inscripcion')
}

export function textoDeConteos(c: ConteosDeLaPuerta): string {
  const partes = [`${c.presentes} de ${c.inscritos} inscritos presentes`]
  if (c.sinInscripcion > 0) partes.push(`${c.sinInscripcion} sin inscripción`)
  return partes.join(' · ')
}
