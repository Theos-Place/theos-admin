// PRE-11 · El prematrimonial se da EN PAREJA.
//
// Un grupo de PREMAT sin co-dirigente no es un grupo incompleto: es un grupo que
// no se puede dar. Por eso los dos son obligatorios, y solo en este tipo de
// grupo — el resto sigue igual, con el co-dirigente opcional.
//
// QUIÉN PUEDE DARLO. La marca existía y no hubo que inventar nada: PREMAT
// aparece en `study_leaders.formation_study_codes` (32 dirigentes) y en
// `qualified_study_codes` (30). Se acepta CUALQUIERA de las dos porque los datos
// están repartidos —28 la tienen en las dos, 4 solo en formación y 2 solo en
// disponibilidad— y dejar fuera del dropdown a alguien realmente habilitado es
// peor que ofrecer un conjunto un poco más amplio: el coordinador igual elige.
// Al 2026-08-21 eso da 34 personas, 17 de ellas activas.

export const PREMAT_PLAN_CODE = 'PREMAT'

/** ¿Este grupo es de prematrimonial? Se decide por el CODE del plan. */
export function isPrematGroup(planCode: string | null | undefined): boolean {
  return (planCode ?? '').trim().toUpperCase() === PREMAT_PLAN_CODE
}

export type LeaderCapability = {
  /** Para qué está capacitado. */
  formacion?: readonly string[] | null
  /** Qué está dispuesto a dar ahora. */
  disponibilidad?: readonly string[] | null
}

/** ¿Está esta persona habilitada para dar prematrimonial? */
export function canLeadPremat(l: LeaderCapability | null | undefined): boolean {
  if (!l) return false
  const tiene = (v: readonly string[] | null | undefined) =>
    (v ?? []).some(c => (c ?? '').trim().toUpperCase() === PREMAT_PLAN_CODE)
  return tiene(l.formacion) || tiene(l.disponibilidad)
}

/**
 * Qué falta para poder guardar un grupo de PREMAT. `null` = está bien.
 *
 * Devuelve UN mensaje por vez y en orden de lo que la persona tiene que resolver
 * primero: no sirve decirle "falta el co-dirigente y además el dirigente no está
 * habilitado" si todavía no eligió a nadie.
 */
export function prematGroupError(input: {
  planCode: string | null | undefined
  leaderId: string | null | undefined
  coLeaderId: string | null | undefined
  /** Resuelve la habilitación de un miembro. Null = no se pudo resolver, y en
   *  ese caso NO se bloquea: un dato que falta no puede impedir crear el grupo
   *  (el guard de habilitación es una ayuda, no una barrera de seguridad). */
  capabilityOf?: (memberId: string) => LeaderCapability | null
}): string | null {
  if (!isPrematGroup(input.planCode)) return null

  const leader = (input.leaderId ?? '').trim()
  const coLeader = (input.coLeaderId ?? '').trim()

  if (!leader) return 'El prematrimonial se da en pareja: elegí el dirigente.'
  if (!coLeader) return 'El prematrimonial se da en pareja: falta el co-dirigente.'
  if (leader === coLeader) return 'El dirigente y el co-dirigente tienen que ser dos personas distintas.'

  if (input.capabilityOf) {
    for (const [id, rol] of [[leader, 'dirigente'], [coLeader, 'co-dirigente']] as const) {
      const cap = input.capabilityOf(id)
      if (cap && !canLeadPremat(cap)) {
        return `Quien elegiste como ${rol} no está habilitado para dar prematrimonial.`
      }
    }
  }
  return null
}
