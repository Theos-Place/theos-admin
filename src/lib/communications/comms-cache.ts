// Caché a nivel de módulo de los datos de comunicaciones (mismo patrón que
// useFinance/useStudies). Vive aparte del hook para que CUALQUIER pantalla que
// escriba pueda invalidarla sin importar React.
//
// Por qué existe este archivo (bug 2026-08-06): guardar una plantilla no tocaba
// la caché y la pantalla volvía al listado a los 900 ms. Durante los 30 s
// siguientes se seguía leyendo la copia vieja, así que quien volvía a entrar veía
// el cuerpo anterior y creía que el cambio se había perdido. No se perdía nunca:
// se estaba mirando la caché.

export type CommsSlice = 'messages' | 'templates' | 'configs'

export const COMMS_TTL_MS = 30_000

type Entry = { data: unknown[]; ts: number }

const cache = new Map<CommsSlice, Entry>()

/** Datos vigentes de un slice, o null si no hay o ya vencieron. */
export function readCommsCache(slice: CommsSlice, now = Date.now()): unknown[] | null {
  const hit = cache.get(slice)
  if (!hit) return null
  return now - hit.ts < COMMS_TTL_MS ? hit.data : null
}

export function writeCommsCache(slice: CommsSlice, data: unknown[], now = Date.now()): void {
  cache.set(slice, { data, ts: now })
}

/** Invalida un slice (o todo). Llamalo DESPUÉS de cualquier escritura: crear,
 *  editar, duplicar o borrar. */
export function invalidateCommsCache(slice?: CommsSlice): void {
  if (slice) cache.delete(slice)
  else cache.clear()
}

/** Solo para tests. */
export function commsCacheHas(slice: CommsSlice): boolean {
  return cache.has(slice)
}
