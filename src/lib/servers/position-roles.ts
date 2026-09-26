// Mapeo puesto → rol automático (módulo PURO, sin server). Fuente única de
// verdad: qué puestos de servicio otorgan qué rol del sistema al ocupante.
// Extensible: agregar una regla nueva a POSITION_ROLE_RULES sin tocar el resto
// del sistema (asignar/remover, migración de datos y sync ya son genéricos).
import type { RoleId } from '@/types/auth'
import { esComiteDirigentes } from '@/lib/dirigentes'
import { isStudyCommitteeArea } from '@/lib/studies/request-assignment'

export type PositionContext = {
  title: string
  areaName: string
  areaType: 'area' | 'committee'
  /** Nombre del área padre (null si el área/comité es de nivel raíz). */
  parentAreaName: string | null
}

export type PositionRoleRule = {
  role: RoleId
  /** Explica la regla en la UI de auditoría/reporte. */
  description: string
  matches: (ctx: PositionContext) => boolean
}

/** minúsculas, sin acentos, espacios recortados — para comparar títulos con
 *  variantes de escritura. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Como norm(), pero además SIN artículos: "Coordinador de Información" y
 *  "Coordinador Información" son el mismo puesto.
 *
 *  Antes la lista de abajo repetía cada título con "de" y sin "de", y bastaba
 *  con que alguien creara una variante nueva para que el puesto dejara de dar
 *  el permiso en silencio. Pasó el 2026-09-10: "Coordinador de Información",
 *  recién creado en Sede Pedregal Jueves, no daba check-in aunque
 *  "Coordinador Información" sí. Comparar sin artículos cierra esa clase
 *  entera de error en vez de tapar el caso. */
export function normSinArticulos(s: string): string {
  return norm(s).replace(/\b(de|del|la|el|los|las)\b/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Puestos de una sede que operan el evento: logística, anfitriones, bienvenida
 *  e información. Los títulos salen del catálogo real (verificado 2026-09-07);
 *  las variantes con y sin "de" conviven en la base y por eso están las dos.
 *
 *  Información entra COMPLETA —colaborador y coordinador—: antes solo estaba el
 *  coordinador, así que las 36 personas de la mesa de información no recibían el
 *  rol y su jefe sí. Se incluyen también los títulos "Información/Anuncios", que
 *  son la misma mesa en las sedes que juntaron las dos funciones. */
// Se comparan con normSinArticulos, así que van UNA vez: la variante con "de"
// matchea sola.
const SEDE_EVENTOS_TITLES = new Set([
  'logistica',
  // Nombre oficial 2026 del mismo puesto: la sincronización del Excel Madre
  // renombró "Logística" a "Encargado Logística" y, sin esta línea, los
  // encargados de logística de 10 sedes perdían el acceso al check-in.
  'encargado logistica',
  'asistente logistica',
  'anfitrion',
  'colaborador bienvenida',
  'coordinador bienvenida',
  'colaborador informacion',
  'coordinador informacion',
  'colaborador informacion/anuncios',
])

/** Un comité de sede: cuelga del área "Sedes", o se llama "Sede X".
 *
 *  Antes esto exigía que el padre fuera "Área Espiritual" y por eso la regla
 *  NO otorgaba nada: los 14 comités de sede con puestos cuelgan de "Sedes".
 *  Los 92 roles automáticos que hay en producción los puso una migración que
 *  comparaba solo el título; desde entonces, asignar a alguien a uno de esos
 *  puestos no le daba el rol. La segunda condición cubre "Sede Life Este" y
 *  "Sede Life Oeste", que sí cuelgan de "Área Espiritual" (hoy sin puestos). */
/** El comité de Youth, por sus palabras y no por el nombre exacto. */
function esComiteYouth(areaName: string): boolean {
  const palabras = new Set(norm(areaName).split(/[^a-z0-9]+/).filter(Boolean))
  return palabras.has('comite') && palabras.has('youth')
}

export function esComiteDeSede(ctx: PositionContext): boolean {
  if (ctx.areaType !== 'committee') return false
  return norm(ctx.parentAreaName ?? '') === 'sedes' || norm(ctx.areaName).startsWith('sede ')
}

export const POSITION_ROLE_RULES: PositionRoleRule[] = [
  {
    role: 'encargado_eventos',
    description:
      'Puestos que operan el evento en los comités de sede: Logística, Asistente Logística, ' +
      'Anfitrión, Colaborador/Coordinador Bienvenida y Coordinador Información.',
    matches: (ctx) => esComiteDeSede(ctx) && SEDE_EVENTOS_TITLES.has(normSinArticulos(ctx.title)),
  },
  {
    role: 'encargado_eventos',
    description:
      'Colaborador y Bienvenida del Comité Youth: hacen el check-in del subevento de Youth '
      + 'en las charlas.',
    /**
     * Vuelve el 2026-09-12 por decisión del usuario. Había existido apuntando al
     * título exacto "Colaborador", que la sincronización del Excel Madre fusionó
     * en "Colaborador Youth"; entonces se quitó y los 4 que lo tenían lo
     * perdieron. Ahora apunta al nombre oficial.
     *
     * Sigue acotada a ESOS títulos: el comité tiene además Teacher, Asistente
     * Teacher y Encargado, y esto da permiso para hacer check-in — la lista se
     * amplía cuando alguien lo decida, no por parecido de nombre.
     *
     * "Bienvenida" entra el 2026-09-18 por decisión del usuario. Es el mismo
     * criterio que ya rige en los comités de SEDE, donde bienvenida está desde
     * siempre en SEDE_EVENTOS_TITLES: quien recibe en la puerta es quien marca
     * la asistencia. Faltaba solo porque la regla de Youth se escribió mirando
     * un caso puntual (los 4 "Colaborador") y no el puesto equivalente.
     */
    matches: (ctx) =>
      ctx.areaType === 'committee'
      && esComiteYouth(ctx.areaName)
      && ['colaborador', 'colaborador youth', 'bienvenida'].includes(normSinArticulos(ctx.title)),
  },
  {
    role: 'reportes',
    description:
      'Anfitrión de un comité de sede: es quien recibe y cuenta a la gente en la '
      + 'charla, así que necesita ver los reportes de asistencia de su sede.',
    /**
     * PAR-3 (2026-09-23). El catálogo real se revisó antes de escribir esto: los
     * DIEZ puestos que matchean se llaman exactamente "Anfitrión", uno por sede,
     * sin variantes tipo "Co-anfitrión" ni "Anfitrión de eventos". O sea que el
     * título alcanza y no hay que adivinar nada.
     *
     * Va acotada al COMITÉ DE SEDE, no al título suelto (decisión de Floriana).
     * Hoy da exactamente lo mismo —los 10 puestos están todos en sedes— pero si
     * mañana alguien crea un "Anfitrión" para un evento puntual o un comité
     * administrativo, el rol no se reparte solo. Un permiso que se expande por
     * parecido de nombre es el modo de fallo que este archivo ya sufrió con
     * "Coordinador de Información".
     *
     * `anfitrion` ya estaba en SEDE_EVENTOS_TITLES para 'encargado_eventos'; acá
     * NO se reusa esa lista a propósito: son dos permisos distintos y juntarlos
     * haría que agregar un puesto a la lista de check-in repartiera reportes sin
     * que nadie lo pidiera.
     */
    matches: (ctx) => esComiteDeSede(ctx) && normSinArticulos(ctx.title) === 'anfitrion',
  },
  {
    role: 'evaluaciones',
    description:
      'Colaborador de evaluaciones y retroalimentación del comité de Dirigentes: es '
      + 'quien revisa lo que los estudiantes escriben sobre su dirigente y decide '
      + 'qué se comparte.',
    /**
     * RET-1 (2026-09-25). El rol `evaluaciones` ya existía y ya excluía a
     * dirección y a coordinación de estudios a propósito (ver EVALUATION_ROLES);
     * lo que faltaba era que ALGUIEN lo tuviera. Al cerrar el acceso quedaban
     * solo los admin, y la persona que hace este trabajo se habría quedado
     * afuera de su propia tarea.
     *
     * El catálogo se revisó antes de escribir esto: hay DOS puestos, con
     * nombres distintos y en comités distintos —«Colaborador evaluaciones y
     * retroalimentación» en Comité Dirigentes Administrativo, con una persona, y
     * «Colaborador retroalimentación» en Comité Dirigentes, hoy vacío—. Por eso
     * la condición mira que el título EMPIECE por colaborador y mencione
     * retroalimentación, en vez de listar los dos títulos: una lista se
     * desactualiza sola en cuanto renombren uno, y ya pasó con la
     * sincronización del Excel Madre.
     *
     * Acotado al comité de DIRIGENTES —administrativo incluido— y no al título
     * suelto: si mañana otro comité crea un «Colaborador retroalimentación»
     * para lo suyo, no se lleva el acceso a lo que los estudiantes escriben.
     */
    matches: (ctx) => {
      if (ctx.areaType !== 'committee') return false
      if (!esComiteDirigentes(ctx.areaName)) return false
      const t = normSinArticulos(ctx.title)
      return t.startsWith('colaborador') && t.includes('retroalimentacion')
    },
  },
  {
    role: 'solicitudes_estudio',
    description:
      'Cualquier puesto activo en el Comité de Estudios Bíblicos: es el equipo que '
      + 'atiende las solicitudes que le asignan los coordinadores.',
    // Se reconoce el comité por sus PALABRAS, no por el nombre exacto: en la
    // base convive "Comité Estudios Bíblicos" con variantes que llevan "de".
    // Misma función que usa la asignación de solicitudes, así que las dos
    // pantallas no se pueden desalinear.
    matches: (ctx) => ctx.areaType === 'committee' && isStudyCommitteeArea(ctx.areaName),
  },
  {
    role: 'lider_comite',
    description:
      'Quien encabeza un comité: cualquier título que empiece con "Encargado" en un comité '
      + 'que no sea de sede ("Encargado", "Encargado de comité", "Encargado Worship", '
      + '"Encargado Ayuda Social"…). Excluye "Asistente Encargado" y los sub-roles de sede '
      + '("Encargado Logística", "Encargado Sede").',
    /**
     * Antes exigía el título EXACTO "Encargado" o "Encargado de comité", y eso
     * se rompió con la sincronización del Excel Madre (2026-09-11): los
     * encargados pasaron a llamarse "Encargado <Comité>" y de golpe 26 comités
     * dejaron de otorgar el rol. Nadie lo perdió en el momento —el sync corre
     * desde la app, no por trigger— pero la siguiente vez que alguien tocara
     * esa asignación, el rol se revocaba solo.
     *
     * Se compara por PREFIJO y no por lista de títulos: la lista se desactualiza
     * en cuanto alguien crea un comité nuevo, que es exactamente lo que pasó.
     *
     * Los comités de SEDE quedan fuera a propósito: ahí "Encargado Logística" y
     * "Encargado Sede" son roles de la operación de la sede, no la cabeza de un
     * comité. Decisión del usuario 2026-09-11.
     */
    matches: (ctx) => {
      if (ctx.areaType !== 'committee' || esComiteDeSede(ctx)) return false
      const t = normSinArticulos(ctx.title)
      return t === 'encargado' || t.startsWith('encargado ')
    },
  },
]

/** Roles que otorga un puesto dado su contexto (puede ser más de uno si varias
 *  reglas matchean). [] si el puesto no otorga ningún rol automático. */
export function rolesGrantedByPosition(ctx: PositionContext): RoleId[] {
  return POSITION_ROLE_RULES.filter(r => r.matches(ctx)).map(r => r.role)
}
