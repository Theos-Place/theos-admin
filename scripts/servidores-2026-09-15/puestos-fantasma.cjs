/**
 * SRV-3 · Puestos fantasma: activos como puesto, con CERO personas activas, y
 * con un gemelo vivo de nombre casi igual en el mismo comité.
 *   npx tsx --env-file=.env.local scripts/servidores-2026-09-15/puestos-fantasma.cjs [--aplicar]
 *
 * Los dejó el renombre de puestos: «Colaborador Abuelitos GAM» al lado de
 * «Colaborador Abuelitos», «Orador Cartago» al lado de «Orador Cartago GR». No
 * rompen nada, pero ensucian los selectores y hacen que una ficha se lea como
 * inactiva cuando no lo está.
 *
 * NO se borran: se marcan is_active=false. El puesto sigue existiendo para que
 * el historial de quien lo tuvo no quede colgando de la nada, y revivirlo es
 * poner el flag de vuelta.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim().toLowerCase()
const parecido = (a, b) => a === b || a.startsWith(b) || b.startsWith(a)

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select sp.id, sp.title, a.name comite,
           count(*) filter (where v.status = 'active')::int activos,
           count(v.id)::int historicos
    from service_positions sp
    join areas a on a.id = sp.area_id
    left join volunteers v on v.position_id = sp.id
    where sp.is_active and a.name not like '[prueba]%'
    group by sp.id, sp.title, a.name`)

  const porComite = new Map()
  for (const r of rows) {
    if (!porComite.has(r.comite)) porComite.set(r.comite, [])
    porComite.get(r.comite).push(r)
  }

  const fantasmas = []
  for (const [, lista] of porComite) {
    for (const r of lista) {
      if (r.activos > 0) continue
      // Sin nadie NUNCA no es un fantasma del renombre: es un puesto que se
      // creó y todavía no se llenó. Ese se deja en paz.
      if (r.historicos === 0) continue
      const gemelo = lista.find(o => o.id !== r.id && o.activos > 0 && parecido(norm(o.title), norm(r.title)))
      if (gemelo) fantasmas.push({ ...r, gemelo })
    }
  }

  console.log(`puestos fantasma: ${fantasmas.length}\n`)
  for (const f of fantasmas.sort((a, b) => a.comite.localeCompare(b.comite))) {
    console.log(`   ${f.comite}`)
    console.log(`      «${f.title}» (${f.historicos} en el historial, 0 activos)`)
    console.log(`      → vivo: «${f.gemelo.title}» con ${f.gemelo.activos}`)
  }

  const { rowCount } = await c.query(
    `update service_positions set is_active = false, updated_at = now() where id = any($1)`,
    [fantasmas.map(f => f.id)])
  console.log(`\ndesactivados: ${rowCount}`)

  const { rows: [q] } = await c.query(`
    select count(*)::int puestos_activos,
           count(*) filter (where existe.activos = 0)::int sin_gente
    from service_positions sp
    join areas a on a.id = sp.area_id
    join lateral (select count(*) filter (where v.status='active')::int activos
                  from volunteers v where v.position_id = sp.id) existe on true
    where sp.is_active and a.name not like '[prueba]%'`)
  console.log(`quedan ${q.puestos_activos} puestos activos, ${q.sin_gente} de ellos sin nadie (vacantes legítimas)`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
