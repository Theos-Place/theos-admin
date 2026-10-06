/**
 * EST-14 · Reparar los cierres LEGACY que quedaron sin folletos ni cobros.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/est14-legacy-2026-10/reparar.ts
 *   aplicar:  ... --aplicar
 *
 * El NODE_OPTIONS hace falta porque esto importa `queries/folletos`, que
 * arrastra `server-only`. Sin el flag el script muere a mitad del primer
 * grupo — y murió, la primera vez que se corrió.
 *
 * QUÉ PASÓ. EST-14 hizo que los cierres 1→2 y 3→4 dejaran de generar folletos
 * y cobros. Correcto bajo bloques —el par ya se pagó al entrar— y destructivo
 * para los grupos viejos, que pagaron y recibieron nivel por nivel.
 *
 * EL CENSO NO SE ESCRIBE A MANO. Se derivan los grupos sucesores que (a) son
 * de un nivel con folleto propio, (b) están marcados `legacy`, (c) tienen
 * gente matriculada y (d) no tienen tiquete de folletos o no tienen cobros.
 * Una lista de ids pegada no se puede verificar al releerla, y si alguien ya
 * arregló uno a mano el script lo duplicaría.
 *
 * IDEMPOTENTE. El tiquete de folletos lo crea `createAutoFolletoIfNeeded`, que
 * ya corta con `ya_existe` por el índice único. Los cobros se insertan solo
 * para quien NO tiene uno de matrícula en ese grupo.
 *
 * A QUIÉN NO SE LE COBRA: a quien tiene `cubre_bloque` (pagó el par), al
 * dirigente y al co-dirigente. El primero es el caso de los grupos mixtos —el
 * N3 de Michelle Guier tiene una persona que pagó ₡10.000 el 5 de octubre— y
 * sin esa exclusión se le cobraría N4 dos veces.
 *
 * `entity_type` va en 'study_group' porque es lo que acepta el CHECK de la
 * tabla. La primera versión decía 'study', que me pareció razonable y la base
 * rechazó: el valor se leyó del constraint, no se dedujo.
 *
 * SIN NINGÚN AVISO (decisión de Floriana, 2026-10-05). Ni correo ni campanita:
 * la comunicación va por cada dirigente. Por eso NO se usa el camino normal de
 * cobro —que notifica— sino un insert directo, y por eso los cobros nacen con
 * `reminder_exempt_until` adelante: el cron de recordatorios no les puede caer
 * encima mañana a gente que todavía no sabe que debe.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})
const APLICAR = process.argv.includes('--aplicar')

/** Desde cuándo se busca. El despliegue fue el 2026-10-02. */
const DESDE = '2026-10-02'

/**
 * Cuántos días quedan exentos del recordatorio automático.
 *
 * 14 días es un supuesto mío, no una decisión de Floriana: hacía falta un
 * número y éste le da a cada dirigente dos semanas para hablar con su gente
 * antes de que el sistema les escriba. Cambiarlo es una línea, y dejarlo en
 * 0 sería contradecir la decisión de que el aviso lo dé el dirigente.
 */
const DIAS_SIN_RECORDATORIO = 14

async function main() {
  await c.connect()
  const q = async (s: string, p?: unknown[]) => (await c.query(s, p as never)).rows

  const grupos = await q(`
    select g.id, g.name, p.code nivel, p.id plan_id, p.cost, p.currency,
           g.leader_id, g.co_leader_id, g.modalidad,
           (select count(*)::int from study_enrollments e
             where e.group_id = g.id and e.status in ('enrolled','pendiente_de_pago')) matriculados,
           (select count(*)::int from folleto_requests f where f.source_group_id = g.id) folletos,
           (select count(*)::int from payments pm
             where pm.study_group_id = g.id and pm.concept = 'matricula') cobros
      from study_groups g join study_plans p on p.id = g.plan_id
     where g.modalidad = 'legacy'
       and p.code in ('N2','N4')
       and g.created_at >= $1::date
     order by g.created_at`, [DESDE])

  const rotos = grupos.filter(g => g.matriculados > 0 && (g.folletos === 0 || g.cobros === 0))
  console.log(`${grupos.length} grupos legacy de N2/N4 creados desde ${DESDE}; `
    + `${rotos.length} sin folletos o sin cobros${APLICAR ? '' : '  (DRY RUN)'}\n`)

  let totalCobros = 0
  for (const g of rotos) {
    // A quién le falta el cobro. Las tres exclusiones, en la consulta.
    const pendientes = await q(`
      select e.id enrollment_id, e.member_id,
             trim(m.first_name||' '||m.last_name) persona
        from study_enrollments e join members m on m.id = e.member_id
       where e.group_id = $1 and e.status in ('enrolled','pendiente_de_pago')
         and e.cubre_bloque = false
         and e.member_id is distinct from $2 and e.member_id is distinct from $3
         and not exists (select 1 from payments pm
                          where pm.enrollment_id = e.id and pm.concept = 'matricula'
                            and pm.status <> 'cancelado')
       order by persona`, [g.id, g.leader_id, g.co_leader_id])
    const excluidos = g.matriculados - pendientes.length
    console.log(`  ${g.name}`)
    console.log(`     nivel ${g.nivel} · ${g.matriculados} matriculados · folletos: ${g.folletos} · cobros: ${g.cobros}`)
    console.log(`     cobros a crear: ${pendientes.length} de ₡${Number(g.cost).toLocaleString('es-CR')}`
      + (excluidos > 0 ? `  (${excluidos} excluidos: dirigentes, ya cobrados o ya pagaron el par)` : ''))
    for (const p of pendientes) console.log(`       · ${p.persona}`)
    totalCobros += pendientes.length

    if (!APLICAR) continue

    // 1 · El tiquete de folletos, por el camino normal (idempotente por índice).
    if (g.folletos === 0) {
      const { createAutoFolletoIfNeeded } = await import('@/lib/supabase/queries/folletos')
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
      const r = await createAutoFolletoIfNeeded(g.id, 'cierre', hoy)
      console.log(`     folletos → ${r.created ? 'creado ' + r.id : 'no: ' + r.reason}`)
    }

    // 2 · Los cobros, con insert directo para que NO salga ningún aviso.
    for (const p of pendientes) {
      await c.query(`
        insert into payments (member_id, amount, currency, payment_method, concept,
                              enrollment_id, study_group_id, entity_type, description, status,
                              reminder_exempt_until)
        values ($1, $2, $3, 'comprobante', 'matricula', $4, $5, 'study_group', $6, 'pending',
                now() + ($7 || ' days')::interval)`,
      [p.member_id, g.cost, g.currency ?? 'CRC', p.enrollment_id, g.id,
        `Matrícula · ${g.nivel === 'N4' ? 'Nivel 4' : 'Nivel 2'}`, DIAS_SIN_RECORDATORIO])
    }
    console.log(`     cobros → ${pendientes.length} creados, sin notificación, `
        + `sin recordatorio por ${DIAS_SIN_RECORDATORIO} días`)
  }

  console.log(`\nTOTAL: ${rotos.length} grupos, ${totalCobros} cobros`)
  if (!APLICAR) console.log('Para aplicar: --aplicar')
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
