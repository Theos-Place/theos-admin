import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Quién está haciendo la petición actual, para que el audit_log lo registre.
 *
 * EL PROBLEMA (2026-09-16). El trigger `log_changes()` guarda `auth.uid()`,
 * que sale del JWT. Pero la app escribe SIEMPRE con la llave de servicio, así
 * que ese JWT es el del rol de servicio y `auth.uid()` es null. Resultado
 * medido: de 369.773 filas de auditoría, solo 227 tienen actor. Es decir, la
 * bitácora sabe QUÉ cambió y CUÁNDO, pero casi nunca QUIÉN.
 *
 * Se notó buscando quién movió a Pamela Fonseca de grupo: los 5 eventos de
 * auditoría del traslado tenían actor vacío, y el único rastro era un nombre
 * dentro del texto libre de una nota.
 *
 * LA SOLUCIÓN Y POR QUÉ ASÍ. `createAdminClient()` se llama en 666 lugares;
 * pasarle el actor a mano en cada uno es inviable y se olvidaría en el primero
 * que alguien escriba mañana. En vez de eso el actor viaja por
 * AsyncLocalStorage: `getAuthContext()` lo deja acá al resolver la sesión —y
 * eso corre al inicio de TODA ruta API, porque el proxy excluye /api y la
 * convención obliga a llamar al guard— y el cliente admin lo lee solo y lo
 * manda como header. Ningún llamador cambia.
 *
 * `enterWith` y no `run(cb)`: no hay dónde envolver el resto del handler desde
 * adentro del guard. Cada petición de Next corre en su propio contexto async,
 * así que el valor no se cruza entre peticiones.
 *
 * POR QUÉ ES UNA CAJA Y NO EL ID PELADO (arreglado el 2026-09-18).
 *
 * La primera versión hacía `enterWith(userId)` justo después de resolver la
 * sesión, o sea DESPUÉS de `await supabase.auth.getUser()`. `enterWith` vale
 * "para el resto de la ejecución SÍNCRONA actual y las llamadas asíncronas que
 * salgan de ahí", y en ese punto la continuación del llamador —el handler,
 * después de su `await requireRoles(...)`— ya tenía tomada su foto del
 * contexto. El handler veía el contexto vacío, el cliente admin no mandaba
 * header y la bitácora seguía sin autor.
 *
 * Y PEOR QUE ROTO: DEPENDÍA DE LA VERSIÓN DE NODE. Medido el 2026-09-18 con el
 * mismo script — en node 22 el `enterWith` tardío SÍ se propaga y en node 24 no.
 * Así que ese código andaba en unos runtimes y no en otros, y se habría caído
 * solo el día de un upgrade sin que nadie lo relacionara. La caja funciona en
 * los dos.
 *
 * Medido el 2026-09-18, dos días después de darlo por hecho: de 1.135 UPDATE
 * sobre `members` posteriores a la migración, CERO tenían actor. Los únicos 37
 * que sí lo tenían venían de funciones que reciben el actor como parámetro
 * (ROLE_CHANGE, MERGE) y nunca pasaron por acá.
 *
 * La caja arregla eso: se entra con un objeto VACÍO antes de cualquier `await`
 * del guard —ese pedazo corre todavía dentro del contexto del llamador, así que
 * el handler sí lo ve— y se rellena cuando ya se sabe quién es. El llamador
 * tiene la misma referencia, así que ve el actor aunque se haya escrito
 * después.
 *
 * Verificado que dos peticiones simultáneas no se cruzan el actor: cada una
 * entra con su propia caja.
 *
 * Sin sesión (crons, webhooks) no hay actor y la auditoría queda como hoy.
 */
type Caja = { actor: string | null }

const almacen = new AsyncLocalStorage<Caja>()

/**
 * Abre el contexto de la petición. **Tiene que llamarse antes del primer
 * `await` del guard**; si se mueve más abajo, el actor deja de llegar y nada
 * se rompe de forma visible — es exactamente el bug que tuvo esto dos días.
 */
export function abrirContextoDeActor(): void {
  almacen.enterWith({ actor: null })
}

/** Lo llama el guard cuando ya resolvió la sesión. `userId` es auth.users.id,
 *  que es lo que referencia audit_log.actor_id. */
export function recordarActor(userId: string): void {
  const caja = almacen.getStore()
  if (caja) caja.actor = userId
  // Sin caja (nadie abrió el contexto) se entra ahora: no sirve para el
  // llamador de más arriba, pero sí para lo que se escriba de acá en adelante.
  else almacen.enterWith({ actor: userId })
}

/** auth.users.id de quien hace la petición, o null si no hay sesión. */
export function actorActual(): string | null {
  return almacen.getStore()?.actor ?? null
}

/** El header con el que el actor viaja hasta PostgREST, donde el trigger lo lee
 *  con `current_setting('request.headers')`. */
export const HEADER_ACTOR = 'x-actor-user-id'
