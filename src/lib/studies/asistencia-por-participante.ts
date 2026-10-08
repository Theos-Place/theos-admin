/**
 * La asistencia vista POR PERSONA, no por sesión.
 *
 * La pantalla del grupo mostraba «Sesión 3 · 23 sep · 4/6 presentes» y nada
 * más. Un dirigente puede leer ahí cuánta gente fue, pero no QUIÉN — que es
 * justo lo que necesita para llamar al que lleva tres semanas sin aparecer
 * (pedido de Floriana, 2026-10-07).
 *
 * LO QUE ESTE MÓDULO CUIDA, Y ES TODO EL PUNTO: «no fue» y «no estaba» no son
 * lo mismo. Una persona que se matriculó en la sesión 4 no tiene fila de
 * asistencia en las sesiones 1 a 3, y pintarla como ausente le inventaría
 * tres faltas que nadie le puso. Por eso el estado por celda tiene TRES
 * valores y el porcentaje se calcula sobre las sesiones donde a esa persona
 * sí le pasaron lista.
 */

/** Qué sabemos de una persona en una sesión. */
export type EstadoDeCelda = 'presente' | 'ausente' | 'sin_registro'

export type FilaDeAsistencia = {
  member_id: string
  nombre: string
  /** Estado por sesión, en el mismo orden que `sesiones`. */
  celdas: EstadoDeCelda[]
  presentes: number
  /** Sesiones donde a esta persona se le pasó lista (presente + ausente). */
  registradas: number
  /** `presentes / registradas` en porcentaje entero, o null si nunca se le pasó lista. */
  porcentaje: number | null
}

export const ETIQUETA_DE_CELDA: Record<EstadoDeCelda, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  sin_registro: 'Sin registro',
}

/**
 * Arma la matriz. `sesiones` manda el orden de las columnas; `participantes`
 * el de las filas.
 *
 * Una marca de alguien que ya no está en el grupo se ignora: la fila no
 * existiría y la columna quedaría desalineada con el resto.
 */
export function matrizDeAsistencia(input: {
  sesiones: ReadonlyArray<{ id: string }>
  participantes: ReadonlyArray<{ member_id: string; nombre: string }>
  marcas: ReadonlyArray<{ session_id: string; member_id: string; present: boolean }>
}): FilaDeAsistencia[] {
  const porPersona = new Map<string, Map<string, boolean>>()
  for (const m of input.marcas) {
    let fila = porPersona.get(m.member_id)
    if (!fila) { fila = new Map(); porPersona.set(m.member_id, fila) }
    fila.set(m.session_id, m.present)
  }

  return input.participantes.map(p => {
    const suyas = porPersona.get(p.member_id)
    const celdas: EstadoDeCelda[] = input.sesiones.map(s => {
      const v = suyas?.get(s.id)
      return v === undefined ? 'sin_registro' : v ? 'presente' : 'ausente'
    })
    const presentes = celdas.filter(c => c === 'presente').length
    const registradas = celdas.filter(c => c !== 'sin_registro').length
    return {
      member_id: p.member_id,
      nombre: p.nombre,
      celdas,
      presentes,
      registradas,
      porcentaje: registradas === 0 ? null : Math.round((presentes / registradas) * 100),
    }
  })
}

/**
 * A quién llamar: tres o más faltas seguidas AL FINAL de la lista.
 *
 * Se miran las últimas, no el total: alguien que faltó tres veces en agosto y
 * viene todas las semanas desde entonces no necesita una llamada, y mezclarlo
 * con quien lleva un mes perdido vuelve el aviso ruido que nadie mira.
 *
 * Las sesiones sin registro CORTAN la racha en vez de sumarla: no sabemos si
 * fue o no fue, y dar por falta lo que no se midió es inventar.
 */
export const FALTAS_PARA_AVISAR = 3

export function faltasSeguidasAlFinal(celdas: ReadonlyArray<EstadoDeCelda>): number {
  let n = 0
  for (let i = celdas.length - 1; i >= 0; i--) {
    if (celdas[i] !== 'ausente') break
    n++
  }
  return n
}

export function hayQueLlamar(celdas: ReadonlyArray<EstadoDeCelda>): boolean {
  return faltasSeguidasAlFinal(celdas) >= FALTAS_PARA_AVISAR
}
