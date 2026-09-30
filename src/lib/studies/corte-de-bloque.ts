/**
 * EST-14 · Dónde TERMINA un bloque de niveles, y qué se pregunta ahí.
 *
 * Los niveles pasan a leerse en pares: N1+N2 es un bloque y N3+N4 es el otro.
 * Dentro de un bloque la cadena sigue sola —quien aprueba N1 pasa a N2, quien
 * aprueba N3 pasa a N4—, pero ENTRE bloques hay un corte: al cerrar N2 nadie
 * pasa a N3 por inercia. El dirigente tiene que decir si su cohorte sigue.
 *
 * POR QUÉ NO SE APAGA `auto_promote` EN LA BASE, que era lo primero que uno
 * piensa: esa columna **ya no decide la promoción**. El cierre matricula al
 * siguiente nivel con `isFolletoEligible`/`FOLLETO_NEXT_LEVEL`, no con ella —
 * está en `true` para N1-N4 y en `false` para DIS1 y DIS2, que igual
 * promueven. Apagarla en N2 no habría cambiado nada y habría dejado la
 * sensación de que sí. El corte se decide acá.
 *
 * EL CATÁLOGO NO SE TOCA, PERO EL COBRO SE MUEVE (Floriana, 2026-09-30).
 * `study_plans.cost` queda como está —N1 ₡0, N2/N3/N4 ₡5.000 cada uno— y lo
 * que cambia es CUÁNDO se cobra: al entrar al bloque, no a cada nivel. El
 * monto sale de sumar el par, así que da exactamente los números de la spec
 * sin duplicar los precios en ningún lado:
 *
 *   · matricularse en N1 → cobra N1+N2 = ₡5.000, y pasar a N2 no cobra nada;
 *   · matricularse en N3 → cobra N3+N4 = ₡10.000, y pasar a N4 no cobra nada.
 *
 * Que el monto se CALCULE y no se escriba es lo que evita el modo de fallo
 * obvio: si mañana suben Nivel 4 en el catálogo, el cobro del bloque sube
 * solo. Un ₡10.000 escrito a mano se quedaría viejo sin que nadie lo note.
 *
 * Módulo PURO.
 */

/**
 * Los niveles donde termina un bloque. Cerrar uno de estos obliga a responder
 * si la cohorte continúa.
 *
 * Es un set y no un `=== 'N2'` porque el día que los bloques cambien —o que
 * entre otra cadena con corte— se agrega una línea. Hoy es uno solo, y el
 * test lo fija para que agregar otro sea una decisión y no un descuido.
 */
export const NIVELES_QUE_CIERRAN_BLOQUE: ReadonlySet<string> = new Set(['N2'])

/** ¿Cerrar este plan termina un bloque? */
export function hayCorteAlCerrar(planCode: string | null | undefined): boolean {
  return !!planCode && NIVELES_QUE_CIERRAN_BLOQUE.has(planCode)
}

export type RespuestaDelCorte = boolean | null | undefined

/**
 * null = se puede cerrar. Si no, qué falta.
 *
 * LA RESPUESTA ES OBLIGATORIA y no tiene valor por omisión, ni siquiera
 * «sí». Un default reproduce el problema que este ítem viene a resolver: hoy
 * el sucesor se crea SIEMPRE, y por eso aparecen grupos de N3 que nadie pidió
 * con gente matriculada y cobrada. Si el dirigente no contesta, no se cierra.
 */
export function motivoQueImpideCerrar(
  planCode: string | null | undefined,
  continua: RespuestaDelCorte,
): string | null {
  if (!hayCorteAlCerrar(planCode)) return null
  if (continua === true || continua === false) return null
  return 'Antes de cerrar hay que decir si el grupo continúa a Nivel 3.'
}

/**
 * ¿Este cierre crea el grupo del nivel siguiente?
 *
 * Fuera de un corte se comporta como siempre (lo decide el llamador con
 * `isFolletoEligible`); en un corte manda la respuesta del dirigente.
 */
export function creaSucesor(
  planCode: string | null | undefined,
  continua: RespuestaDelCorte,
): boolean {
  if (!hayCorteAlCerrar(planCode)) return true
  return continua === true
}

/**
 * Lo que hay que avisarle al comité cuando la cohorte NO sigue.
 *
 * El correo existe porque el «no» deja un hueco que nadie ve: el grupo se
 * cierra, los estudiantes quedan sin sucesor y el sistema —hasta hoy— no se lo
 * decía a nadie. Con el esquema viejo eso no pasaba porque el sucesor se
 * creaba solo.
 *
 * LLEVA LOS DATOS PARA DECIDIR, no solo el aviso: qué grupo, qué dirigente
 * (que es quien no continúa), dónde y cuándo se reunía, y cuántos estudiantes
 * quedaron colgando. Sin eso, quien lo recibe tiene que ir a buscarlo todo.
 */
export type AvisoDeCorte = {
  grupo: string
  dirigente: string | null
  zona: string | null
  horario: string | null
  /** Cuántos aprobaron y se quedaron sin grupo al cual pasar. */
  estudiantes: number
}

export function asuntoDelCorte(aviso: AvisoDeCorte): string {
  return `El grupo ${aviso.grupo} no continúa a Nivel 3`
}

/** Las líneas del cuerpo. El render lo hace el llamador con el baseLayout. */
export function lineasDelCorte(aviso: AvisoDeCorte): string[] {
  const donde = [aviso.zona, aviso.horario].filter(Boolean).join(' · ')
  return [
    `El dirigente cerró <strong>${aviso.grupo}</strong> y respondió que la cohorte `
      + 'NO continúa a Nivel 3, así que el sistema no creó el grupo siguiente.',
    aviso.dirigente ? `Dirigente: <strong>${aviso.dirigente}</strong> (no continúa).` : '',
    donde ? `Se reunía en: ${donde}.` : '',
    aviso.estudiantes === 1
      ? 'Queda <strong>1 estudiante</strong> aprobado sin grupo al cual pasar.'
      : `Quedan <strong>${aviso.estudiantes} estudiantes</strong> aprobados sin grupo al cual pasar.`,
    'Hay que crearles un grupo de Nivel 3 en la misma zona, o matricularlos en '
      + 'la oferta abierta.',
  ].filter(Boolean)
}

/* ────────────────────────────────────────────────────────────────────────────
 * LOS BLOQUES, y quién cobra
 * ──────────────────────────────────────────────────────────────────────────── */

/** Los pares. El primero de cada uno es donde se entra y donde se cobra. */
export const BLOQUES_DE_NIVELES: ReadonlyArray<readonly string[]> = [
  ['N1', 'N2'],
  ['N3', 'N4'],
]

/** El bloque al que pertenece un nivel, o null si no está en ninguno. */
export function bloqueDe(planCode: string | null | undefined): readonly string[] | null {
  if (!planCode) return null
  return BLOQUES_DE_NIVELES.find(b => b.includes(planCode)) ?? null
}

/** ¿Entrar acá es entrar a un bloque? (N1 y N3.) */
export function esInicioDeBloque(planCode: string | null | undefined): boolean {
  return bloqueDe(planCode)?.[0] === planCode
}

/** ¿Es la segunda mitad de un bloque? (N2 y N4.) Ahí NO se cobra: el cobro ya
 *  se hizo al entrar. */
export function esContinuacionDeBloque(planCode: string | null | undefined): boolean {
  const b = bloqueDe(planCode)
  return !!b && b[0] !== planCode
}

/**
 * Qué niveles hay que cobrar al matricularse en éste.
 *
 *   · N1 → ['N1','N2']   (el bloque entero, por adelantado)
 *   · N2 → []            (ya se pagó al entrar al bloque)
 *   · N3 → ['N3','N4']
 *   · N4 → []
 *   · cualquier otro → [él mismo]  ← todo lo que no es un nivel sigue igual
 *
 * La última línea importa: capacitaciones, prematrimonial y discípulos NO
 * entran en bloques y tienen que seguir cobrándose como siempre. Si esta
 * función devolviera `[]` para ellos, se volverían gratis de un día para otro.
 */
export function nivelesACobrar(planCode: string | null | undefined): readonly string[] {
  if (!planCode) return []
  const b = bloqueDe(planCode)
  if (!b) return [planCode]
  return b[0] === planCode ? b : []
}

/**
 * El monto del bloque, sumando lo que cada nivel vale en el catálogo.
 *
 * `costos` lo trae el llamador (una consulta a `study_plans`). Un nivel que
 * falte en el mapa cuenta 0 y se avisa: preferible cobrar de menos y que
 * alguien lo note, a cobrar un número inventado.
 */
export function montoDelBloque(
  planCode: string | null | undefined,
  costos: Readonly<Record<string, number>>,
): number {
  return nivelesACobrar(planCode)
    .reduce((total, code) => total + (Number(costos[code]) || 0), 0)
}
