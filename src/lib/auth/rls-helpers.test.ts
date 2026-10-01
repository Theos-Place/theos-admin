import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { ROLES } from './roles'
import type { RoleId } from '@/types/auth'

/**
 * INF-2 · Las listas de roles de las políticas RLS tienen que decir lo mismo
 * que la app.
 *
 * POR QUÉ ESTE TEST. La migración `20260928120000` metió cuatro helpers
 * —`private.ve_padron()`, `ve_servidores()`, `ve_estudios()`, `ve_eventos()`—
 * con la lista de roles escrita a mano en SQL. Esa lista es una COPIA de lo
 * que `roles.ts` ya dice, y una copia en otro lenguaje que nadie ejecuta en CI
 * es una copia que se desactualiza: el día que alguien agregue un rol al
 * módulo `miembros` en la app, la política seguirá con la lista vieja y la
 * defensa en profundidad empezará a negarle el paso a quien la app sí deja
 * pasar. Nadie lo notaría, porque la app lee con la llave de servicio.
 *
 * Se compara contra el alcance `all`: las políticas de este corte son
 * «ve el módulo entero», y un rol con alcance `own` o `committee` entra por
 * la otra mitad de la política (`= private.mi_member_id()`).
 */

/**
 * TODAS las migraciones, en orden, concatenadas.
 *
 * Antes esto leía SOLO `20260928120000`, la que creó los helpers, y esa
 * suposición se rompió en cuanto ROL-1 redefinió `ve_estudios()` con un
 * `create or replace` en una migración posterior: el test seguía mirando la
 * versión vieja y habría dado verde sobre una función que ya no existía así.
 * Ahora se lee la definición VIGENTE, que es la última.
 */
const SQL = readdirSync('supabase/migrations')
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => readFileSync(`supabase/migrations/${f}`, 'utf8'))
  .join('\n')

/** Los roles que el SQL le pasa a un helper, en su definición VIGENTE. */
function rolesDelHelper(nombre: string): string[] {
  const i = SQL.lastIndexOf(`create or replace function private.${nombre}()`)
  if (i === -1) throw new Error(`no existe private.${nombre}() en las migraciones`)
  const cuerpo = SQL.slice(i, SQL.indexOf('$$;', i))
  const m = /ARRAY\[([\s\S]*?)\]/.exec(cuerpo)
  if (!m) throw new Error(`private.${nombre}() no lleva ARRAY[...]`)
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort()
}

/** Los roles que en la app ven ese módulo con alcance `all`. */
function rolesDeLaApp(modulo: string): string[] {
  return ROLES
    .filter(r => r.permissions.some(p =>
      (p.module === modulo || p.module === 'all') && (p.scope ?? 'all') === 'all'))
    .map(r => r.id as string)
    .sort()
}

describe('INF-2 · los helpers de RLS dicen lo mismo que la app', () => {
  const PARES: Array<[string, string]> = [
    ['ve_padron', 'miembros'],
    ['ve_estudios', 'estudios'],
    ['ve_eventos', 'eventos'],
  ]

  for (const [helper, modulo] of PARES) {
    it(`private.${helper}() = los roles con alcance all sobre «${modulo}»`, () => {
      expect(rolesDelHelper(helper)).toEqual(rolesDeLaApp(modulo))
    })
  }

  it('private.ve_servidores() son los del módulo MÁS lider_comite', () => {
    // El encargado de comité tiene alcance `committee` y no `all`, pero en
    // servidores esa es justamente su gente: la política lo deja pasar y la
    // app lo acota al comité. Va aparte para que la excepción se lea.
    expect(rolesDelHelper('ve_servidores'))
      .toEqual([...rolesDeLaApp('servidores'), 'lider_comite'].sort())
  })

  it('ningún helper inventa un rol que la app no conoce', () => {
    // Un typo en el SQL —'coordinador_estudio' sin s— no falla en ninguna
    // parte: la política simplemente nunca se cumple, y el rol se queda
    // afuera en silencio.
    const conocidos = new Set<string>(ROLES.map(r => r.id as RoleId as string))
    for (const h of ['ve_padron', 've_servidores', 've_estudios', 've_eventos']) {
      for (const r of rolesDelHelper(h)) expect(conocidos.has(r), `${h} → ${r}`).toBe(true)
    }
  })
})

describe('INF-2 · la migración no deja volver la recursión', () => {
  it('ninguna política nueva lee `members` dentro de su expresión', () => {
    // Es la falla original: una política que consulta members para saber el
    // rol de quien llama vuelve a disparar la política de members.
    // Cada trozo se corta en el `;` que cierra la política. Sin eso el ÚLTIMO
    // se traga todo el SQL que venga después —funciones, updates, lo que sea—
    // y el test acusa a esa política de leer `members` por algo que escribió
    // otra migración. Pasó el 2026-09-30 al agregar la fusión, que sí lee
    // `members`: el test se puso rojo sin que ninguna política cambiara.
    const politicas = SQL.split(/^create policy /m).slice(1)
      .map(p => p.slice(0, p.indexOf(';') + 1 || undefined))
    expect(politicas.length).toBeGreaterThan(100)
    const culpables = politicas
      .filter(p => /\b(from|join)\s+(public\.)?members\b/i.test(p))
      .map(p => p.split('\n')[0])
    expect(culpables).toEqual([])
  })

  it('los helpers son SECURITY DEFINER con search_path fijo', () => {
    // SECURITY DEFINER es lo que les deja leer members sin disparar su RLS;
    // sin `search_path` fijo resolverían los nombres contra el path de quien
    // llama, que es la regla que AGENTS.md fija para todo el esquema.
    /**
     * Acotado a los helpers de `private.`, que es de lo que habla este test.
     * Cuando `SQL` pasó a concatenar TODAS las migraciones —para poder leer
     * la definición vigente y no la primera— este recorrido empezó a barrer
     * también las funciones viejas del baseline, que tienen sus propias
     * reglas y no son el tema. El alcance se le había ampliado sin querer.
     */
    const defs = SQL.split(/^create or replace function /m).slice(1)
      .filter(d => d.startsWith('private.'))
    expect(defs.length).toBeGreaterThanOrEqual(6)
    for (const d of defs) {
      const nombre = d.split('(')[0]
      expect(d, nombre).toContain('security definer')
      expect(d, nombre).toContain("set search_path to 'public'")
    }
  })

  it('el padrón ya no lo ve cualquier autenticado', () => {
    // La decisión del 2026-09-28: arreglar la recursión encendía 23 políticas
    // que decían «pasa cualquiera autenticado», y una era el padrón entero.
    const i = SQL.lastIndexOf('create policy "members_select"')
    const p = SQL.slice(i, SQL.indexOf(';', i))
    expect(p).toContain('private.ve_padron()')
    expect(p).toContain('private.mi_member_id()')
    expect(p).not.toContain("'authenticated'")
  })
})
