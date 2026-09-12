/**
 * ¿Cuántas de las 532 inscripciones "Por confirmar" se resuelven con el
 * histórico de procesos de CCB (process_detail)?
 *   node scripts/depuracion-2026-09-12/resolver-pendientes.cjs [--aplicar]
 *
 * El archivo trae, por persona y estudio, la fecha en que se marcó Done. Dos
 * colas dicen que REPROBÓ —"Reprueba Nivel 1 - 4" y "Reprueba Capacitación"—
 * pero no dicen CUÁL: eso solo se atribuye por fecha.
 *
 * LA VENTANA ES LO QUE HACE HONESTO EL CRUCE. Un "aprobó Nivel 2" suelto no
 * sirve: la persona pudo aprobarlo en otro grupo, años antes. Solo cuenta si la
 * fecha cae dentro del período del grupo, con margen para el papeleo tardío.
 *
 * Se escribe con la MISMA convención que el RPC close_group, para que
 * clasificarResultado() lo lea igual:
 *   aprobado  → status='completed', notes='aprobado', completed_at = la fecha
 *   reprobado → status='completed', notes='reprobado: <motivo>'
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const ANTES = 30, DESPUES = 180   // días de margen alrededor del período del grupo

const COLA = {
  N1: 'Nivel 1', N2: 'Nivel 2', N3: 'Nivel 3', N4: 'Nivel 4',
  SCJ: 'Sirviendo como Jesús', DIS1: 'Discípulos 1', DIS2: 'Discípulos 2', DIS3: 'Discipulos 3',
  PAN: 'Panorama', CDEB: '¿Cómo dar Estudios Bíblicos?', AED: 'Administrando el Dinero',
  MAT: 'Matrimonios', RDM: 'Religiones del Mundo', EVM: 'Evangelismo',
  HER: '¿Cómo interpretar la Biblia? (Hermenéutica)', HCH: 'Hechos', EVA: 'Evangelios',
  DLF: 'Defendiendo la Fe (Apologética)', CTBD: 'Cómo Tomar Buenas Desiciones (Viviendo en Integri)',
  PREMAT: 'Pre Matrimonial', ROM: 'Romanos', CDC: '¿Cómo dar Charlas?', QEJ: '¿Quien es Jesús?',
  GAL: 'Galatas', MDM: 'Movimiento de Discipulos Multiplicadores',
  // PAREJAS (Grupo Parejas) no tiene cola equivalente en el archivo.
}
const NIVELES = new Set(['N1', 'N2', 'N3', 'N4'])

function leerCSV(t) {
  const F = []; let i = 0, f = '', r = [], q = false
  while (i < t.length) { const ch = t[i]
    if (q) { if (ch === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue } q = false; i++; continue } f += ch; i++; continue }
    if (ch === '"') { q = true; i++; continue }
    if (ch === ',') { r.push(f); f = ''; i++; continue }
    if (ch === '\n') { r.push(f); F.push(r); r = []; f = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    f += ch; i++ }
  if (f.length || r.length) { r.push(f); F.push(r) }
  const h = F.shift()
  return F.filter(x => x.length === h.length).map(x => Object.fromEntries(h.map((k, j) => [k, x[j]])))
}
const ymd = s => String(s ?? '').slice(0, 10)
const enVentana = (fecha, ini, fin) => {
  if (!fecha || fecha === '0000-00-00') return false
  const d = new Date(fecha)
  const a = ini ? new Date(new Date(ini).getTime() - ANTES * 86400000) : null
  const b = fin ? new Date(new Date(fin).getTime() + DESPUES * 86400000) : null
  return (!a || d >= a) && (!b || d <= b)
}

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const proc = leerCSV(fs.readFileSync('data-import/process-detail-2026-09-12.csv', 'utf8'))
  const porPersona = new Map()
  for (const p of proc) {
    const k = String(p['Ind ID']).trim(); if (!k) continue
    if (!porPersona.has(k)) porPersona.set(k, []); porPersona.get(k).push(p)
  }
  console.log(`process_detail: ${proc.length} registros de ${porPersona.size} personas\n`)

  const { rows: pend } = await c.query(`
    select e.id, e.member_id, m.external_id, m.first_name||' '||m.last_name persona,
      g.id gid, g.name grupo, substr(g.starts_at::text,1,10) ini, substr(g.ends_at::text,1,10) fin,
      coalesce(pl.code,'—') code
    from study_enrollments e
    join study_groups g on g.id=e.group_id
    join members m on m.id=e.member_id
    left join study_plans pl on pl.id=g.plan_id
    where e.status='en_revision'`)
  console.log(`inscripciones "Por confirmar": ${pend.length}`)

  const aprob = [], repro = [], sinDato = [], sinCola = [], sinFicha = []
  for (const p of pend) {
    const cola = COLA[p.code]
    if (!cola) { sinCola.push(p); continue }
    const suyos = porPersona.get(String(p.external_id)) ?? []
    if (!suyos.length) { sinFicha.push(p); continue }
    const ok = suyos.filter(x => x['Queue Name'] === cola && enVentana(ymd(x.Due), p.ini, p.fin))
                    .sort((a, b) => ymd(a.Due).localeCompare(ymd(b.Due)))
    if (ok.length) { aprob.push({ ...p, fecha: ymd(ok[0].Due) }); continue }
    const colaRep = NIVELES.has(p.code) ? 'Reprueba Nivel 1 - 4' : 'Reprueba Capacitación'
    const no = suyos.filter(x => x['Queue Name'] === colaRep && enVentana(ymd(x.Due), p.ini, p.fin))
                    .sort((a, b) => ymd(a.Due).localeCompare(ymd(b.Due)))
    if (no.length) { repro.push({ ...p, fecha: ymd(no[0].Due) }); continue }
    // ¿aprobó ese estudio ALGUNA VEZ, fuera de la ventana? se reporta, no se aplica
    const fuera = suyos.filter(x => x['Queue Name'] === cola).map(x => ymd(x.Due)).sort()
    sinDato.push({ ...p, fuera: fuera[0] ?? null })
  }
  console.log(`\n  APROBÓ (hay Done de ese estudio dentro de la ventana):   ${aprob.length}`)
  console.log(`  REPROBÓ (hay registro de reprobación en la ventana):     ${repro.length}`)
  console.log(`  sin dato en el archivo:                                  ${sinDato.length}`)
  console.log(`     de esos, con el estudio aprobado FUERA de la ventana: ${sinDato.filter(x => x.fuera).length}`)
  console.log(`  el plan no tiene cola equivalente (Grupo Parejas…):      ${sinCola.length}`)
  console.log(`  la persona no aparece en el archivo:                     ${sinFicha.length}`)
  console.log(`\n  → se resolverían ${aprob.length + repro.length} de ${pend.length}  (${((aprob.length+repro.length)*100/pend.length).toFixed(0)}%)`)

  const porPlan = new Map()
  for (const x of [...aprob, ...repro]) porPlan.set(x.code, (porPlan.get(x.code) ?? 0) + 1)
  console.log('\n── resueltas por plan:')
  ;[...porPlan].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(4)}  ${k}`))
  console.log('\n── muestra de APROBÓ:')
  aprob.slice(0, 8).forEach(x => console.log(`   ${x.persona.padEnd(30)} ${x.code.padEnd(7)} grupo ${x.ini}→${x.fin}  aprobó ${x.fecha}`))
  console.log('\n── muestra de REPROBÓ:')
  repro.slice(0, 8).forEach(x => console.log(`   ${x.persona.padEnd(30)} ${x.code.padEnd(7)} grupo ${x.ini}→${x.fin}  reprobó ${x.fecha}`))
  console.log('\n── los que NO se resuelven, por plan:')
  const pn = new Map(); [...sinDato, ...sinCola, ...sinFicha].forEach(x => pn.set(x.code, (pn.get(x.code) ?? 0) + 1))
  ;[...pn].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(4)}  ${k}`))

  /**
   * AMBIGÜEDAD. "Reprueba Nivel 1 - 4" y "Reprueba Capacitación" no dicen CUÁL
   * estudio: si una persona tiene DOS pendientes cuya ventana contiene la misma
   * fecha, ese único registro no alcanza para decidir a cuál corresponde. Se
   * saca y se reporta — marcar los dos sería inventar una reprobación.
   */
  const porFecha = new Map()
  for (const x of repro) { const k = `${x.external_id}|${x.fecha}`; porFecha.set(k, (porFecha.get(k) ?? 0) + 1) }
  const ambiguos = repro.filter(x => porFecha.get(`${x.external_id}|${x.fecha}`) > 1)
  const reproOk = repro.filter(x => porFecha.get(`${x.external_id}|${x.fecha}`) === 1)
  if (ambiguos.length) {
    console.log(`\n⚠️  AMBIGUOS, se dejan sin resolver (${ambiguos.length}): una sola reprobación para varias pendientes de la misma fecha`)
    ambiguos.forEach(x => console.log(`   ${x.persona} — ${x.code} @ ${x.fecha}`))
  }

  fs.writeFileSync('scripts/depuracion-2026-09-12/resolucion.json', JSON.stringify({ aprob, repro: reproOk, ambiguos }, null, 1))
  if (!aplicar) { console.log('\n🔎 DRY RUN — no se escribió nada.'); await c.end(); return }

  await c.query('begin')
  let a = 0, r = 0
  for (const x of aprob) {
    await c.query(`update study_enrollments set status='completed', notes='aprobado',
      completed_at=$2::date + time '12:00', updated_at=now() where id=$1 and status='en_revision'`, [x.id, x.fecha])
    a++
  }
  for (const x of reproOk) {
    await c.query(`update study_enrollments set status='completed',
      notes='reprobado: reportado en CCB el ' || $2, completed_at=$2::date + time '12:00', updated_at=now()
      where id=$1 and status='en_revision'`, [x.id, x.fecha])
    r++
  }
  const { rows: [q] } = await c.query(`select count(*)::int n from study_enrollments where status='en_revision'`)
  console.log(`\naprobados: ${a}   reprobados: ${r}   quedan por confirmar: ${q.n}`)
  await c.query('commit'); console.log('\n✅ APLICADO')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
