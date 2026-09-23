/**
 * Aplicar las migraciones pendientes antes de construir.
 *
 * POR QUÉ EN EL BUILD Y NO EN UN WORKFLOW APARTE. El deploy y la migración
 * tienen que pasar EN ORDEN: si el código nuevo llega a una base vieja, la
 * pantalla se rompe para todo el mundo hasta que alguien se acuerde de correr
 * el SQL. Un workflow de GitHub corre en paralelo con el deploy de Vercel y esa
 * carrera se pierde en silencio. Acá el orden es el del comando:
 *
 *     migrar  →  next build  →  deploy
 *
 * Y si la migración falla, el build falla y NO HAY DEPLOY. Falla cerrada, que
 * es lo que uno quiere de algo que toca el esquema de producción.
 *
 * APLICA SOLO EN PRODUCCIÓN, y esto no es pereza. En los deploys Preview las
 * variables `POSTGRES_*` las pone la integración Supabase–Vercel y apuntan a la
 * base REAL, no a staging (ver `docs/staging.md`). Si esto aplicara en un
 * preview, cada rama migraría producción.
 *
 * PERO EN PREVIEW SÍ CORRE, EN SECO: conecta, dice qué hay pendiente y no toca
 * nada. No es un lujo — es la lección de por qué esto falló la primera vez. El
 * runner estaba probado a fondo desde mi máquina y murió en el primer build
 * real por una diferencia del ENTORNO (el `sslmode` de la URL de Vercel). Un
 * ensayo en preview ejerce credenciales, red y SSL dentro del build, que es
 * donde estaba el fallo, y no puede romper nada porque no escribe.
 *
 * Y si el ensayo falla, el build de la rama falla: el problema aparece en el
 * PR y no en producción.
 *
 * UN CANDADO, porque dos deploys pueden construirse a la vez. `pg_advisory_lock`
 * es del servidor, así que sirve aunque las máquinas de build sean distintas.
 * El segundo espera y después no encuentra nada pendiente.
 *
 * EL SEARCH_PATH SE REPONE ANTES DE CADA ARCHIVO, y esto no es precaución
 * gratuita: el baseline arrastra un `SELECT pg_catalog.set_config('search_path',
 * '', false)` de `pg_dump`, que VACÍA el search_path de la sesión. Como acá
 * todos los archivos comparten conexión, la migración siguiente que nombre una
 * tabla sin calificar falla con «relation does not exist» aunque la tabla
 * exista. `supabase db reset` no lo sufre porque psql abre una sesión por
 * archivo; esto se descubrió justamente al correr las 114 desde cero y ver
 * reventar la tercera.
 *
 * CADA MIGRACIÓN EN SU PROPIA TRANSACCIÓN. Si la número 8 falla, las 7 de antes
 * quedan aplicadas y registradas: el reintento arranca donde quedó en vez de
 * repetir todo. Una transacción única sonaría más segura y sería peor —
 * Postgres no puede revertir un `create index concurrently` ni varias cosas de
 * DDL, así que el "todo o nada" es una ilusión.
 */
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

const DIR = 'supabase/migrations'
const CANDADO = 918273645  // arbitrario y estable; solo tiene que ser el mismo siempre

function url() {
  // NON_POOLING es la conexión directa. El pooler en modo transacción no
  // soporta varias sentencias DDL en una transacción ni los advisory locks
  // de sesión, que es justo lo que esto hace.
  return process.env.MIGRACIONES_DB_URL
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.SUPABASE_DB_URL
}

async function main() {
  const entorno = process.env.VERCEL_ENV
  // En cualquier cosa que no sea producción, ensayo: se mira y no se toca.
  const enSeco = Boolean(entorno) && entorno !== 'production'
  const conn = url()
  if (!conn) {
    // Sin credencial no se adivina: si esto corriera igual, un deploy podría
    // salir con el esquema viejo y nadie se enteraría.
    console.error('✗ migraciones: falta POSTGRES_URL_NON_POOLING (o MIGRACIONES_DB_URL)')
    process.exit(1)
  }

  // Supabase en la nube exige SSL; una base local no lo habla. Decidirlo por la
  // URL evita tener una variable más solo para esto.
  const esLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(conn)

  /**
   * SE LE QUITA EL `sslmode` A LA URL, y esto es lo que tumbó el primer intento
   * de encender esto (2026-09-23).
   *
   * `POSTGRES_URL_NON_POOLING`, que la pone la integración Supabase–Vercel,
   * viene con `?sslmode=require`. Desde pg 8.16 ese valor se interpreta como
   * `verify-full` —lo avisa el propio warning de la librería— y **pisa** el
   * `rejectUnauthorized: false` de acá. El certificado de Supabase es
   * autofirmado, así que el build moría con «self-signed certificate in
   * certificate chain» antes de tocar una sola migración.
   *
   * Quitando el parámetro, manda la opción `ssl` de abajo, que es lo que uno
   * escribió. Reproducido con las dos variantes contra el pooler real: sin
   * `sslmode` conecta, con él falla.
   */
  const limpia = conn.replace(/([?&])sslmode=[^&]*&?/gi, (_, sep) => (sep === '?' ? '?' : '&'))
                     .replace(/[?&]$/, '')
  const c = new Client({ connectionString: limpia, ssl: esLocal ? undefined : { rejectUnauthorized: false } })
  await c.connect()
  try {
    await c.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations
        (version text primary key, name text, statements text[])`)
    await c.query('select pg_advisory_lock($1)', [CANDADO])

    const ya = new Set((await c.query('select version from supabase_migrations.schema_migrations')).rows.map(r => r.version))
    const archivos = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
    const pendientes = archivos.filter(f => !ya.has(f.slice(0, 14)))

    if (!pendientes.length) {
      console.log(`· migraciones${enSeco ? ' (ensayo)' : ''}: al día (${archivos.length} aplicadas)`)
      return
    }
    console.log(`· migraciones${enSeco ? ' (ensayo)' : ''}: ${pendientes.length} pendiente(s) de ${archivos.length}`)
    if (enSeco) {
      for (const f of pendientes) console.log(`   ${f}`)
      console.log('· ensayo: no se aplicó ninguna (solo se aplican en producción)')
      return
    }

    // El search_path con el que se abrió la conexión, para reponerlo entre
    // archivos (ver la nota de arriba).
    const sp = (await c.query('show search_path')).rows[0].search_path

    for (const f of pendientes) {
      const version = f.slice(0, 14)
      const nombre = f.slice(15, -4)
      process.stdout.write(`   ${f} … `)
      await c.query(`set search_path to ${sp}`)
      await c.query('begin')
      try {
        await c.query(fs.readFileSync(path.join(DIR, f), 'utf8'))
        await c.query(
          `insert into supabase_migrations.schema_migrations (version, name)
           values ($1, $2) on conflict (version) do nothing`, [version, nombre])
        await c.query('commit')
        console.log('ok')
      } catch (e) {
        await c.query('rollback').catch(() => {})
        console.log('FALLÓ')
        console.error(`\n✗ ${f}\n  ${e.message}\n`)
        console.error('  El build se detiene: no se despliega código nuevo contra un esquema a medias.')
        process.exit(1)
      }
    }
    console.log(`· migraciones: ${pendientes.length} aplicada(s)`)
  } finally {
    await c.query('select pg_advisory_unlock($1)', [CANDADO]).catch(() => {})
    await c.end().catch(() => {})
  }
}

main().catch(e => { console.error('✗ migraciones:', e.message); process.exit(1) })
