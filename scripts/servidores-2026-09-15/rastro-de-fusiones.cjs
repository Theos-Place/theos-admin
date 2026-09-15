/**
 * BACKFILL · Devolverle el rastro a las fusiones anteriores al 14-set.
 *   npx tsx --env-file=.env.local scripts/servidores-2026-09-15/rastro-de-fusiones.cjs [--aplicar]
 *
 * external_id_fusionados nació con la migración 20260914180000, así que las 14
 * fusiones de junio a setiembre no dejaron rastro: el external_id de CCB quedó
 * en la ficha muerta y la viva no lo conoce. Para el próximo import de CCB esas
 * personas son gente nueva, y crearles una ficha desharía la fusión.
 *
 * El par (principal, duplicado) sale del audit_log —action='MERGE', entity_id
 * es el principal— así que no hay que adivinar por nombre ni por cédula. Las
 * fusiones viejas solo guardaron new_data.duplicate_id y las nuevas guardan
 * old_data entero: se aceptan las dos formas, y el external_id se lee de la
 * ficha del duplicado, que sigue ahí inactiva.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows: fusiones } = await c.query(`
    select al.entity_id principal_id,
           d.external_id dup_ext,
           d.first_name||' '||d.last_name dup_persona,
           al.created_at
    from audit_log al
    join members d
      on d.id = coalesce(al.old_data->>'id', al.new_data->>'duplicate_id')::uuid
    where al.action = 'MERGE' and al.entity_type = 'members'
      and d.external_id is not null
    order by al.created_at`)

  const pendientes = []
  for (const f of fusiones) {
    const { rows: [p] } = await c.query(
      `select id, first_name||' '||last_name persona, external_id, external_id_fusionados fus, is_active
       from members where id = $1`, [f.principal_id])
    // El principal puede haber desaparecido (fusionado a su vez) o ya tener el
    // rastro: en los dos casos no hay nada que hacer.
    if (!p) continue
    if ((p.fus ?? []).includes(f.dup_ext)) continue
    if (p.external_id === f.dup_ext) continue
    pendientes.push({ ...f, p })
  }

  console.log(`fusiones con external_id en el audit_log: ${fusiones.length}`)
  console.log(`sin rastro en la ficha viva: ${pendientes.length}\n`)
  for (const x of pendientes) {
    console.log(`   ${String(x.created_at).slice(0,10)}  ${x.p.persona.padEnd(32)} ext propio=${String(x.p.external_id ?? '(null)').padEnd(7)}  ← absorbe ${x.dup_ext} (${x.dup_persona})`)
    await c.query(`
      update members set external_id_fusionados = (
        select array_agg(distinct e) from unnest(
          coalesce(external_id_fusionados, array[]::text[]) || array[$2::text]) e),
        updated_at = now()
      where id = $1`, [x.p.id, x.dup_ext])
  }

  // ── Segunda pasada: las fusiones del 22-jun, anteriores al audit_log ──
  // El audit_log más viejo con action='MERGE' es del 14 de julio, así que las
  // seis fusiones de junio no dejaron ningún rastro. Acá sí hay que inferir,
  // y el proyecto matchea por external_id y NUNCA por nombre — por eso la
  // condición es dura: se acepta solo si hay EXACTAMENTE UNA ficha viva con el
  // nombre idéntico. Con cero o con dos, se reporta y no se toca.
  const { rows: huerfanas } = await c.query(`
    select m.id, m.external_id ext, m.first_name, m.last_name, m.email, m.cedula_normalized ced
    from members m
    where not m.is_active and m.deactivation_reason = 'merged' and m.external_id is not null
      and not exists (select 1 from members p where p.external_id_fusionados @> array[m.external_id])
    order by m.last_name, m.first_name`)

  console.log(`\nSin rastro en el audit_log (fusiones de junio): ${huerfanas.length}`)
  const ambiguas = []
  for (const h of huerfanas) {
    const { rows: cand } = await c.query(`
      select id, external_id ext, first_name||' '||last_name persona
      from members
      where is_active and id <> $1
        and lower(first_name) = lower($2) and lower(last_name) = lower($3)`,
      [h.id, h.first_name, h.last_name])
    if (cand.length !== 1) { ambiguas.push({ h, n: cand.length }); continue }
    console.log(`   ${h.first_name} ${h.last_name}`.padEnd(38) + ` ${h.ext} → ficha viva ext=${cand[0].ext}`)
    await c.query(`
      update members set external_id_fusionados = (
        select array_agg(distinct e) from unnest(
          coalesce(external_id_fusionados, array[]::text[]) || array[$2::text]) e),
        updated_at = now()
      where id = $1`, [cand[0].id, h.ext])
  }
  if (ambiguas.length) {
    console.log(`   ⚠️  sin resolver (0 o más de un candidato): ${ambiguas.length}`)
    ambiguas.forEach(x => console.log(`      ${x.h.ext}  ${x.h.first_name} ${x.h.last_name}  candidatos=${x.n}`))
  }

  // Verificación: cada external_id de una ficha fusionada tiene que resolver a
  // una ficha VIVA. Es la pregunta que de verdad importa, no cuántas filas se
  // tocaron.
  const { rows: v } = await c.query(`
    select m.external_id ext, m.first_name||' '||m.last_name persona,
           member_por_external_id(m.external_id) resuelve,
           (select p.is_active from members p where p.id = member_por_external_id(m.external_id)) viva
    from members m
    where not m.is_active and m.deactivation_reason = 'merged' and m.external_id is not null`)
  const malos = v.filter(r => !r.viva)
  console.log(`\nVERIFICACIÓN · ${v.length} external_id de fichas fusionadas:`)
  console.log(`   resuelven a una ficha viva: ${v.length - malos.length}`)
  if (malos.length) {
    console.log(`   ⚠️  siguen apuntando a una ficha muerta: ${malos.length}`)
    malos.forEach(r => console.log(`      ${r.ext}  ${r.persona}`))
  }

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
