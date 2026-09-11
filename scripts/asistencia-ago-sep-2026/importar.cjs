/**
 * Import de asistencia a charlas, agosto–setiembre 2026.
 * Fuente: data-import/asistencia-detalle-ago-sep-2026.csv (5.031 filas).
 *
 *   node scripts/asistencia-ago-sep-2026/importar.cjs              # DRY RUN
 *   node scripts/asistencia-ago-sep-2026/importar.cjs --aplicar    # escribe
 *   ... --crear-eventos    # además crea los eventos de las fechas huérfanas
 *
 * DEDUPE (punto 2). La llave es (miembro, CHARLA, día en hora CR), no el
 * event_id: la misma charla cambió de título entre agosto y setiembre
 * ("Charla Alajuela" → "Charla Alajuela Jueves"), así que deduplicar por evento
 * dejaría entrar de nuevo lo que ya está. Con la llave por charla da igual de
 * dónde venga el check-in — import anterior o app en vivo.
 *
 * BUCKETS. El puente entre el nombre del CSV y el título del evento es esta
 * tabla y nada más: si aparece un grupo o un título de charla que no está acá,
 * el script ABORTA. Adivinar acá es mandar la asistencia de una sede a otra.
 */
const { Client } = require('pg'); const fs = require('fs'); const XLSX = require('xlsx')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const APLICAR = process.argv.includes('--aplicar')
const CREAR_EVENTOS = process.argv.includes('--crear-eventos')
const CSV = 'data-import/asistencia-detalle-ago-sep-2026.csv'
const MAESTRO = 'data-import/maestro-asistentes-2026-09.xlsx'

// bucket → { csv: nombre en el CSV, titulos: títulos de evento que SON esta
// charla, nuevo: título a usar si hay que crear el evento }
const CHARLAS = [
  { b:'alajuela',      csv:'Alajuela',       titulos:['Charla Alajuela','Charla Alajuela Jueves'],                 nuevo:'Charla Alajuela' },
  { b:'antares',       csv:'Antares',        titulos:['Charla Antares','Charla Antares Miércoles'],                nuevo:'Charla Antares' },
  { b:'cartago',       csv:'Cartago',        titulos:['Charla Cartago','Charla Cartago Miércoles'],                nuevo:'Charla Cartago' },
  { b:'cartago-youth', csv:'Cartago Youth',  titulos:['Cartago Youth'],                                            nuevo:'Cartago Youth' },
  { b:'guapiles',      csv:'Guapiles',       titulos:['Charla Guápiles','Charla Guápiles Miércoles'],              nuevo:'Charla Guápiles' },
  { b:'heredia',       csv:'Heredia',        titulos:['Charla Heredia','Charla Heredia Miércoles'],                nuevo:'Charla Heredia' },
  { b:'heredia-youth', csv:'Heredia Youth',  titulos:['Heredia Youth'],                                            nuevo:'Heredia Youth' },
  { b:'pedregal',      csv:'Home',           titulos:['Charla Home','Charla Pedregal Jueves'],                     nuevo:'Charla Home' },
  { b:'madrid-home',   csv:'Home Madrid',    titulos:['Charla Madrid Home','Charla Madrid Home Jueves'],           nuevo:'Charla Madrid Home' },
  { b:'liberia',       csv:'Liberia',        titulos:['Charla Liberia','Charla Liberia Miércoles'],                nuevo:'Charla Liberia' },
  { b:'madrid',        csv:'Madrid',         titulos:['Charla Madrid','Charla Madrid Domingo'],                    nuevo:'Charla Madrid' },
  { b:'meridiano-mar', csv:'Meridiano Mar',  titulos:['Charla Meridiano','Charla Meridiano Martes'],               nuevo:'Charla Meridiano' },
  { b:'meridiano-mie', csv:'Meridiano Mie',  titulos:['Charla Meridiano Mié','Charla Meridiano Miércoles'],        nuevo:'Charla Meridiano Mié' },
  { b:'potrero',       csv:'Potrero',        titulos:['Charla Potrero','Charla Potrero Jueves'],                   nuevo:'Charla Potrero' },
  { b:'perez-zeledon', csv:'Pérez Zeledón',  titulos:['Charla Pérez Zeledón','Charla Pérez Zeledón Miércoles'],    nuevo:'Charla Pérez Zeledón' },
  { b:'united',        csv:'United',         titulos:['Charla United','Charla United Domingo'],                    nuevo:'Charla United' },
  { b:'united-youth',  csv:'United Youth',   titulos:['United Youth'],                                             nuevo:'United Youth' },
]
const BUCKET_POR_CSV = new Map(CHARLAS.map(x=>[x.csv,x.b]))
const BUCKET_POR_TITULO = new Map(CHARLAS.flatMap(x=>x.titulos.map(t=>[t,x.b])))
const DEF = new Map(CHARLAS.map(x=>[x.b,x]))

function parseCSV(t){const rows=[];let i=0,f='',r=[],q=false
 while(i<t.length){const ch=t[i]
  if(q){ if(ch==='"'){ if(t[i+1]==='"'){f+='"';i+=2;continue} q=false;i++;continue } f+=ch;i++;continue }
  if(ch==='"'){q=true;i++;continue}
  if(ch===','){r.push(f);f='';i++;continue}
  if(ch==='\n'){r.push(f);rows.push(r);r=[];f='';i++;continue}
  if(ch==='\r'){i++;continue}
  f+=ch;i++ }
 if(f.length||r.length){r.push(f);rows.push(r)}
 const head=rows.shift(); return rows.filter(x=>x.length===head.length).map(x=>Object.fromEntries(head.map((h,j)=>[h,x[j]])))}

// "19 sept 1989" / "28 jan 1992" → 1989-09-19. "-" o vacío → null.
const MESES = { ene:1,jan:1,feb:2,mar:3,abr:4,apr:4,may:5,jun:6,jul:7,ago:8,aug:8,sep:9,sept:9,oct:10,nov:11,dic:12,dec:12 }
function fechaMaestro(v){
  const s=String(v??'').trim().toLowerCase()
  if(!s||s==='-') return null
  const m=s.match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})$/)
  if(!m) return null
  const mes=MESES[m[2].replace(/\./g,'')]
  if(!mes) return null
  const d=Number(m[1]), y=Number(m[3])
  if(d<1||d>31||y<1900||y>2026) return null
  return `${y}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
const norm = s => String(s??'').trim()
const email = s => { const e=norm(s).toLowerCase(); return (!e||e==='-'||!e.includes('@')) ? null : e }
const genero = s => { const g=norm(s).toUpperCase(); return g==='M'||g==='F' ? g : null }

;(async () => {
  await c.connect()
  const csv = parseCSV(fs.readFileSync(CSV,'utf8'))
  console.log(`CSV: ${csv.length} filas\n`)

  // ── Guardia de buckets ────────────────────────────────────────────────
  const gruposCsv=[...new Set(csv.map(r=>r.group))]
  const desconocidos=gruposCsv.filter(g=>!BUCKET_POR_CSV.has(g))
  if(desconocidos.length){ console.error('ABORTA — grupos del CSV sin bucket:', desconocidos); process.exit(1) }

  // ── Eventos de charla existentes en la ventana ────────────────────────
  const { rows: evs } = await c.query(
    `select id, title, substr((starts_at at time zone 'America/Costa_Rica')::text,1,10) d, is_recurring
     from events where event_type='charla' and starts_at>='2026-07-25' and starts_at<'2026-10-01'`)
  const titulosRaros = [...new Set(evs.map(e=>e.title))].filter(t=>!BUCKET_POR_TITULO.has(t))
  if(titulosRaros.length) console.log(`⚠️  títulos de charla en la ventana que NO están en la tabla (se ignoran): ${titulosRaros.join(' | ')}\n`)
  // evento no recurrente por (bucket, día): es el único al que se le puede
  // colgar un check-in con la fecha correcta (ver informe).
  const eventoDe = new Map()
  for(const e of evs){ const b=BUCKET_POR_TITULO.get(e.title); if(!b||e.is_recurring) continue; eventoDe.set(b+'|'+e.d, e.id) }

  // ── Check-ins que YA existen, por (miembro, bucket, día) ──────────────
  const { rows: yaCk } = await c.query(
    `select ck.member_id, e.title, substr((ck.checked_in_at at time zone 'America/Costa_Rica')::text,1,10) d
     from event_checkins ck join events e on e.id=ck.event_id
     where e.event_type='charla' and ck.checked_in_at>='2026-07-25' and ck.member_id is not null`)
  const existentes = new Set()
  for(const r of yaCk){ const b=BUCKET_POR_TITULO.get(r.title); if(b) existentes.add(r.member_id+'|'+b+'|'+r.d) }
  console.log(`check-ins de charla ya en la base desde el 25-jul: ${yaCk.length}\n`)

  // ── Personas ──────────────────────────────────────────────────────────
  const ids=[...new Set(csv.map(r=>norm(r.external_id)))]
  const memberPorExt=new Map()
  for(let i=0;i<ids.length;i+=500){
    const { rows } = await c.query(`select id, external_id from members where external_id = any($1)`,[ids.slice(i,i+500)])
    rows.forEach(r=>memberPorExt.set(String(r.external_id), r.id))
  }
  const sinFicha = ids.filter(i=>!memberPorExt.has(i))

  const maestro = XLSX.utils.sheet_to_json(XLSX.readFile(MAESTRO).Sheets['Total'],{defval:''})
  const maestroPorId = new Map(maestro.map(r=>[String(r['Individual ID']).trim().replace(/\.0$/,''), r]))

  const aCrear=[], sinMaestro=[], correoOcupado=[]
  for(const id of sinFicha){
    const m = maestroPorId.get(id)
    if(!m){ sinMaestro.push(id); continue }
    aCrear.push({ external_id:id, first_name:norm(m['First Name'])||'(sin nombre)', last_name:norm(m['Last Name'])||'',
                  birth_date:fechaMaestro(m['Birthdate_Orig']), email:email(m['Email']), gender:genero(m['Gender']) })
  }
  // Dedup de correo (mismo criterio del alta: si ya es de otra ficha, no se crea).
  const correos=aCrear.map(x=>x.email).filter(Boolean)
  if(correos.length){
    const { rows } = await c.query(`select id, lower(email) email from members where lower(email) = any($1)`,[correos])
    const ocupados=new Set(rows.map(r=>r.email))
    for(const x of aCrear){ if(x.email && ocupados.has(x.email)){ correoOcupado.push(x); x.email=null } }
  }

  console.log('PERSONAS')
  console.log(`  external_id distintos: ${ids.length}   con ficha: ${memberPorExt.size}   sin ficha: ${sinFicha.length}`)
  console.log(`  se crearían: ${aCrear.length}   sin match en el maestro: ${sinMaestro.length}`)
  console.log(`  con correo ya usado por otra ficha (se crean SIN correo): ${correoOcupado.length}`)
  console.log(`  con fecha de nacimiento legible: ${aCrear.filter(x=>x.birth_date).length}`)
  if(sinMaestro.length) console.log(`  ⚠️  sin maestro (no se crean): ${sinMaestro.join(', ')}`)

  // ── Reparto de las filas ──────────────────────────────────────────────
  const fechasHuerfanas = new Map()
  let yaEstaba=0, listas=[], dependenDeFicha=0, sinEvento=0
  const memberDe = ext => memberPorExt.get(ext) ?? (aCrear.some(x=>x.external_id===ext) ? 'NUEVO' : null)
  for(const r of csv){
    const b=BUCKET_POR_CSV.get(r.group), d=r.meeting_date, ext=norm(r.external_id)
    const mid=memberDe(ext)
    if(!mid){ continue } // sin ficha y sin maestro: se reporta aparte
    if(mid!=='NUEVO' && existentes.has(mid+'|'+b+'|'+d)){ yaEstaba++; continue }
    if(mid==='NUEVO') dependenDeFicha++
    const ev=eventoDe.get(b+'|'+d)
    if(!ev){ sinEvento++; const k=b+'|'+d; fechasHuerfanas.set(k,(fechasHuerfanas.get(k)||0)+1); continue }
    listas.push({ ev, ext, b, d })
  }
  console.log('\nFILAS')
  console.log(`  ya estaban en la base (mismo miembro, misma charla, mismo día): ${yaEstaba}`)
  console.log(`  listas para insertar (hay evento ese día): ${listas.length}`)
  console.log(`  BLOQUEADAS: no existe evento de esa charla ese día: ${sinEvento}`)
  console.log(`  (de las nuevas, ${dependenDeFicha} son de gente que hay que crear primero)`)

  if(fechasHuerfanas.size){
    console.log(`\nFECHAS SIN EVENTO (${fechasHuerfanas.size} combinaciones charla×día):`)
    const porFecha=new Map()
    for(const [k,n] of fechasHuerfanas){ const [b,d]=k.split('|'); if(!porFecha.has(d))porFecha.set(d,[]); porFecha.get(d).push(`${b}(${n})`) }
    for(const d of [...porFecha.keys()].sort()) console.log(`   ${d}  ${porFecha.get(d).join(' ')}`)
  }

  // ── Eventos a crear (aprobado por el usuario 2026-09-11) ──────────────
  // El mecanismo recurrente NO materializa filas (expand-recurrence.ts los
  // expande virtualmente), así que estas fechas no van a aparecer solas. Se
  // crean con el MISMO molde que los del 2–16 de agosto que ya están: no
  // recurrentes, uno por (charla, día), mediodía de Costa Rica. Es lo único que
  // hace que report_charla_attendance —que agrupa por events.starts_at— muestre
  // las semanas de agosto.
  const eventosACrear = []
  if (CREAR_EVENTOS) {
    for (const k of new Set([...fechasHuerfanas.keys()])) {
      const [b, d] = k.split('|')
      eventosACrear.push({ b, d, title: DEF.get(b).nuevo })
    }
    eventosACrear.sort((x, y) => (x.d + x.b).localeCompare(y.d + y.b))
    console.log(`\nEVENTOS A CREAR: ${eventosACrear.length}`)
  }

  if (!APLICAR) {
    console.log('\n🔎 DRY RUN — no se escribió nada.')
    if (!CREAR_EVENTOS) console.log('   (correr con --crear-eventos para incluir las fechas huérfanas)')
    await c.end(); return
  }

  // ── ESCRITURA ─────────────────────────────────────────────────────────
  await c.query('begin')
  // El trigger por fila recalcula la sede en CADA insert; con ~3.000 check-ins
  // eso son 3.000 recálculos completos para nada, porque al final se corre
  // refresh_member_sedes() una sola vez. Se apaga DENTRO de la transacción, así
  // que un rollback lo devuelve solo.
  await c.query('alter table event_checkins disable trigger trg_recalc_member_sede')

  let creados = 0
  for (const p of aCrear) {
    const { rows } = await c.query(
      `insert into members (external_id, first_name, last_name, birth_date, email, gender, is_active)
       values ($1,$2,$3,$4,$5,$6,true) returning id`,
      [p.external_id, p.first_name, p.last_name, p.birth_date, p.email, p.gender])
    memberPorExt.set(p.external_id, rows[0].id); creados++
  }
  console.log(`\nfichas creadas: ${creados}`)

  let evCreados = 0
  for (const e of eventosACrear) {
    const { rows } = await c.query(
      `insert into events (title, event_type, starts_at, is_public, is_active, is_recurring,
                           requires_checkin, status, timezone, currency, servers_pay)
       values ($1,'charla',$2,true,true,false,false,'upcoming','America/Costa_Rica','CRC',true)
       returning id`,
      [e.title, `${e.d}T18:00:00Z`])
    eventoDe.set(e.b + '|' + e.d, rows[0].id); evCreados++
  }
  console.log(`eventos creados: ${evCreados}`)

  // Se recalcula el reparto ahora que existen fichas y eventos.
  let insertados = 0, saltados = 0
  const puestos = new Set()
  for (const r of csv) {
    const b = BUCKET_POR_CSV.get(r.group), d = r.meeting_date, ext = norm(r.external_id)
    const mid = memberPorExt.get(ext)
    if (!mid) { saltados++; continue }
    const llave = mid + '|' + b + '|' + d
    if (existentes.has(llave) || puestos.has(llave)) { saltados++; continue }
    const ev = eventoDe.get(b + '|' + d)
    if (!ev) { saltados++; continue }
    await c.query(
      `insert into event_checkins (event_id, member_id, checked_in_at, method, checked_in_as)
       values ($1,$2,$3,'manual','asistente')`, [ev, mid, `${d}T18:00:00Z`])
    puestos.add(llave); insertados++
  }
  console.log(`check-ins insertados: ${insertados}   saltados: ${saltados}`)

  await c.query('alter table event_checkins enable trigger trg_recalc_member_sede')
  await c.query('commit')
  console.log('\n✅ APLICADO')

  console.log('\nrecalculando sedes (refresh_member_sedes)…')
  const t0 = Date.now()
  await c.query('select refresh_member_sedes()')
  console.log(`   listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  await c.end()
})().catch(e=>{ console.error(e); process.exit(1) })
