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
const pantalla = leer('src/components/studies/PrematCoupleEvaluation.tsx')

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

describe('PRE-8 · quién puede cargar las parejas', () => {
  it('los DOS endpoints usan la misma regla de permiso', () => {
    // El bug de verdad: el de cierre dejaba cerrar al dirigente del grupo y
    // el de parejas no. Floriana, co-dirigente de su prematrimonial, podía
    // cerrar pero recibía 403 al cargar las parejas — y la pantalla decía
    // «no se pudieron cargar» sin aclarar que era un permiso.
    for (const [nombre, src] of [['parejas', pares], ['cierre', cierre]] as const) {
      expect(src, nombre).toMatch(/puedeCerrarEsteGrupo\(\{/)
    }
  })

  it('ninguno vuelve a escribir su propia lista de roles', () => {
    for (const [nombre, src] of [['parejas', pares], ['cierre', cierre]] as const) {
      expect(src, nombre).not.toMatch(/'coordinador_estudios', 'coordinador_dirigentes', 'direccion'/)
    }
  })
})

describe('PRE-8 · cómo se guarda sin solicitud', () => {
  it('el request_id del grupo NO se guarda como solicitud', () => {
    // Apuntaría a una fila que no existe y la FK lo rechazaría.
    expect(guardado).toMatch(/esDelGrupo\(e\.request_id\) \? null : e\.request_id/)
  })

  it('un reintento del cierre corrige la evaluación en vez de duplicarla', () => {
    // Antes era un upsert con onConflict 'group_id' / 'request_id', y daba 500
    // en prod (42P10, 2026-10-15): los índices únicos son PARCIALES y
    // PostgREST no sabe mandarles el WHERE. Ahora se busca la previa —por
    // grupo o por solicitud— y se actualiza; si no hay, se crea.
    const fn = guardado.slice(guardado.indexOf('export async function savePrematEvaluations'), guardado.indexOf('export async function getPrematEvaluations'))
    expect(fn).not.toMatch(/onConflict/)
    expect(guardado).toMatch(/group_id\.eq\.\$\{groupId\},request_id\.in\./)
    expect(guardado).toMatch(/\.update\(fila\)\.eq\('id', previa\.id\)/)
  })
})

describe('PRE-8 · el mensaje cuando algo falla', () => {
  it('distingue el PERMISO de la caída', () => {
    // El 403 de hoy decía «No se pudieron cargar las parejas del grupo»,
    // igual que una caída de red. Se lee como un problema de datos y costó
    // una vuelta entera de diagnóstico saber que era un permiso.
    expect(pantalla).toMatch(/mensajeDeLaRespuesta\(res,/)
  })

  it('y un fallo de red se dice como fallo de red', () => {
    expect(pantalla).toMatch(/No se pudo conectar/)
  })

  it('el catch ya no se traga el status', () => {
    // El patrón viejo: `r.ok ? r.json() : Promise.reject(new Error())`
    // descarta la respuesta entera antes de poder mirarla.
    expect(pantalla).not.toMatch(/Promise\.reject\(new Error\(\)\)/)
  })
})
