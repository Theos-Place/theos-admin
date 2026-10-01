/**
 * SRV-16 · Qué PUESTO abre la pantalla "Mi comité", y para qué comité.
 *
 * Hasta el 2026-09-30 la respuesta era una sola: el puesto de encargado
 * (`esPuestoDeEncargado`, la estrella de SRV-5). Se amplía por decisión de
 * Floriana para que la sede pueda mirar sus propios compromisos sin depender
 * de una sola persona.
 *
 * **ESTO NO ES `getManageableCommitteeIds` Y NO DEBE FUSIONARSE CON ÉL.**
 * Ese devuelve los comités donde alguien MANDA, y de ahí salen poderes que el
 * anfitrión no tiene ni pidió: solicitar puestos, abrir la ficha de cualquiera
 * de su comité (`puedeVerFichaPorComite`) y el rol `lider_comite` que se
 * sincroniza solo (`sincronizarRolDeLider`). Mirar la pantalla es una cosa;
 * encabezar el comité es otra. Juntarlas habría repartido cuatro permisos
 * donde se pidió uno, que es el modo de fallo que `position-roles.ts` ya
 * sufrió dos veces con los puestos de sede.
 *
 * Módulo PURO: la consulta la hace el llamador, la decisión vive acá.
 */
import { esPuestoDeEncargado } from './encargados'
import { esComiteDeSede, normSinArticulos, type PositionContext } from './position-roles'

/**
 * Los títulos de anfitrión que abren la pantalla.
 *
 * MEDIDO EN EL CATÁLOGO el 2026-09-30, y el número importa: «Anfitrión 1» —el
 * nombre que traía el pedido— NO EXISTÍA. Se escribió igual «por si acaso», y
 * esa precaución no sirvió de nada: el puesto que el pedido quería decir se
 * llama «Anfitrión Encargado» (Floriana, ese mismo día). Un nombre inventado
 * no matchea nada, y el fallo es SILENCIOSO — la persona entra, ve "acceso
 * restringido" y nadie sabe por qué. La lección no es escribir más nombres
 * posibles: es preguntar cuál es, que es lo que faltó.
 *
 * Los dos títulos de hoy, medidos en producción:
 *   · «Anfitrión»           10 puestos · 17 personas activas
 *   · «Anfitrión Encargado»  9 puestos ·  4 personas activas
 *
 * Y OJO con el segundo: termina en «Encargado» pero NO lo agarra
 * `esPuestoDeEncargado`, que compara por PREFIJO (`encargado …`). Por eso
 * necesita estar acá explícitamente. Que siga fuera de esa función es lo
 * correcto y no un descuido: encabezar el comité trae la estrella y el poder
 * de pedir vacantes, y eso no es lo que se pidió.
 *
 * Se comparan con `normSinArticulos`, así que el acento y los artículos dan
 * igual. Lo que NO da igual es el resto: «Asistente Anfitrión» o
 * «Co-anfitrión» no entran, y eso es a propósito.
 */
export const ANFITRIONES_QUE_ABREN_MI_COMITE = new Set([
  'anfitrion',
  'anfitrion encargado',
])

/**
 * ¿Este puesto le abre "Mi comité" a quien lo ocupa?
 *
 * El anfitrión va acotado al COMITÉ DE SEDE, no al título suelto — mismo
 * criterio que la regla `reportes` de PAR-3, y por la misma razón: si mañana
 * alguien crea un «Anfitrión» para un evento puntual o un comité
 * administrativo, no se lleva consigo la lista de compromisos de esa gente.
 *
 * «Encargado Logística» ya entraba por la primera línea, sin regla nueva: el
 * título empieza por «Encargado» y eso lo vuelve cabeza de comité desde
 * SRV-5 (16 personas en 14 sedes, verificado el 2026-09-30). El test lo fija
 * para que un recorte futuro de `esPuestoDeEncargado` no se lo quite callado.
 */
export function abreMiComite(ctx: PositionContext): boolean {
  if (ctx.areaType !== 'committee') return false
  if (esPuestoDeEncargado(ctx.title)) return true
  return esComiteDeSede(ctx) && ANFITRIONES_QUE_ABREN_MI_COMITE.has(normSinArticulos(ctx.title))
}
