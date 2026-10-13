/**
 * DIR-8 · El indicador «Dirigente» del resumen del perfil.
 *
 * EL BUG QUE ARREGLA. Los otros cuatro indicadores —donante, servidor,
 * asistente, estudiante— aparecen SIEMPRE: encendidos o apagados, pero
 * aparecen. El de dirigente era el único que se escondía del todo cuando la
 * persona no estaba activa.
 *
 * El resultado era un perfil que se contradecía: la ficha dice que es
 * dirigente, hay pestaña «Dirigente», hay enlace a su ficha de dirigente, y
 * arriba no hay nada. Quien lo mira concluye que el sistema perdió el dato.
 *
 * Ahora: aparece para quien TIENE ficha, y se apaga si no está activo. Que
 * es lo mismo que hacen los otros cuatro.
 *
 * QUÉ NO LLEVA. Ni la sub-razón, ni la banderita, ni las notas: este resumen
 * lo ven muchos más roles que la ficha administrativa, y «por qué» alguien
 * no está activo es justamente lo que no se reparte. Solo encendido/apagado.
 *
 * Módulo PURO.
 */

export type BadgeDeDirigente =
  | { mostrar: false }
  | { mostrar: true; activo: boolean; etiqueta: string; tooltip: string }

export function badgeDeDirigente(input: {
  /** Tiene ficha de dirigente, activa o no. */
  tieneFicha: boolean
  /** Está activo como dirigente (servidor activo en el comité). */
  activo: boolean
}): BadgeDeDirigente {
  if (!input.tieneFicha && !input.activo) return { mostrar: false }
  return {
    mostrar: true,
    activo: input.activo,
    etiqueta: 'Dirigente',
    tooltip: input.activo ? 'Dirigente activo' : 'Dirigente inactivo',
  }
}
