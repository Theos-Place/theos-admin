// INF-1 · Corre un .sql contra STAGING por el API de gestión de Supabase.
//
// POR QUÉ EXISTE: staging no tiene `SUPABASE_DB_URL` —la contraseña de la base
// nunca se pudo resetear por el API, quedó anotado en docs/staging.md— y con
// solo la llave de servicio no se puede hacer `create function`: PostgREST
// expone tablas y RPC, no DDL. Sin esto, toda migración que no fuera un update
// de filas había que aplicarla a mano desde el panel.
//
// El token de gestión sale de `.env.local` (`SUPABASE_ACCESS_TOKEN`) y el
// proyecto destino de `.env.staging.local` (`SUPABASE_STAGING_REF`), así que no
// hay forma de apuntarle a producción por accidente: son dos archivos y el ref
// se comprueba abajo.
//
// Uso:
//   node scripts/staging/aplicar-sql.mjs supabase/migrations/2026…_algo.sql
import { readFileSync } from 'node:fs'

const archivo = process.argv[2]
if (!archivo) { console.error('Uso: node scripts/staging/aplicar-sql.mjs <archivo.sql>'); process.exit(1) }

const leerEnv = (f) => Object.fromEntries(
  readFileSync(f, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const P = leerEnv('.env.local')
const S = leerEnv('.env.staging.local')

const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'
const ref = S.SUPABASE_STAGING_REF || (S.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z]+)\.supabase\.co/) ?? [])[1]
if (!ref) { console.error('✗ No se pudo determinar el proyecto de staging.'); process.exit(1) }
if (ref === REF_PRODUCCION) { console.error('✗ Eso es PRODUCCIÓN. Abortado.'); process.exit(1) }
if (!P.SUPABASE_ACCESS_TOKEN) { console.error('✗ Falta SUPABASE_ACCESS_TOKEN en .env.local'); process.exit(1) }

const sql = readFileSync(archivo, 'utf8')
console.log(`→ ${archivo}`)
console.log(`→ proyecto ${ref}\n`)

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${P.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const cuerpo = await res.text()
if (!res.ok) { console.error(`✗ HTTP ${res.status}\n${cuerpo}`); process.exit(1) }
console.log('✓ aplicado')
if (cuerpo && cuerpo !== '[]') console.log(cuerpo.slice(0, 500))
