/**
 * ¿Se aplicaron en el sistema los cierres que reportaron los dirigentes?
 *   node scripts/cruce-form-2026-09-14/cruzar.cjs <csv del formulario>
 *
 * SE MATCHEA POR ESTUDIANTES, NO POR DIRIGENTE. El primer intento buscaba el
 * grupo por (external_id del dirigente + plan + fecha de fin más cercana) y dio
 * falsos "cerrado": hay TRES fichas de Fernando Chavarría, el formulario trae
 * la 7968 y los grupos de Administrando el Dinero están todos en la 6768. El
 * matcheo encontró un grupo de la ficha equivocada —uno viejo y cerrado— y dio
 * el caso por bueno, cuando el grupo real (junio 2026) estaba abierto y sin una
 * sola nota.
 *
 * La lista de aprobados del formulario, en cambio, es única: dos grupos no
 * comparten siete estudiantes. Así que se busca el grupo del plan correcto que
 * MÁS estudiantes comparta con esa lista, y se exige que comparta al menos la
 * mitad. Las fichas duplicadas del dirigente dejan de importar.
 */
const fs = require('fs'); const L = require('../madre-2026-09/lib.cjs')
function leerCSV(t){const filas=[];let i=0,f='',r=[],q=false
 while(i<t.length){const ch=t[i]
  if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i+=2;continue}q=false;i++;continue}f+=ch;i++;continue}
  if(ch==='"'){q=true;i++;continue}
  if(ch===','){r.push(f);f='';i++;continue}
  if(ch==='\n'){r.push(f);filas.push(r);r=[];f='';i++;continue}
  if(ch==='\r'){i++;continue} f+=ch;i++}
 if(f.length||r.length){r.push(f);filas.push(r)}
 const head=filas.shift().map(h=>h.replace(/^﻿/,'').replace(/^"|"$/g,''))
 return filas.filter(x=>x.length===head.length).map(x=>Object.fromEntries(head.map((h,j)=>[h,x[j]])))}

const norm = s => L.norm(String(s??'')).replace(/\(.*?\)/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim()
/** Nombres de una lista escrita a mano: se le quita numeración, notas y ruido. */
const nombres = t => String(t??'').split('\n')
  .map(l => l.replace(/^\s*\d+[.)\-,]?\s*/,'').replace(/[-–]\s*\d+\s*$/,'').replace(/\s+\d+\s*$/,'').trim())
  .filter(l => l.length > 4 && /\s/.test(l) && !/^(si|no|todos|ninguno|n\/a)\b/i.test(l))
  .map(norm)
/** Dos nombres son la misma persona si comparten nombre y primer apellido. */
const clave = n => { const p = norm(n).split(' ').filter(Boolean); return p.length < 2 ? null : `${p[0]} ${p[1]}` }

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const rows = leerCSV(fs.readFileSync(process.argv[2],'utf8')).filter(r => (r['Fecha de finalización']||'').startsWith('2026'))
  const planes = (await c.query(`select id, code, name from study_plans`)).rows
  const porNombre = new Map(planes.map(p => [norm(p.name), p]))
  for (const a of ['prematrimonial','pre matrimonial'])
    porNombre.set(a, planes.find(p => /prematrim/i.test(p.name)))
  porNombre.set('hermeneutica como interpretar la biblia', planes.find(p => /hermen/i.test(p.name)))

  const res = []
  for (const r of rows) {
    const nomPlan = (r['Capacitación que finalizó'] || r['Nombre de la capacitación:'] || '').trim()
    const plan = porNombre.get(norm(nomPlan))
    const base = { dirigente: `${r['First Name']} ${r['Last Name']}`, ccb: r['Individual ID'], plan: nomPlan, fin: r['Fecha de finalización'] }
    const aprob = nombres(r['Lista de personas que aprobaron'])
    const repro = nombres(r['Lista de personas que reprobaron'])
    base.form = `${aprob.length}✓/${repro.length}✗`
    if (!plan) { res.push({ ...base, veredicto: 'plan no reconocido' }); continue }
    if (!aprob.length) { res.push({ ...base, veredicto: 'lista de aprobados ilegible' }); continue }

    // Candidatos: grupos de ese plan que terminaron cerca (±120 días) o sin fecha.
    const { rows: cand } = await c.query(`
      select g.id, g.name, g.status, to_char(g.ends_at,'YYYY-MM-DD') fin,
        (select count(*) from study_enrollments e where e.group_id=g.id and e.status='enrolled')::int sin_nota,
        (select count(*) from study_enrollments e where e.group_id=g.id and e.status='completed')::int ap,
        (select count(*) from study_enrollments e where e.group_id=g.id and e.status='reprobado')::int re
      from study_groups g
      where g.plan_id=$1 and (g.ends_at is null or g.ends_at between $2::date - 120 and $2::date + 120)`,
      [plan.id, r['Fecha de finalización']])

    const buscados = new Set(aprob.map(clave).filter(Boolean))
    let mejor = null
    for (const g of cand) {
      const { rows: est } = await c.query(
        `select m.first_name||' '||m.last_name n from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1`, [g.id])
      const tiene = new Set(est.map(x => clave(x.n)).filter(Boolean))
      let comunes = 0; for (const b of buscados) if (tiene.has(b)) comunes++
      if (!mejor || comunes > mejor.comunes) mejor = { ...g, comunes, total: est.length }
    }
    if (!mejor || mejor.comunes < Math.ceil(buscados.size / 2)) {
      res.push({ ...base, veredicto: 'sin grupo que calce', coinciden: `${mejor?.comunes ?? 0}/${buscados.size}` }); continue
    }
    base.grupo = mejor.name; base.estado = mejor.status; base.fin_sistema = mejor.fin
    base.sistema = `${mejor.ap}✓/${mejor.re}✗`; base.coinciden = `${mejor.comunes}/${buscados.size}`
    res.push({ ...base, veredicto:
      mejor.status !== 'finalizado' ? (mejor.sin_nota > 0 ? 'ABIERTO y sin notas' : 'ABIERTO (ya evaluado)')
      : mejor.sin_nota > 0 ? 'cerrado con gente sin nota' : 'CERRADO ✓' })
  }

  const g = {}; for (const r of res) g[r.veredicto] = (g[r.veredicto] ?? 0) + 1
  console.log(`respuestas de 2026 en el formulario: ${rows.length}\n`)
  console.table(Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([v,n])=>({ veredicto: v, n })))
  for (const v of Object.keys(g)) {
    if (v === 'CERRADO ✓') continue
    console.log(`\n── ${v}`)
    console.table(res.filter(r => r.veredicto === v).map(r => ({
      dirigente: r.dirigente.slice(0,22), plan: r.plan.slice(0,24), fin_form: r.fin,
      grupo: (r.grupo ?? '—').slice(0,40), estado: r.estado ?? '—',
      form: r.form, sistema: r.sistema ?? '—', calce: r.coinciden ?? '—' })))
  }
  const cab = ['dirigente','ccb_id','plan','fin_formulario','grupo','estado','fin_sistema','formulario','sistema','estudiantes_que_calzan','veredicto']
  fs.writeFileSync('data-import/cierres-formulario-2026-revision.csv',
    [cab.join(',')].concat(res.map(r => [r.dirigente,r.ccb,r.plan,r.fin,r.grupo??'',r.estado??'',r.fin_sistema??'',r.form??'',r.sistema??'',r.coinciden??'',r.veredicto]
      .map(x => `"${String(x??'').replace(/"/g,'""')}"`).join(','))).join('\n'))
  console.log('\nlista → data-import/cierres-formulario-2026-revision.csv')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
