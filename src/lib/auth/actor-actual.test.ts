import { describe, it, expect } from 'vitest'
import { abrirContextoDeActor, recordarActor, actorActual } from './actor-actual'

/**
 * AUD-2 · La forma EXACTA en la que esto falló dos días sin avisar.
 *
 * El guard hace `await supabase.auth.getUser()` y recién después sabe quién es.
 * Si el contexto se abre ahí, la continuación del handler —que ya tenía tomada
 * su foto del contexto— no lo ve, y la bitácora se queda sin autor sin que se
 * rompa nada visible. Estos tests imitan esa forma con un await de por medio.
 */
const guard = async (userId: string | null, demoraMs = 1) => {
  abrirContextoDeActor()                              // ANTES del primer await
  await new Promise(r => setTimeout(r, demoraMs))     // supabase.auth.getUser()
  if (userId) recordarActor(userId)
}

describe('el actor sobrevive al await del guard', () => {
  it('el handler ve el actor después de esperar al guard', async () => {
    const handler = async () => { await guard('ana'); return actorActual() }
    expect(await handler()).toBe('ana')
  })

  it('EL CASO QUE FALLABA: abrir el contexto DESPUÉS del await no sirve', async () => {
    // Se deja escrito porque es contraintuitivo: mover esa línea dos renglones
    // abajo rompe la auditoría entera y ningún test que no sea éste se entera.
    const guardMalo = async () => {
      await new Promise(r => setTimeout(r, 1))
      abrirContextoDeActor()
      recordarActor('ana')
    }
    const handler = async () => { await guardMalo(); return actorActual() }
    expect(await handler()).toBeNull()
  })

  it('DOS PETICIONES A LA VEZ no se cruzan el actor', async () => {
    // Lo que de verdad importa: firmar un cambio con el nombre equivocado es
    // peor que no firmarlo.
    const handler = async (id: string, demora: number) => {
      await guard(id, demora)
      await new Promise(r => setTimeout(r, 2))
      return actorActual()
    }
    expect(await Promise.all([
      handler('ana', 8), handler('beto', 1), handler('caro', 4),
    ])).toEqual(['ana', 'beto', 'caro'])
  })

  it('sin sesión no hay actor, y no se hereda el de otra petición', async () => {
    const conSesion = async () => { await guard('ana'); return actorActual() }
    const sinSesion = async () => { await guard(null); return actorActual() }
    const [a, b] = await Promise.all([conSesion(), sinSesion()])
    expect(a).toBe('ana')
    expect(b).toBeNull()
  })

  it('el actor se ve también en lo que se llame DESPUÉS, no solo en el acto', async () => {
    // Es el caso real: createAdminClient() se llama más abajo en el handler,
    // a veces varios awaits después.
    const handler = async () => {
      await guard('ana')
      await new Promise(r => setTimeout(r, 3))
      await new Promise(r => setTimeout(r, 3))
      return actorActual()
    }
    expect(await handler()).toBe('ana')
  })
})
