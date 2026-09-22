/**
 * AUT-2 · Etapa 1 — QUÉ CUENTAS DE ACCESO SOBRAN. SOLO LECTURA.
 *
 *   npx tsx scripts/limpiar-cuentas-auth.ts
 *
 * NO BORRA NADA y no tiene bandera para hacerlo: la etapa 2 es otro script y
 * otra conversación. Este saca el reporte que se revisa antes.
 *
 * Deja dos archivos en data-import/:
 *   · cuentas-auth-candidatas-<fecha>.csv  — la lista completa a revisar
 *   · cuentas-auth-resumen-<fecha>.txt     — los conteos
 *
 * EL CRITERIO vive en src/lib/auth/limpieza-de-cuentas.ts, con tests. Acá solo
 * se juntan los datos.
 *
 * DOS COSAS QUE HAY QUE SABER ANTES DE LA ETAPA 2, las dos medidas el
 * 2026-09-22:
 *
 *  1. `members.auth_user_id` tiene FK con **NO ACTION**. Borrar el usuario de
 *     auth con la ficha apuntando FALLA. Hay que poner `auth_user_id` en NULL
 *     primero, en la misma transacción.
 *  2. Las cuentas BLOQUEADAS no se borran. No es un detalle: son los menores
 *     que FAM-2 deshabilitó, y AUT-4 les quita el ban al cumplir 18. Ver el
 *     comentario de `motivoParaQuedarse`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import {
  motivoParaQuedarse, ETIQUETA_MOTIVO, ANIOS_DE_VENTANA,
  type MotivoParaQuedarse,
} from '../src/lib/auth/limpieza-de-cuentas'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const TOPE = 1000   // PostgREST corta acá en silencio; ver AGENTS.md

/** auth.users se lee por pg y NO por `auth.admin.listUsers`: con 18.560 filas
 *  esa API devuelve 500 aunque se pagine de a mil. Es la vía de acceso directo
 *  que ya usa el resto de los scripts (AGENTS.md / db-acceso-directo). */
const require_ = createRequire(import.meta.url)
const { nuevoCliente } = require_('./madre-2026-09/lib.cjs') as {
  nuevoCliente: () => { connect(): Promise<void>; query(q: string): Promise<{ rows: unknown[] }>; end(): Promise<void> }
}

/** Todas las filas de una tabla, en páginas. Sin esto el reporte mentiría. */
async function todas<T>(
  tabla: string, columnas: string,
  filtro?: (q: ReturnType<typeof sb.from>) => unknown,
): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += TOPE) {
    let q = sb.from(tabla).select(columnas).range(desde, desde + TOPE - 1)
    if (filtro) q = filtro(q as never) as typeof q
    const { data, error } = await q
    if (error) throw error
    const lote = (data ?? []) as T[]
    out.push(...lote)
    if (lote.length < TOPE) break
  }
  return out
}

async function main() {
  const corte = new Date()
  corte.setFullYear(corte.getFullYear() - ANIOS_DE_VENTANA)
  const desdeIso = corte.toISOString()
  const hoy = new Date().toISOString().slice(0, 10)

  console.log('Leyendo auth.users…')
  type U = {
    id: string; email: string | null
    last_sign_in_at: Date | null; banned_until: Date | null; created_at: Date | null
  }
  const pg = nuevoCliente()
  await pg.connect()
  const usuarios = (await pg.query(
    'select id, email, last_sign_in_at, banned_until, created_at from auth.users')).rows as U[]
  await pg.end()
  console.log(`  ${usuarios.length} cuentas`)

  console.log('Leyendo fichas, roles, asistencias y matrículas…')
  const fichas = await todas<{ id: string; auth_user_id: string | null; first_name: string; last_name: string; email: string | null; is_active: boolean }>(
    'members', 'id, auth_user_id, first_name, last_name, email, is_active',
    q => (q as { not: (a: string, b: string, c: null) => unknown }).not('auth_user_id', 'is', null))
  const porAuth = new Map(fichas.filter(f => f.auth_user_id).map(f => [f.auth_user_id!, f]))

  const roles = await todas<{ member_id: string }>('member_roles', 'member_id',
    q => (q as { eq: (a: string, b: boolean) => unknown }).eq('is_active', true))
  const conRol = new Set(roles.map(r => r.member_id))

  const checkins = await todas<{ member_id: string | null; checked_in_at: string }>(
    'event_checkins', 'member_id, checked_in_at',
    q => (q as { gte: (a: string, b: string) => unknown }).gte('checked_in_at', desdeIso))
  const conAsistencia = new Set(checkins.map(c => c.member_id).filter((x): x is string => !!x))

  const matriculas = await todas<{ member_id: string | null; status: string | null }>(
    'study_enrollments', 'member_id, status',
    q => (q as { gte: (a: string, b: string) => unknown }).gte('created_at', desdeIso))
  const conEstudio = new Set(
    matriculas.filter(e => (e.status ?? '') !== 'cancelled')
      .map(e => e.member_id).filter((x): x is string => !!x))

  console.log(`  ${fichas.length} fichas con cuenta · ${conRol.size} con rol · ${conAsistencia.size} con asistencia · ${conEstudio.size} con estudio`)

  const conteo = new Map<MotivoParaQuedarse | 'CANDIDATA', number>()
  const candidatas: string[][] = []
  for (const u of usuarios) {
    const ficha = porAuth.get(u.id)
    const motivo = motivoParaQuedarse({
      email: u.email,
      seLogueoAlgunaVez: !!u.last_sign_in_at,
      estaBloqueada: !!u.banned_until,
      tieneRolActivo: !!ficha && conRol.has(ficha.id),
      asistioEnLaVentana: !!ficha && conAsistencia.has(ficha.id),
      estudioEnLaVentana: !!ficha && conEstudio.has(ficha.id),
    })
    const clave = motivo ?? 'CANDIDATA'
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
    if (!motivo) {
      candidatas.push([
        u.email ?? '',
        ficha ? `${ficha.first_name} ${ficha.last_name}`.trim() : '(SIN FICHA VINCULADA)',
        ficha?.is_active === false ? 'ficha inactiva' : '',
        // pg devuelve Date, no string: `String(fecha).slice(0,10)` daría
        // "Tue Jul 28" en vez de la fecha.
        u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '',
      ])
    }
  }

  mkdirSync('data-import', { recursive: true })
  const csv = ['correo,nombre,nota,cuenta_creada',
    ...candidatas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
  const rutaCsv = `data-import/cuentas-auth-candidatas-${hoy}.csv`
  writeFileSync(rutaCsv, csv)

  const lineas = [
    `AUT-2 · Cuentas de acceso — reporte del ${hoy}. SOLO LECTURA, no se borró nada.`,
    ``,
    `Total de cuentas: ${usuarios.length}`,
    ``,
    `SE QUEDAN (por el motivo más fuerte de cada una, sin contar a nadie dos veces):`,
    ...(Object.keys(ETIQUETA_MOTIVO) as MotivoParaQuedarse[]).map(
      m => `  ${String(conteo.get(m) ?? 0).padStart(6)}  ${ETIQUETA_MOTIVO[m]}`),
    ``,
    `CANDIDATAS A BORRAR: ${conteo.get('CANDIDATA') ?? 0}`,
    `  sin ficha vinculada: ${candidatas.filter(c => c[1].startsWith('(SIN')).length}`,
    ``,
    `Lista completa: ${rutaCsv}`,
    ``,
    `ANTES DE LA ETAPA 2:`,
    `  · members.auth_user_id tiene FK NO ACTION — hay que poner auth_user_id`,
    `    en NULL antes de borrar, o el delete falla.`,
    `  · Las bloqueadas NO se borran: son los menores de FAM-2 y AUT-4 les quita`,
    `    el ban al cumplir 18.`,
    `  · Se borra SOLO la cuenta de login. La ficha no se toca, y "Conseguí tu`,
    `    contraseña" la vuelve a crear cuando la persona aparece.`,
  ]
  const rutaTxt = `data-import/cuentas-auth-resumen-${hoy}.txt`
  writeFileSync(rutaTxt, lineas.join('\n') + '\n')
  console.log('\n' + lineas.join('\n'))
}

main().catch(e => { console.error(e); process.exit(1) })
