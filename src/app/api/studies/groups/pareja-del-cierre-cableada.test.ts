import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PRE-8 · La pantalla y el servidor tienen que sacar las parejas del MISMO
 * lugar.
 *
 * Si solo la pantalla cayera a los participantes, el cierre pasaría sin
 * evaluación y nadie se enteraría: el servidor no la exigiría porque para
 * él ese grupo no tiene parejas. Y si solo cayera el servidor, la pantalla
 * no mostraría el formulario y el cierre fallaría con «falta la evaluación»
 * de algo que nunca se pidió.
 */
const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const pares = leer('src/app/api/studies/groups/[id]/premat-pairs/route.ts')
const cierre = leer('src/app/api/studies/groups/[id]/close/route.ts')
const guardado = leer('src/lib/supabase/queries/prematrimonial.ts')

describe('PRE-8 · de dónde salen las parejas', () => {
  it('el endpoint de parejas usa la regla compartida', () => {
    expect(pares).toMatch(/parejasDelCierre\(\{/)
  })

  it('y el de CIERRE también, no su propia consulta', () => {
    expect(cierre).toMatch(/parejasDelCierre\(\{/)
    // El bug viejo: filtraba contra `parejas` de getRequestsForGroup a secas.
    expect(cierre).not.toMatch(/const parejas = await getRequestsForGroup\(id\)/)
  })

  it('los dos caen a los participantes solo si NO hay solicitud', () => {
    // Con solicitud manda la solicitud: trae el request_id con el que ya se
    // venía guardando.
    for (const [nombre, src] of [['parejas', pares], ['cierre', cierre]] as const) {
      expect(src, nombre).toMatch(/length > 0 \? \[\] : await getParticipantesDelGrupo\(id\)/)
    }
  })
})

describe('PRE-8 · cómo se guarda sin solicitud', () => {
  it('el request_id del grupo NO se guarda como solicitud', () => {
    // Apuntaría a una fila que no existe y la FK lo rechazaría.
    expect(guardado).toMatch(/esDelGrupo\(e\.request_id\) \? null : e\.request_id/)
  })

  it('el conflicto se resuelve por grupo cuando no hay solicitud', () => {
    // Sin esto, un reintento del cierre duplicaría la evaluación en vez de
    // corregirla, que es justo lo que el upsert existe para evitar.
    expect(guardado).toMatch(/onConflict: .*'group_id' : 'request_id'/)
  })
})
