/**
 * «Tiene beca aprobada y no se puede aplicar»: por qué, dicho de frente.
 *
 * EL CASO (Floriana, 2026-10-09): a William Castro le aprobaron una beca el
 * 30 de setiembre y el modal decía «esta persona no tiene una beca asignada
 * para este cobro». Es verdad y es inútil: la beca es de NIVEL 3 y el cobro
 * es de NIVEL 2, y eso el mensaje no lo decía. Ella tuvo que preguntar.
 *
 * El sistema hizo bien en no aplicarla —una beca es un descuento para ESE
 * estudio, no un saldo— pero callar el motivo convierte una regla correcta
 * en lo que parece un bug.
 *
 * Módulo puro: arma el texto. Quién tiene qué beca lo resuelve la query.
 */

export type BecaAjena = {
  /** Para qué es: «Nivel 3», «Campa de Servidores». */
  destino: string | null
  /** 'study_plan' | 'event' */
  entity_type: string | null
}

/**
 * El aviso cuando la persona SÍ tiene becas activas pero ninguna sirve acá.
 * `null` cuando no tiene ninguna — ahí el mensaje de siempre está bien.
 *
 * Nombra el destino. «Tiene una beca para otra cosa» obliga a ir a buscar
 * cuál, que es el viaje que este texto existe para ahorrar.
 */
export function avisoDeBecaQueNoCalza(becas: ReadonlyArray<BecaAjena>): string | null {
  const destinos = [...new Set(
    becas.map(b => (b.destino ?? '').trim()).filter(Boolean),
  )]
  if (destinos.length === 0) return null
  if (destinos.length === 1) {
    return `Tiene una beca aprobada, pero es para ${destinos[0]} y este cobro no es de ahí. `
      + 'Una beca aplica solo al estudio o la actividad para la que se aprobó.'
  }
  return `Tiene becas aprobadas para ${destinos.slice(0, -1).join(', ')} y ${destinos.at(-1)}, `
    + 'pero ninguna es de este cobro. Una beca aplica solo al estudio o la '
    + 'actividad para la que se aprobó.'
}
