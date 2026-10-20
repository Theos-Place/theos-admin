import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * SEC-4 · Toda tabla nueva en `public` trae su GRANT a service_role en la
 * MISMA migración que la crea.
 *
 * Desde el 30-oct-2026 Supabase no da permisos automáticos sobre tablas
 * nuevas de `public` (aviso del 2026-10-20), y la app consulta todo con la
 * llave de servicio: una tabla sin su GRANT es una pantalla que responde
 * «permission denied». Tampoco se le da nada a `anon` ni a `authenticated`
 * salvo decisión documentada en la migración (`-- SEC-4: abierta porque…`):
 * nadie lee tablas desde el navegador.
 *
 * Mira solo las migraciones desde SEC-4 en adelante: las anteriores se
 * crearon con los permisos automáticos y ya los tienen.
 */
const DIR = 'supabase/migrations'
const DESDE = '20261020120000'

const nuevas = readdirSync(DIR).filter(f => f.endsWith('.sql') && f >= DESDE).sort()

/** Las tablas que crea una migración, sin comentarios. */
function tablasCreadas(sql: string): string[] {
  const limpio = sql.replace(/--.*$/gm, '')
  return [...limpio.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)].map(m => m[1].toLowerCase())
}

/** ¿Hay un GRANT de escritura a service_role que nombre esta tabla? */
function tieneGrant(sql: string, tabla: string): boolean {
  const limpio = sql.replace(/--.*$/gm, '').toLowerCase()
  return [...limpio.matchAll(/grant\s+([^;]+?)\s+on\s+(?:table\s+)?([^;]+?)\s+to\s+([^;]+);/g)]
    .some(([, privs, objetos, roles]) =>
      /select/.test(privs) && /insert/.test(privs)
      && objetos.split(',').map(o => o.trim().replace(/^public\./, '').replace(/"/g, '')).includes(tabla)
      && /\bservice_role\b/.test(roles))
}

describe('SEC-4 · permisos de las tablas nuevas', () => {
  it('cada tabla nueva tiene su GRANT a service_role en la misma migración', () => {
    const faltan: string[] = []
    for (const f of nuevas) {
      const sql = readFileSync(`${DIR}/${f}`, 'utf8')
      for (const t of tablasCreadas(sql)) if (!tieneGrant(sql, t)) faltan.push(`${f}: public.${t}`)
    }
    expect(faltan, `Agregá «grant select, insert, update, delete on public.<tabla> to service_role;» (ver AGENTS.md):\n${faltan.join('\n')}`).toEqual([])
  })

  it('ninguna tabla nueva se abre a anon/authenticated sin decirlo', () => {
    const abiertas: string[] = []
    for (const f of nuevas) {
      const sql = readFileSync(`${DIR}/${f}`, 'utf8')
      const limpio = sql.replace(/--.*$/gm, '').toLowerCase()
      const abre = /grant\s+[^;]+\s+on\s+(?:table\s+)?[^;]+\s+to\s+[^;]*\b(anon|authenticated|public)\b[^;]*;/.test(limpio)
      if (abre && !/--\s*sec-4:/i.test(sql)) abiertas.push(f)
    }
    expect(abiertas).toEqual([])
  })

  it('el detector reconoce las formas de escribirlo', () => {
    const sql = `create table if not exists public.cosas (id uuid);\ncreate table otras (id int);\n` +
      `grant select, insert, update, delete on public.cosas, public.otras to service_role;`
    expect(tablasCreadas(sql)).toEqual(['cosas', 'otras'])
    expect(tieneGrant(sql, 'cosas')).toBe(true)
    expect(tieneGrant(sql, 'otras')).toBe(true)
    expect(tieneGrant('grant select on public.cosas to service_role;', 'cosas')).toBe(false)
    expect(tieneGrant('grant select, insert on public.cosas to authenticated;', 'cosas')).toBe(false)
    // Un CREATE TABLE comentado no cuenta.
    expect(tablasCreadas('-- create table public.vieja (id int);')).toEqual([])
  })

  it('la migración SEC-4 deja los permisos por defecto solo para service_role', () => {
    const m = readFileSync(`${DIR}/20261020120000_permisos_solo_servicio.sql`, 'utf8')
    expect(m).toContain('revoke all on tables from anon, authenticated;')
    // Las funciones NO: su default es global (ver la migración y SEC-3).
    expect(m).not.toMatch(/^\s*alter default privileges[^;]*functions/im)
    expect(m).toContain('grant select, insert, update, delete on tables to service_role;')
  })
})
