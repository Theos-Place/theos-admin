/**
 * DEPURACIÓN · Clasificar a cada servidor ACTIVO contra el CCB de hoy.
 *   node scripts/depuracion-2026-09-12/clasificar.cjs [--aplicar]
 *
 * El madre se alimentó de un export de CCB que traía gente que ya no sirve y la
 * Etapa 3 la importó activa. La foto real es
 * data-import/puestos-ccb-actual-2026-09-12.csv (1.117 asignaciones, 723
 * personas). Match por external_id, nunca por nombre.
 *
 * CÓMO SE DISTINGUE "lo agregó alguien en la app" DE "lo metió un script".
 * No sirve el audit_log (los INSERT de volunteers no guardan actor) ni
 * start_date (la app y mi script ponen los dos la fecha de hoy). Sirve el RITMO
 * de created_at: los scripts escriben en ráfaga dentro de una transacción y la
 * app escribe de a una. Medido en hora CR:
 *   · 2026-09-11 17:36 → 792 filas en UN minuto = la Etapa 3 del madre;
 *   · 8, 9, 10 y 11-set → de 1 a 3 por minuto, repartidas en el día = la app;
 *   · antes del 8-set → los imports de junio y agosto.
 * Así que: app = creada desde el kick-off (8-set) y FUERA de esa ráfaga.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const KICKOFF = '2026-09-08'
const RAFAGA_ETAPA3 = '2026-09-11 17:36'   // minuto exacto, hora CR

function leerCSV(t) {
  const filas = []; let i = 0, f = '', r = [], q = false
  while (i < t.length) { const ch = t[i]
    if (q) { if (ch === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue } q = false; i++; continue } f += ch; i++; continue }
    if (ch === '"') { q = true; i++; continue }
    if (ch === ',') { r.push(f); f = ''; i++; continue }
    if (ch === '\n') { r.push(f); filas.push(r); r = []; f = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    f += ch; i++ }
  if (f.length || r.length) { r.push(f); filas.push(r) }
  const head = filas.shift().map(h => h.replace(/^﻿/, '').replace(/^"|"$/g, ''))
  return filas.filter(x => x.length === head.length).map(x => Object.fromEntries(head.map((h, j) => [h, x[j]])))
}

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-actual-2026-09-12.csv', 'utf8'))
  const enCCB = new Set(ccb.map(r => String(r['Individual ID']).trim()))
  console.log(`CCB de hoy: ${ccb.length} asignaciones, ${enCCB.size} personas\n`)

  const CR = `at time zone 'America/Costa_Rica'`
  const { rows: act } = await c.query(`select v.id, v.member_id, v.position_id, v.created_at,
      m.external_id, m.first_name||' '||m.last_name persona, m.is_system,
      sp.title, a.name comite,
      substr((v.created_at ${CR})::text,1,16) minuto
    from volunteers v join members m on m.id=v.member_id
    join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.status='active' and a.name not like '[prueba]%'`)
  console.log(`asignaciones activas (sin [prueba]): ${act.length}`)
  console.log(`personas únicas activas: ${new Set(act.map(r => r.member_id)).size}\n`)

  const deLaApp = r => r.minuto >= KICKOFF && r.minuto !== RAFAGA_ETAPA3
  const A = [], B = [], C = []
  for (const r of act) {
    if (enCCB.has(String(r.external_id))) A.push(r)
    else if (deLaApp(r)) B.push(r)
    else C.push(r)
  }
  const pers = arr => new Set(arr.map(r => r.member_id)).size
  console.log(`a) EN el CCB de hoy → se quedan:                  ${String(A.length).padStart(4)} asignaciones · ${pers(A)} personas`)
  console.log(`b) NO en CCB pero agregadas EN LA APP → se quedan: ${String(B.length).padStart(4)} asignaciones · ${pers(B)} personas`)
  console.log(`c) NO en CCB y vienen del import → SE DAN DE BAJA: ${String(C.length).padStart(4)} asignaciones · ${pers(C)} personas`)
  const quedan = new Set([...A, ...B].map(r => r.member_id))
  console.log(`\npersonas activas que quedarían: ${quedan.size}   (meta: 723 del CCB + los de (b))`)

  console.log('\n── GRUPO (b) COMPLETO — agregados en la app, para validar que no sean residuo:')
  const porB = new Map()
  for (const r of B) { const k = `${r.persona}|${r.comite}|${r.title}|${r.minuto}`; porB.set(k, (porB.get(k) ?? 0) + 1) }
  ;[...porB.keys()].sort().forEach(k => { const [p, com, t, m] = k.split('|')
    console.log(`   ${m}  ${p.padEnd(30)} ${com.padEnd(26)} «${t}»`) })

  const porC = new Map()
  for (const r of C) { const k = `${r.comite}|${r.title}`; porC.set(k, (porC.get(k) ?? 0) + 1) }
  console.log(`\n── GRUPO (c), por comité y puesto (${porC.size} combinaciones):`)
  ;[...porC].sort((x, y) => y[1] - x[1]).slice(0, 30).forEach(([k, n]) =>
    console.log(`   ${String(n).padStart(4)}  ${k.split('|')[0].padEnd(28)} «${k.split('|')[1]}»`))

  fs.writeFileSync('scripts/depuracion-2026-09-12/clasificacion.json', JSON.stringify({
    a: A.map(r => r.id), b: B.map(r => ({ id: r.id, persona: r.persona, comite: r.comite, title: r.title, minuto: r.minuto })),
    c: C.map(r => ({ id: r.id, member_id: r.member_id, persona: r.persona, ext: r.external_id, comite: r.comite, title: r.title })),
  }, null, 1))
  const cab = ['Persona', 'external_id', 'Comité', 'Puesto', 'Creada']
  fs.writeFileSync('data-import/depuracion-grupo-c-2026-09-12.csv',
    [cab, ...C.map(r => [r.persona, r.external_id, r.comite, r.title, r.minuto])]
      .map(f => f.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('\nCSV del grupo (c): data-import/depuracion-grupo-c-2026-09-12.csv')
  console.log('\n🔎 DRY RUN — no se escribió nada.')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
