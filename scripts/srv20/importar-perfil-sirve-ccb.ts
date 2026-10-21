/**
 * SRV-20 (etapa 3) · Migra las respuestas del formulario 128 de CCB al perfil
 * S.I.R.V.E. (`member_spiritual_data`).
 *
 * ARCHIVO: data-import/perfil-sirve-ccb-2026-10-20.csv (utf-8-sig, 1.013
 * respuestas, 2018-2026). Radiografía del 2026-10-20: 834 con Individual ID,
 * 179 sin ID, 35 personas con varias respuestas. Las columnas 17, 23 y 25
 * vienen SIN encabezado y son, por posición (verificado contra filas), los
 * textos libres de «otros dones», «otras habilidades» y «otras pasiones».
 *
 * REGLAS (las de AGENTS.md para cruzar contra CCB):
 *  · El external_id se resuelve con `member_por_external_id`, nunca con
 *    `members.external_id` a secas (la fusión de duplicados deja el id en la
 *    ficha muerta).
 *  · Sin ID: match por correo, y SOLO si hay exactamente UNA ficha viva con
 *    ese correo; con cero o con dos se reporta y no se toca.
 *  · Varias respuestas de una persona: gana la MÁS RECIENTE.
 *  · No se pisa un perfil que la persona ya editó EN EL SISTEMA
 *    (`editado_en_sistema_at`): el dato fresco gana sobre el histórico.
 *  · Idempotente: re-correrlo deja lo mismo.
 *  · NO importa datos personales (nombre, correo, teléfono, cumpleaños,
 *    género, estado civil, dirección): el sistema los tiene más al día.
 *    Tampoco comité/sede ni dirigente del curso, que el sistema ya sabe.
 *
 * Uso:
 *   npx tsx scripts/srv20/importar-perfil-sirve-ccb.ts                 (dry run, producción)
 *   ENV_FILE=.env.staging.local npx tsx scripts/srv20/... --aplicar   (staging)
 *   npx tsx scripts/srv20/importar-perfil-sirve-ccb.ts --aplicar       (producción)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'
import {
  DONES, HABILIDADES, PASIONES, ESTILOS, opcionDelCatalogo, repartirDones, type PerfilSirve,
} from '../../src/lib/servers/perfil-sirve'

const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'
const CSV = 'data-import/perfil-sirve-ccb-2026-10-20.csv'
const RESPALDO = `docs/correcciones/2026-10-20-perfil-sirve-ccb${ARCHIVO_ENV.includes('staging') ? '-staging' : ''}.json`

const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
const ref = env.SUPABASE_STAGING_REF && env.NEXT_PUBLIC_SUPABASE_URL.includes(env.SUPABASE_STAGING_REF)
  ? env.SUPABASE_STAGING_REF : env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./)![1]

/**
 * Dos formas de hablar con la base, UNA interfaz (`query`):
 *  · `pg` directo, con SUPABASE_DB_PASSWORD (producción).
 *  · La API de administración de Supabase (staging no tiene contraseña de
 *    Postgres; es lo que usa scripts/staging/aplicar-sql.mjs). Los
 *    parámetros se incrustan como literales porque ese endpoint no acepta
 *    bind params: se escapan con la regla de Postgres (comillas dobles).
 */
type Fila = Record<string, unknown>
type Db = { connect(): Promise<void>; query<T extends Fila = Fila>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; end(): Promise<void> }

function dbDirecta(): Db {
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  return { connect: () => c.connect(), query: (sql, params) => c.query(sql, params) as Promise<{ rows: Fila[] }>, end: () => c.end() }
}

function dbPorApi(): Db {
  const token = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])).SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('Falta SUPABASE_ACCESS_TOKEN en .env.local')
  const lit = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (Array.isArray(v)) return `ARRAY[${v.map(lit).join(',')}]::text[]`
    return `'${String(v).replace(/'/g, "''")}'`
  }
  // $1..$n → literal. Los casts del SQL ($1::uuid[], ::text[]) siguen funcionando sobre el literal.
  const incrustar = (sql: string, params: unknown[] = []) =>
    sql.replace(/\$(\d+)(::[a-z\[\]]+)?/g, (_m, n, cast) => {
      const v = params[Number(n) - 1]
      if (Array.isArray(v) && cast) return `ARRAY[${v.map(x => `'${String(x).replace(/'/g, "''")}'`).join(',')}]${cast}`
      return lit(v) + (cast && !Array.isArray(v) ? cast : '')
    })
  return {
    connect: async () => {},
    query: async (sql, params) => {
      // Cada llamada es una petición aparte, sin sesión: begin/commit/rollback
      // no agrupan nada. Se dice en vez de fingirlo; el upsert por fila es
      // idempotente, así que re-correr completa lo que haya quedado a medias.
      if (/^(begin|commit|rollback)$/i.test(sql.trim())) return { rows: [] }
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: incrustar(sql, params) }),
      })
      const cuerpo = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${cuerpo.slice(0, 300)}`)
      return { rows: (cuerpo && cuerpo !== '[]' ? JSON.parse(cuerpo) : []) as Fila[] }
    },
    end: async () => {},
  }
}

const db: Db = env.SUPABASE_DB_PASSWORD ? dbDirecta() : dbPorApi()
if (!env.SUPABASE_DB_PASSWORD && APLICAR) console.log('(aviso: por la API no hay transacción; el upsert es idempotente y se puede re-correr)')

// Columnas por POSICIÓN (las 17, 23 y 25 no tienen encabezado). Las 19, 21,
// 29, 30 y 31 (formación, ocupación, trayectoria) ya NO se importan:
// decisión de Floriana 2026-10-21 — la profesión vive en members.occupation.
const C = {
  fecha: 0, responseId: 2, individualId: 5, email: 8,
  donesTest: 15, donesOracion: 16, otrosDones: 17, estilo1: 18, estilo2: 20,
  habilidades: 22, otrasHabilidades: 23, pasiones: 24, otrasPasiones: 25,
} as const

const SIN_DONES_EN_ORACION = /no me dijeron ninguno/i
const NADA = /^(no|n\/a|na|ninguno|ninguna|nada|-|\.)$/i
const limpiar = (s: string) => { const t = s.trim(); return !t || NADA.test(t) ? null : t }

/** Una celda multiselección de CCB → lo del catálogo y lo que sobra. */
function partir(celda: string, catalogo: readonly string[]): { enCatalogo: string[]; sobra: string[] } {
  const enCatalogo: string[] = [], sobra: string[] = []
  for (const p of celda.split(',').map(s => s.trim()).filter(Boolean)) {
    const o = opcionDelCatalogo(catalogo, p)
    if (o && !enCatalogo.includes(o)) enCatalogo.push(o)
    else if (!o) sobra.push(p)
  }
  return { enCatalogo, sobra }
}

const unir = (...partes: Array<string | null | undefined>) => {
  const t = partes.map(p => (p ?? '').trim()).filter(Boolean)
  return t.length ? [...new Set(t)].join('; ') : null
}

function perfilDeFila(f: string[]): PerfilSirve {
  const test = partir(f[C.donesTest], DONES)
  const oracionCruda = f[C.donesOracion].split(',').map(s => s.trim()).filter(Boolean)
  const sinDones = oracionCruda.some(s => SIN_DONES_EN_ORACION.test(s))
  const oracion = partir(oracionCruda.filter(s => !SIN_DONES_EN_ORACION.test(s)).join(','), DONES)
  // El texto libre de «otros dones» también puede traer dones del catálogo
  // («Si, don de profecía, misericordia y lenguas»): se reparte.
  const otros = repartirDones(limpiar(f[C.otrosDones]))
  const hab = partir(f[C.habilidades], HABILIDADES)
  const pas = partir(f[C.pasiones], PASIONES)
  const estilo = (s: string) => opcionDelCatalogo(ESTILOS, s)
  return {
    dones_test: test.enCatalogo,
    dones_oracion: [...new Set([...oracion.enCatalogo, ...otros.catalogo])],
    oracion_sin_dones: sinDones && oracion.enCatalogo.length === 0 && otros.catalogo.length === 0,
    otros_dones: unir(...test.sobra, ...oracion.sobra, otros.otros),
    estilo_primario: estilo(f[C.estilo1]),
    estilo_secundario: estilo(f[C.estilo2]),
    habilidades: hab.enCatalogo,
    otras_habilidades: unir(...hab.sobra, limpiar(f[C.otrasHabilidades])),
    pasiones: pas.enCatalogo,
    otras_pasiones: unir(...pas.sobra, limpiar(f[C.otrasPasiones])),
  }
}

async function main() {
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}  (${APLICAR ? 'APLICAR' : 'dry run'}; ${env.SUPABASE_DB_PASSWORD ? 'pg directo' : 'API de administración'})\n`)
  const filas = (parse(readFileSync(CSV), { bom: true, relax_column_count: true }) as string[][]).slice(1)
  console.log(`respuestas en el CSV: ${filas.length}`)

  // La MÁS RECIENTE por persona (por ID; sin ID, por correo).
  const clave = (f: string[]) => f[C.individualId].trim() ? `id:${f[C.individualId].trim()}` : `mail:${f[C.email].trim().toLowerCase()}`
  const fecha = (f: string[]) => f[C.fecha].replace(/\//g, '-')
  const ultima = new Map<string, string[]>()
  for (const f of filas) { const k = clave(f); const p = ultima.get(k); if (!p || fecha(f) > fecha(p)) ultima.set(k, f) }
  console.log(`personas distintas: ${ultima.size} (${filas.length - ultima.size} respuestas repetidas descartadas, gana la más reciente)`)

  await db.connect()
  // Resolver IDs y correos en lote.
  const conId = [...ultima.values()].filter(f => f[C.individualId].trim())
  const sinId = [...ultima.values()].filter(f => !f[C.individualId].trim())
  const porId = new Map<string, string | null>()
  for (let i = 0; i < conId.length; i += 500) {
    const exts = conId.slice(i, i + 500).map(f => f[C.individualId].trim())
    const { rows } = await db.query<{ ext: string; mid: string | null }>('select e as ext, member_por_external_id(e) mid from unnest($1::text[]) e', [exts])
    for (const r of rows) porId.set(r.ext, r.mid)
  }
  const correos = sinId.map(f => f[C.email].trim().toLowerCase())
  const { rows: porMail } = await db.query<{ email: string; ids: string[] }>(
    `select lower(email) email, array_agg(id::text) ids from members where is_active and lower(email) = any($1::text[]) group by 1`, [correos])
  const idsDeCorreo = new Map(porMail.map(r => [r.email, r.ids]))

  const resolver: Array<{ f: string[]; memberId: string }> = []
  const sinFicha: string[] = [], ambiguos: string[] = []
  for (const f of conId) { const m = porId.get(f[C.individualId].trim()); if (m) resolver.push({ f, memberId: m }); else sinFicha.push(`ID ${f[C.individualId].trim()} · ${f[6]} ${f[7]} <${f[C.email]}>`) }
  for (const f of sinId) {
    const ids = idsDeCorreo.get(f[C.email].trim().toLowerCase()) ?? []
    if (ids.length === 1) resolver.push({ f, memberId: ids[0] })
    else if (ids.length === 0) sinFicha.push(`sin ID · ${f[6]} ${f[7]} <${f[C.email]}>`)
    else ambiguos.push(`${f[6]} ${f[7]} <${f[C.email]}> → ${ids.length} fichas vivas`)
  }
  console.log(`\nresueltas: ${resolver.length}  ·  sin ficha: ${sinFicha.length}  ·  correo ambiguo: ${ambiguos.length}`)

  // Lo que ya hay en el sistema: no se pisa lo editado acá; lo importado antes se re-importa igual.
  const ids = resolver.map(r => r.memberId)
  // Sin la migración SRV-20 (producción antes del deploy) el dry run igual
  // sirve para el match; solo no sabe qué está protegido.
  const { rows: [{ lista }] } = await db.query<{ lista: boolean }>(
    `select exists(select 1 from information_schema.columns where table_name='member_spiritual_data' and column_name='editado_en_sistema_at') lista`)
  if (!lista && APLICAR) throw new Error('Falta la migración 20261020200000_srv20_perfil_sirve en esta base.')
  if (!lista) console.log('\n(aviso: esta base aún no tiene la migración SRV-20; el conteo de protegidos es 0)')
  const { rows: existentes } = lista
    ? await db.query<{ member_id: string; editado_en_sistema_at: string | null; sirve_ccb_response_id: string | null }>(
        'select member_id, editado_en_sistema_at, sirve_ccb_response_id from member_spiritual_data where member_id = any($1::uuid[])', [ids])
    : { rows: [] as Array<{ member_id: string; editado_en_sistema_at: string | null; sirve_ccb_response_id: string | null }> }
  const actual = new Map(existentes.map(e => [e.member_id, e]))
  const aEscribir = resolver.filter(r => !actual.get(r.memberId)?.editado_en_sistema_at)
  const protegidos = resolver.length - aEscribir.length
  const yaImportados = aEscribir.filter(r => actual.get(r.memberId)?.sirve_ccb_response_id === r.f[C.responseId]).length
  console.log(`a escribir: ${aEscribir.length}  (protegidos por edición en el sistema: ${protegidos}; de los ${aEscribir.length}, ${yaImportados} ya tenían esta misma respuesta)`)

  // Muestra de cómo queda el mapeo, para leer antes de aplicar.
  const muestra = aEscribir.slice(0, 3).map(r => ({ memberId: r.memberId, ...perfilDeFila(r.f) }))
  console.log('\nmuestra:', JSON.stringify(muestra, null, 1).slice(0, 1800))
  if (sinFicha.length) console.log(`\nSIN FICHA (${sinFicha.length}):\n  ` + sinFicha.slice(0, 15).join('\n  ') + (sinFicha.length > 15 ? `\n  … y ${sinFicha.length - 15} más` : ''))
  if (ambiguos.length) console.log(`\nCORREO AMBIGUO (${ambiguos.length}):\n  ` + ambiguos.join('\n  '))

  if (!APLICAR) { console.log('\n🔎 DRY RUN — nada escrito. Corré con --aplicar.'); await db.end(); return }

  // Respaldo de lo que hay antes, y escritura en una transacción.
  const { rows: antes } = await db.query('select * from member_spiritual_data where member_id = any($1::uuid[])', [aEscribir.map(r => r.memberId)])
  writeFileSync(RESPALDO, JSON.stringify({
    motivo: 'SRV-20 etapa 3: import del formulario 128 de CCB al perfil S.I.R.V.E. (gana la respuesta más reciente; no pisa lo editado en el sistema).',
    csv: CSV, resueltas: resolver.length, escritas: aEscribir.length, protegidos, sin_ficha: sinFicha, ambiguos, antes,
  }, null, 1))
  await db.query('begin')
  try {
    let n = 0
    for (const r of aEscribir) {
      const p = perfilDeFila(r.f)
      await db.query(`
        insert into member_spiritual_data (member_id, dones_test, dones_oracion, oracion_sin_dones, otros_dones, estilo_primario, estilo_secundario,
          habilidades, otras_habilidades, pasiones, otras_pasiones,
          sirve_fuente, sirve_ccb_response_id, sirve_ccb_submitted_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ccb',$12,$13,now())
        on conflict (member_id) do update set
          dones_test=excluded.dones_test, dones_oracion=excluded.dones_oracion, oracion_sin_dones=excluded.oracion_sin_dones, otros_dones=excluded.otros_dones,
          estilo_primario=excluded.estilo_primario, estilo_secundario=excluded.estilo_secundario,
          habilidades=excluded.habilidades, otras_habilidades=excluded.otras_habilidades, pasiones=excluded.pasiones, otras_pasiones=excluded.otras_pasiones,
          sirve_fuente='ccb', sirve_ccb_response_id=excluded.sirve_ccb_response_id, sirve_ccb_submitted_at=excluded.sirve_ccb_submitted_at, updated_at=now()
        where member_spiritual_data.editado_en_sistema_at is null`,
        [r.memberId, p.dones_test, p.dones_oracion, p.oracion_sin_dones, p.otros_dones, p.estilo_primario, p.estilo_secundario,
          p.habilidades, p.otras_habilidades, p.pasiones, p.otras_pasiones,
          r.f[C.responseId], new Date(fecha(r.f)).toISOString()])
      n++
    }
    await db.query('commit')
    const { rows: [v] } = await db.query(`select count(*) n from member_spiritual_data where sirve_fuente='ccb'`)
    console.log(`\n✅ ${n} perfiles escritos · con fuente ccb en la base: ${v.n} · respaldo: ${RESPALDO}`)
  } catch (e) { await db.query('rollback'); throw e }
  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
