/**
 * FIN-11 · Informe de viaje (ANX-04), fase D.
 *
 * POR QUÉ NO SALIÓ DEL MÓDULO DE FORMULARIOS, que es lo que el plan sugería.
 * Se midió antes de decidir: `lib/forms/fill-access` deja CERRADO por defecto
 * todo formulario suelto que no tenga audiencia definida ni envío registrado
 * (decisión del 2026-08-06, puesta para que nadie se preinscribiera a CDEB
 * sin ser recomendado). Un informe de viaje es exactamente eso —un
 * formulario suelto— así que cada persona que volviera de viaje se habría
 * topado con «este formulario no está abierto para vos», y habría que
 * convocarla a mano por cada viaje. El costo de ese camino es un informe que
 * nadie puede mandar; el beneficio era poder editar las preguntas sin
 * desplegar. No compensa, y si algún día compensa, el informe se migra con
 * los datos que ya están acá.
 *
 * Módulo PURO.
 */

export type Informe = {
  actividades: string | null
  resultados: string | null
  lecciones: string | null
  recomendaciones: string | null
}

export type ProblemaDeInforme = { campo: keyof Informe; mensaje: string }

/**
 * Qué se exige para dar el informe por entregado.
 *
 * Actividades y resultados, nada más. Lecciones y recomendaciones quedan
 * opcionales a propósito: son las que no siempre hay, y exigirlas lleva a que
 * la gente escriba «ninguna» para poder seguir — que es peor que dejarlas en
 * blanco, porque un «ninguna» parece una respuesta.
 */
export function revisarInforme(d: Informe): ProblemaDeInforme[] {
  const problemas: ProblemaDeInforme[] = []
  if (!(d.actividades ?? '').trim()) {
    problemas.push({ campo: 'actividades', mensaje: 'Contá qué se hizo en el viaje.' })
  }
  if (!(d.resultados ?? '').trim()) {
    problemas.push({ campo: 'resultados', mensaje: 'Contá qué resultó del viaje.' })
  }
  return problemas
}

export const informeEstaCompleto = (d: Informe): boolean => revisarInforme(d).length === 0

/**
 * EL INFORME NO BLOQUEA LA LIQUIDACIÓN. Lo dice el plan y se respeta: la
 * plata y el reporte son dos trámites distintos, y retener el reembolso de
 * alguien hasta que escriba un texto es una sanción que el reglamento no
 * pide.
 *
 * Lo que sí hace es AVISAR al cerrar: un expediente cerrado sin informe es
 * una excepción, y quien la aprueba tiene que verla en el momento de
 * aprobarla, no descubrirla en una auditoría.
 */
export const avisarQueFaltaInforme = (d: Informe, estaCerrando: boolean): string | null =>
  estaCerrando && !informeEstaCompleto(d)
    ? 'Este viaje no tiene informe. Se puede cerrar igual, pero va a quedar así en el expediente.'
    : null

/** Los campos del anexo, en su orden, con su etiqueta y si son obligatorios. */
export const CAMPOS_DEL_INFORME: ReadonlyArray<{
  campo: keyof Informe; etiqueta: string; ayuda: string; obligatorio: boolean
}> = [
  { campo: 'actividades', etiqueta: 'Actividades realizadas', ayuda: '¿Qué se hizo, día por día?', obligatorio: true },
  { campo: 'resultados', etiqueta: 'Resultados obtenidos', ayuda: '¿Qué se logró?', obligatorio: true },
  { campo: 'lecciones', etiqueta: 'Lecciones aprendidas', ayuda: '', obligatorio: false },
  { campo: 'recomendaciones', etiqueta: 'Recomendaciones', ayuda: 'Para quien haga este viaje la próxima vez', obligatorio: false },
]

/**
 * ¿Ya hay viaje del cual informar?
 *
 * Antes de que el viaje se apruebe no hay nada que contar, y la pantalla ya
 * escondía la sección — pero la API la aceptaba igual. Esa diferencia entre
 * lo que la pantalla muestra y lo que el servidor permite es exactamente el
 * bug que se repitió todo el 2026-10-12 (permisos de eventos, adaptador de
 * dirigentes): la regla vive acá y los dos preguntan lo mismo.
 */
export const SE_PUEDE_INFORMAR: readonly string[] = [
  'aprobada', 'anticipo_entregado', 'en_viaje',
  'liquidacion_pendiente', 'liquidada',
]

export const sePuedeInformar = (estado: string): boolean =>
  SE_PUEDE_INFORMAR.includes(estado)
