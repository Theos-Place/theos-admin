/**
 * Campa de Servidores 2026 · La lista para el anuncio del 10 de octubre:
 * servidores ACTUALES menos los que ya fueron al campa.
 *
 * "Servidor actual" = voluntario con status 'active' en algún puesto Y ficha
 * activa. Quien fue al campa sale de `cruzar.cjs`, que resuelve el export de
 * CCB contra el padrón.
 *
 * Dry-run por defecto; `--aplicar` guarda la lista.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')

const APLICAR = process.argv.includes('--aplicar')
const NOMBRE = 'Servidores que NO fueron al campa 2026'
const DESCRIPCION =
  'Servidores activos al 18-set-2026 menos los 126 que asistieron al Campa de Servidores '
  + '(export de CCB, 130 respuestas). Para el anuncio de la actividad del 10 de octubre.'

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const fueron = new Set(JSON.parse(fs.readFileSync('/tmp/campa-fueron.json', 'utf8')))

  const { rows: servidores } = await c.query(`
    select distinct m.id, m.first_name||' '||m.last_name nombre, m.email,
           coalesce(m.email_bounced,false) rebotado, coalesce(m.newsletter_opt_out,false) sin_correo
    from volunteers v
    join members m on m.id = v.member_id
    where v.status = 'active' and m.is_active
    order by 2`)

  const fuera = servidores.filter(s => fueron.has(s.id))
  const lista = servidores.filter(s => !fueron.has(s.id))

  console.log(`servidores activos:            ${servidores.length}`)
  console.log(`  fueron al campa:             ${fuera.length}`)
  console.log(`  NO fueron → van en la lista: ${lista.length}`)
  const deLosQueFueron = fueron.size - fuera.length
  console.log(`\n(de los ${fueron.size} que fueron al campa, ${deLosQueFueron} ya no son servidores activos)`)

  const sinCorreo = lista.filter(s => !String(s.email ?? '').trim())
  const rebotados = lista.filter(s => s.rebotado)
  const bajas = lista.filter(s => s.sin_correo)
  console.log(`\nde los ${lista.length} de la lista:`)
  console.log(`  sin correo:                  ${sinCorreo.length}  (no les llega el anuncio)`)
  console.log(`  con correo rebotado:         ${rebotados.length}`)
  console.log(`  dados de baja del boletín:   ${bajas.length}`)
  console.log(`  ALCANZABLES por correo:      ${lista.length - sinCorreo.length - rebotados.length - bajas.length}`)

  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`
  fs.writeFileSync('/tmp/campa-lista.csv', '﻿' + ['nombre,correo,sin_correo,rebotado,baja_boletin,id',
    ...lista.map(s => [q(s.nombre), q(s.email), !String(s.email ?? '').trim(), s.rebotado, s.sin_correo, s.id].join(','))].join('\n'))

  if (!APLICAR) { console.log('\n>>> DRY-RUN: no se guardó la lista'); await c.end(); return }

  // member_ids es JSONB, no un arreglo de texto: se manda como JSON.
  const ids = JSON.stringify(lista.map(s => s.id))
  const cuantos = lista.length
  const { rows: [ya] } = await c.query('select id from member_lists where name = $1', [NOMBRE])
  if (ya) {
    await c.query(`update member_lists set member_ids = $1::jsonb, member_count = $2, description = $3,
                   updated_at = now() where id = $4`, [ids, cuantos, DESCRIPCION, ya.id])
    console.log(`\n>>> ACTUALIZADA "${NOMBRE}" · ${cuantos} personas`)
  } else {
    const { rows: [n] } = await c.query(`
      insert into member_lists (name, description, member_ids, member_count, is_dynamic, tags, filters, segment_label)
      values ($1,$2,$3::jsonb,$4,false,$5::text[],'{"groups":[],"conditions":[]}'::jsonb,'Servidores')
      returning id`,
      [NOMBRE, DESCRIPCION, ids, cuantos, '{servidores,campa-2026}'])
    console.log(`\n>>> CREADA "${NOMBRE}" · ${cuantos} personas\n    id ${n.id}`)
  }
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
