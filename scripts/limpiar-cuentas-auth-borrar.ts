/**
 * AUT-2 · Etapa 2 — BORRA las cuentas de acceso sin uso.
 *
 *   npx tsx scripts/limpiar-cuentas-auth-borrar.ts                 # dry-run
 *   npx tsx scripts/limpiar-cuentas-auth-borrar.ts --limite 20     # dry-run de 20
 *   APLICAR=1 npx tsx scripts/limpiar-cuentas-auth-borrar.ts --limite 20
 *   APLICAR=1 npx tsx scripts/limpiar-cuentas-auth-borrar.ts       # todas
 *
 * SE BORRA SOLO LA CUENTA DE LOGIN. La ficha del miembro no se toca: se le
 * pone `auth_user_id` en NULL y nada más. Y es recuperable en la práctica —
 * "Conseguí tu contraseña" vuelve a crear la cuenta y a enlazarla sola cuando
 * la persona aparece (`buildPasswordLink` con tipo `invite`).
 *
 * EL CRITERIO SE RECALCULA ACÁ, no se lee del CSV de la etapa 1: entre el
 * reporte y el borrado alguien pudo entrar, matricularse o recibir un rol.
 *
 * POR QUÉ SQL DIRECTO Y NO `auth.admin.deleteUser`. Dos razones medidas el
 * 2026-09-22: esa API ya devolvió 500 en este proyecto con tablas grandes
 * (AUTH-1), y sobre todo el NULL de la ficha y el borrado tienen que ir en la
 * MISMA transacción. Si se hicieran sueltos y fallara el segundo, la persona
 * quedaría con la cuenta viva y la ficha desconectada: peor que no haber
 * empezado.
 *
 * LAS FK. `members.auth_user_id` es NO ACTION, así que el NULL va primero o el
 * delete falla. Las otras 18 columnas de `public` que apuntan a auth.users
 * (created_by, recorded_by, checked_in_by…) también son NO ACTION, pero se
 * midió que NINGUNA candidata aparece en ellas — tiene sentido: quien nunca
 * entró nunca creó nada. Igual se verifica antes de cada borrado, porque el
 * día que deje de ser cierto quiero enterarme acá y no por un error suelto.
 *
 * IDEMPOTENTE: la segunda corrida no encuentra nada — el criterio se recalcula,
 * así que lo ya borrado simplemente no aparece.
 *
 * UNA TRANSACCIÓN POR LOTE Y NO POR CUENTA. La primera versión abría una
 * transacción por persona: cuatro viajes al servidor cada una, unas 50 cuentas
 * por minuto, tres horas para las 9.600. Por lote de 200 son los mismos cuatro
 * viajes para todo el lote. Sigue siendo atómico —si algo falla, ese lote
 * entero se revierte y los anteriores quedan— y como el borrado es recuperable,
 * un lote revertido no deja a nadie a medias.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { motivoParaQuedarse, ANIOS_DE_VENTANA } from '../src/lib/auth/limpieza-de-cuentas'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

const require_ = createRequire(import.meta.url)
const { nuevoCliente } = require_('./madre-2026-09/lib.cjs') as {
  nuevoCliente: () => {
    connect(): Promise<void>
    query(q: string, p?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>
    end(): Promise<void>
  }
}

const APLICAR = process.env.APLICAR === '1'
const LIMITE = (() => {
  const i = process.argv.indexOf('--limite')
  return i >= 0 ? Number(process.argv[i + 1]) : 0
})()
const TAMANO_LOTE = 200
const PAUSA_MS = 300

/** Las 18 columnas de `public` que apuntan a auth.users y NO son SET NULL ni
 *  CASCADE. Si alguna candidata apareciera acá, el delete fallaría. */
const REFERENCIAS = [
  ['employee_documents', 'uploaded_by'], ['employees', 'created_by'],
  ['event_checkins', 'checked_in_by'], ['event_volunteers', 'assigned_by'],
  ['events', 'created_by'], ['forms', 'created_by'], ['import_batches', 'imported_by'],
  ['member_roles', 'revoked_by'], ['message_broadcasts', 'created_by'],
  ['message_templates', 'created_by'], ['payments', 'recorded_by'],
  ['refunds', 'processed_by'], ['salary_changes', 'approved_by'],
  ['scholarships', 'approved_by'], ['scholarships', 'created_by'],
  ['scholarships', 'revoked_by'], ['study_attendance', 'recorded_by'],
  ['study_sessions', 'created_by'],
] as const

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const hoy = new Date().toISOString().slice(0, 10)
  const c = nuevoCliente()
  await c.connect()

  console.log(APLICAR ? '*** MODO APLICAR — esto BORRA ***' : 'DRY-RUN (sin APLICAR=1 no se borra nada)')
  if (LIMITE) console.log(`Limitado a ${LIMITE} cuentas.`)

  // El criterio, recalculado contra la base en este momento.
  const { rows } = await c.query(`
    select u.id, u.email, u.last_sign_in_at, u.banned_until,
           m.id as member_id,
           coalesce(m.first_name||' '||m.last_name, '(sin ficha)') as nombre,
           exists (select 1 from member_roles r where r.member_id = m.id and r.is_active) as tiene_rol,
           exists (select 1 from event_checkins ci where ci.member_id = m.id
                   and ci.checked_in_at >= now() - interval '${ANIOS_DE_VENTANA} years') as asistio,
           exists (select 1 from study_enrollments e where e.member_id = m.id
                   and coalesce(e.status,'') <> 'cancelled'
                   and e.created_at >= now() - interval '${ANIOS_DE_VENTANA} years') as estudio
    from auth.users u
    left join members m on m.auth_user_id = u.id
    order by u.created_at`)

  const candidatas = rows.filter(r => motivoParaQuedarse({
    email: (r.email as string) ?? null,
    seLogueoAlgunaVez: !!r.last_sign_in_at,
    estaBloqueada: !!r.banned_until,
    tieneRolActivo: !!r.tiene_rol,
    asistioEnLaVentana: !!r.asistio,
    estudioEnLaVentana: !!r.estudio,
  }) === null)

  console.log(`\nCuentas: ${rows.length} · candidatas ahora: ${candidatas.length}`)
  if (candidatas.length === 0) { console.log('Nada que hacer.'); await c.end(); return }

  // Guard global: ninguna candidata puede estar referenciada por las 18
  // columnas NO ACTION. Se mira ANTES de empezar, no cuando explote a la mitad.
  const ids = candidatas.map(r => r.id as string)
  const bloqueadas = new Set<string>()
  for (const [tabla, col] of REFERENCIAS) {
    const { rows: ref } = await c.query(
      `select distinct x.${col}::text as id from ${tabla} x where x.${col} = any($1::uuid[])`, [ids])
    for (const r of ref) {
      bloqueadas.add(r.id as string)
      console.log(`  ⚠ referenciada por ${tabla}.${col}: ${r.id}`)
    }
  }
  if (bloqueadas.size > 0) {
    console.log(`\n${bloqueadas.size} cuentas quedan FUERA por estar referenciadas. No se borran.`)
  }

  const aBorrar = candidatas.filter(r => !bloqueadas.has(r.id as string))
    .slice(0, LIMITE || undefined)
  console.log(`A borrar en esta corrida: ${aBorrar.length}\n`)

  const log: string[][] = []
  let hechas = 0, fallidas = 0
  for (let i = 0; i < aBorrar.length; i += TAMANO_LOTE) {
    const lote = aBorrar.slice(i, i + TAMANO_LOTE)
    const ids = lote.map(r => r.id as string)
    if (!APLICAR) {
      for (const r of lote) log.push([r.id as string, (r.email as string) ?? '', r.nombre as string, 'dry-run'])
      hechas += lote.length
    } else {
      try {
        // El NULL de las fichas y el borrado, en la MISMA transacción.
        await c.query('begin')
        await c.query('update members set auth_user_id = null where auth_user_id = any($1::uuid[])', [ids])
        const del = await c.query('delete from auth.users where id = any($1::uuid[])', [ids])
        if (del.rowCount !== ids.length) {
          throw new Error(`el delete afectó ${del.rowCount} filas y el lote tiene ${ids.length}`)
        }
        await c.query('commit')
        for (const r of lote) log.push([r.id as string, (r.email as string) ?? '', r.nombre as string, 'borrada'])
        hechas += lote.length
      } catch (e) {
        await c.query('rollback').catch(() => {})
        const msg = e instanceof Error ? e.message : String(e)
        for (const r of lote) log.push([r.id as string, (r.email as string) ?? '', r.nombre as string, `ERROR: ${msg}`])
        fallidas += lote.length
        console.log(`  ✗ lote ${i}-${i + lote.length}: ${msg}`)
      }
    }
    console.log(`  ${Math.min(i + TAMANO_LOTE, aBorrar.length)}/${aBorrar.length}`)
    if (i + TAMANO_LOTE < aBorrar.length) await dormir(PAUSA_MS)
  }

  mkdirSync('data-import', { recursive: true })
  const ruta = `data-import/cuentas-auth-borradas-${hoy}.csv`
  writeFileSync(ruta, ['auth_user_id,correo,nombre,resultado',
    ...log.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n')

  console.log(`\n${APLICAR ? 'Borradas' : 'Se borrarían'}: ${hechas}${fallidas ? ` · fallidas: ${fallidas}` : ''}`)
  console.log(`Log: ${ruta}`)
  if (APLICAR) {
    const { rows: quedan } = await c.query('select count(*)::int n from auth.users')
    console.log(`auth.users ahora: ${quedan[0].n}`)
  }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
