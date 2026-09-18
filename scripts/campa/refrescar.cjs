/**
 * Campa 2026 · Recalcula la lista contra el padrón de AHORA.
 *
 * Hace falta porque la lista es una foto: guarda ids, no una consulta. Entre que
 * se armó (11:0x) y ahora, la usuaria fusionó a Mathias Fernandez —la ficha
 * duplicada quedó `is_active=false, deactivation_reason='merged'` y sus puestos
 * se movieron a la ficha buena—, así que la lista apuntaba a una ficha muerta y
 * le faltaba la viva.
 *
 * Se recalcula entera en vez de parchar ese caso: cualquier fusión, alta o baja
 * posterior queda contemplada.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const APLICAR = process.argv.includes('--aplicar')
const LISTA = 'Servidores que NO fueron al campa 2026'

// Los 3 que el cruce no resolvió y la usuaria identificó a mano.
const FUERON_A_MANO = ['113840219', '112780725']

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const fueron = new Set(JSON.parse(fs.readFileSync('/tmp/campa-fueron.json', 'utf8')))

  // Los identificados a mano, resueltos ahora (por si alguno se fusionó también).
  for (const ced of FUERON_A_MANO) {
    const { rows } = await c.query(
      `select id from members where is_active and regexp_replace(coalesce(cedula,''),'\\D','','g') = $1`, [ced])
    if (rows.length === 1) fueron.add(rows[0].id)
  }
  const { rows: alv } = await c.query(
    `select id from members where is_active and lower(first_name||' '||last_name) like '%lvaro%villalobos%jim%'`)
  if (alv.length === 1) fueron.add(alv[0].id)

  const { rows: servidores } = await c.query(`
    select distinct m.id, m.first_name||' '||m.last_name nombre, m.email, m.phone,
           coalesce(m.email_bounced,false) rebotado
    from volunteers v join members m on m.id = v.member_id
    where v.status = 'active' and m.is_active
    order by 2`)
  const lista = servidores.filter(s => !fueron.has(s.id))

  const { rows: [l] } = await c.query('select id, member_ids from member_lists where name = $1', [LISTA])
  const antes = new Set(l.member_ids)
  const ahora = new Set(lista.map(s => s.id))
  const salen = [...antes].filter(x => !ahora.has(x))
  const entran = [...ahora].filter(x => !antes.has(x))

  console.log(`lista: ${antes.size} → ${ahora.size}`)
  for (const [t, ids] of [['salen', salen], ['entran', entran]]) {
    if (!ids.length) continue
    const { rows } = await c.query(
      `select first_name||' '||last_name n, is_active, deactivation_reason r from members where id = any($1)`, [ids])
    console.log(`  ${t} (${ids.length}): ${rows.map(x => `${x.n}${x.is_active ? '' : ' [baja: ' + (x.r ?? '—') + ']'}`).join(', ')}`)
  }

  // Lo que pidió la usuaria: a quién NO le va a llegar el correo.
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`
  const malos = lista.filter(s => !String(s.email ?? '').trim() || s.rebotado)
  console.log(`\nsin correo o con correo rebotado: ${malos.length} de ${lista.length}`)
  console.log(`  ALCANZABLES por correo: ${lista.length - malos.length}`)
  fs.writeFileSync('/tmp/campa-correo-malo.csv', '﻿' + ['nombre,correo,problema,telefono,comites,id',
    ...malos.map(s => [q(s.nombre), q(s.email), q(!String(s.email ?? '').trim() ? 'sin correo' : 'correo rebotado'),
                       q(s.phone), q(''), s.id].join(','))].join('\n'))

  if (!APLICAR) { console.log('\n>>> DRY-RUN'); await c.end(); return }
  await c.query(`update member_lists set member_ids = $1::jsonb, member_count = $2, updated_at = now() where id = $3`,
    [JSON.stringify([...ahora]), ahora.size, l.id])
  console.log('\n>>> LISTA ACTUALIZADA')
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
