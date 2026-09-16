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
 * Sin sesión (crons, webhooks) no hay actor y la auditoría queda como hoy.
 */
const almacen = new AsyncLocalStorage<string>()

/** Lo llama el guard al resolver la sesión. `userId` es auth.users.id, que es
 *  lo que referencia audit_log.actor_id. */
export function recordarActor(userId: string): void {
  almacen.enterWith(userId)
}

/** auth.users.id de quien hace la petición, o null si no hay sesión. */
export function actorActual(): string | null {
  return almacen.getStore() ?? null
}

/** El header con el que el actor viaja hasta PostgREST, donde el trigger lo lee
 *  con `current_setting('request.headers')`. */
export const HEADER_ACTOR = 'x-actor-user-id'
