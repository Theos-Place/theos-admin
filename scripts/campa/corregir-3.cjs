/**
 * Campa 2026 · Los 3 que el cruce no pudo resolver, identificados a mano por el
 * usuario (2026-09-18). Fueron al campa, así que salen de la lista del anuncio.
 *
 * Se identifican por CÉDULA los dos que la tienen; el tercero por nombre, y el
 * script exige que haya UNA SOLA ficha viva con ese nombre (regla de AGENTS.md:
 * con cero o con dos se reporta y no se toca).
 *
 * Dry-run por defecto; --aplicar reescribe la lista.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const LISTA = 'Servidores que NO fueron al campa 2026'

const CASOS = [
  { dice: 'Eddy Gomez', es: 'Eddy Gomez Rivera', cedula: '113840219' },
  { dice: 'Eduardo Gutierrez', es: 'Eduardo Gutierrez Carvajal', cedula: '112780725' },
  { dice: 'Alvaro Jose Villalobos', es: 'Alvaro Villalobos Jimenez', cedula: null },
]

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const ids = []
  for (const k of CASOS) {
    const { rows } = k.cedula
      ? await c.query(`select id, first_name||' ' ||last_name nombre from members
                       where is_active and regexp_replace(coalesce(cedula,''),'\\D','','g') = $1`, [k.cedula])
      : await c.query(`select id, first_name||' '||last_name nombre from members
                       where is_active and lower(first_name||' '||last_name) like '%lvaro%villalobos%jim%'`)
    if (rows.length !== 1) throw new Error(`GUARDA: ${k.es} resolvió a ${rows.length} fichas — no se toca`)
    console.log(`  ${k.dice.padEnd(24)} → ${rows[0].nombre}`)
    ids.push(rows[0].id)
  }

  const { rows: [l] } = await c.query(
    'select id, member_count, member_ids from member_lists where name = $1', [LISTA])
  if (!l) throw new Error(`GUARDA: no existe la lista "${LISTA}"`)
  const actuales = l.member_ids
  const quedan = actuales.filter(x => !ids.includes(x))
  console.log(`\nlista: ${actuales.length} → ${quedan.length}  (salen ${actuales.length - quedan.length})`)
  if (actuales.length - quedan.length !== ids.length) {
    console.log('  (alguno ya no estaba en la lista)')
  }
  if (!APLICAR) { console.log('\n>>> DRY-RUN: no se escribió nada'); await c.end(); return }

  await c.query(`update member_lists set member_ids = $1::jsonb, member_count = $2,
                 description = $3, updated_at = now() where id = $4`,
    [JSON.stringify(quedan), quedan.length,
     'Servidores activos al 18-set-2026 menos los 125 que asistieron al Campa de Servidores '
     + '(export de CCB, 130 respuestas; 3 identificados a mano). Para el anuncio del 10 de octubre.',
     l.id])
  const { rows: [post] } = await c.query(
    'select member_count, jsonb_array_length(member_ids) n from member_lists where id = $1', [l.id])
  console.log(`>>> ACTUALIZADA · member_count ${post.member_count} · ids ${post.n}${post.member_count === post.n ? ' ✓' : ' ‼'}`)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
